"""Telegram listener -> ReplyBot ingest API.

READ-ONLY: worker ini hanya membaca pesan di grup yang Anda ikuti dan meneruskannya
ke dashboard. Tidak pernah mengirim pesan / DM atas nama akun Anda.

Pemakaian:
    python worker.py chats   # daftar grup/channel + id (untuk diisi ke TG_CHATS)
    python worker.py run     # mulai memantau (default)
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import timezone
from typing import Optional, Union

import httpx
from dotenv import load_dotenv

log = logging.getLogger("replybot.tg")

ChatRef = Union[int, str]


# --------------------------------------------------------------------------- config
@dataclass(frozen=True)
class Config:
    api_id: int
    api_hash: str
    session: str
    chats: list
    api_url: str
    token: str
    max_text: int = 1000
    min_text: int = 5


def load_config(env: Optional[dict] = None) -> Config:
    """Baca konfigurasi dari environment. Raise SystemExit dengan pesan jelas bila ada yang kurang."""
    e = os.environ if env is None else env
    missing = [k for k in ("TG_API_ID", "TG_API_HASH", "INGEST_TOKEN") if not e.get(k, "").strip()]
    if missing:
        raise SystemExit(f"Konfigurasi kurang: {', '.join(missing)} (lihat .env.example)")
    try:
        api_id = int(e["TG_API_ID"].strip())
    except ValueError:
        raise SystemExit("TG_API_ID harus berupa angka")
    api_url = e.get("API_URL", "http://localhost:3000").strip().rstrip("/")
    if not re.match(r"^https?://", api_url):
        raise SystemExit("API_URL harus diawali http:// atau https://")
    chats = [c.strip() for c in e.get("TG_CHATS", "").split(",") if c.strip()]
    return Config(
        api_id=api_id,
        api_hash=e["TG_API_HASH"].strip(),
        session=e.get("TG_SESSION", "session/replybot").strip(),
        chats=chats,
        api_url=api_url,
        token=e["INGEST_TOKEN"].strip(),
    )


def parse_chat_ref(raw: str) -> ChatRef:
    """Ubah entri TG_CHATS menjadi id (int) atau username (str)."""
    s = raw.strip()
    if re.fullmatch(r"-?\d+", s):
        return int(s)
    s = re.sub(r"^(https?://)?(www\.)?(t|telegram)\.me/", "", s)
    if s.startswith("+") or s.startswith("joinchat"):
        raise ValueError(f"Link undangan tidak didukung ({raw!r}). Pakai id dari `python worker.py chats`.")
    m = re.fullmatch(r"c/(\d+)(/.*)?", s)  # t.me/c/<id>/<msg> = grup privat
    if m:
        return int(f"-100{m.group(1)}")
    s = s.lstrip("@").split("/")[0].split("?")[0]
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{3,}", s):
        raise ValueError(f"Referensi grup tidak valid: {raw!r}")
    return s


# --------------------------------------------------------------------------- payload
def build_post_url(chat_username: Optional[str], chat_id: int, is_channel_like: bool, msg_id: int, sender_id: int) -> str:
    if chat_username:
        return f"https://t.me/{chat_username}/{msg_id}"
    if is_channel_like:  # supergroup privat: id positif tanpa prefix -100
        return f"https://t.me/c/{chat_id}/{msg_id}"
    return f"tg://user?id={sender_id}"  # grup biasa tidak punya link pesan


def build_payload(
    *,
    text: str,
    msg_id: int,
    date,
    chat_id: int,
    chat_username: Optional[str],
    is_channel_like: bool,
    sender_id: int,
    sender_username: Optional[str],
    sender_first: Optional[str],
    sender_last: Optional[str],
    max_text: int = 1000,
) -> dict:
    name = " ".join(p for p in (sender_first, sender_last) if p).strip()
    username = sender_username or f"user{sender_id}"
    return {
        "platform": "telegram",
        "external_id": f"{chat_id}:{msg_id}",  # id pesan hanya unik per chat
        "author_username": username,
        "author_name": name or username,
        "content": text.strip()[:max_text],
        "post_url": build_post_url(chat_username, chat_id, is_channel_like, msg_id, sender_id),
        "posted_at": date.astimezone(timezone.utc).isoformat(),
    }


# --------------------------------------------------------------------------- prefilter
@dataclass
class ProductMatcher:
    """Pra-filter murah: hanya teruskan pesan yang menyebut produk aktif (logika sama dengan server).
    Bila daftar produk belum berhasil dimuat, semua pesan diteruskan (server tetap memfilter)."""

    terms: list = field(default_factory=list)

    def matches(self, text: str) -> bool:
        if not self.terms:
            return True
        low = text.lower()
        return any(t in low for t in self.terms)

    async def refresh(self, http: httpx.AsyncClient, cfg: Config) -> None:
        try:
            r = await http.get(f"{cfg.api_url}/api/products", headers={"Authorization": f"Bearer {cfg.token}"}, timeout=15)
            r.raise_for_status()
            terms: set = set()
            for p in r.json().get("products", []):
                if p.get("isActive", True):
                    terms.update({p["name"].lower(), p["slug"].lower()})
            if terms:
                self.terms = sorted(terms)
                log.info("Pra-filter memuat %d istilah produk", len(self.terms))
        except Exception as exc:  # noqa: BLE001 - jaringan/JSON apa pun: pertahankan daftar lama
            log.warning("Gagal memuat daftar produk (%s); memakai daftar sebelumnya", exc)


# --------------------------------------------------------------------------- delivery
class Ingestor:
    """Antrean terbatas + pengiriman dengan retry/backoff ke POST /api/leads/ingest."""

    def __init__(self, cfg: Config, http: httpx.AsyncClient, queue_size: int = 1000, backoff_base: float = 2.0):
        self.url = f"{cfg.api_url}/api/leads/ingest"
        self.headers = {"Authorization": f"Bearer {cfg.token}"}
        self.http = http
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=queue_size)
        self.backoff_base = backoff_base

    def submit(self, payload: dict) -> None:
        if self.queue.full():
            self.queue.get_nowait()  # buang yang tertua agar yang baru tetap masuk
            log.warning("Antrean penuh, pesan tertua dibuang")
        self.queue.put_nowait(payload)

    async def deliver(self, payload: dict) -> bool:
        delay = self.backoff_base
        while True:
            try:
                r = await self.http.post(self.url, json=payload, headers=self.headers, timeout=15)
            except httpx.HTTPError as exc:
                log.warning("Server tidak terjangkau (%s), coba lagi %.0fs", exc.__class__.__name__, delay)
            else:
                if r.status_code == 200:
                    log.info("ingest %s -> %s", payload["external_id"], r.json().get("status"))
                    return True
                if r.status_code in (401, 403):
                    log.error("Token ditolak server (HTTP %d). Periksa INGEST_TOKEN.", r.status_code)
                    return False
                if r.status_code == 429 or r.status_code >= 500:
                    log.warning("Server HTTP %d, coba lagi %.0fs", r.status_code, delay)
                else:
                    log.warning("Payload ditolak (HTTP %d), dibuang", r.status_code)
                    return False
            await asyncio.sleep(delay)
            delay = min(delay * 2, 60)

    async def run(self) -> None:
        while True:
            payload = await self.queue.get()
            try:
                await self.deliver(payload)
            finally:
                self.queue.task_done()


# --------------------------------------------------------------------------- telegram
def _make_client(cfg: Config):
    from telethon import TelegramClient

    session_dir = os.path.dirname(cfg.session)
    if session_dir:
        os.makedirs(session_dir, mode=0o700, exist_ok=True)
    # connection_retries=-1: terus mencoba tersambung ulang tanpa batas
    return TelegramClient(cfg.session, cfg.api_id, cfg.api_hash, connection_retries=-1)


async def list_chats(cfg: Config) -> None:
    client = _make_client(cfg)
    await client.start()
    print(f"{'ID':>16}  {'TIPE':<10} {'USERNAME':<22} NAMA")
    async for d in client.iter_dialogs():
        if d.is_group or d.is_channel:
            kind = "channel" if (d.is_channel and not d.is_group) else "grup"
            uname = f"@{d.entity.username}" if getattr(d.entity, "username", None) else "-"
            print(f"{d.id:>16}  {kind:<10} {uname:<22} {d.name}")
    await client.disconnect()


async def resolve_chats(client, refs: list) -> list:
    entities = []
    for raw in refs:
        try:
            entities.append(await client.get_entity(parse_chat_ref(raw)))
            log.info("Memantau: %s", raw)
        except Exception as exc:  # noqa: BLE001
            log.error("Lewati %r: %s", raw, exc)
    return entities


async def run(cfg: Config) -> None:
    from telethon import events
    from telethon.tl.types import Channel, User

    if not cfg.chats:
        raise SystemExit("TG_CHATS kosong. Jalankan `python worker.py chats` lalu isi id grup ke .env")

    client = _make_client(cfg)
    await client.start()  # pertama kali: tanya nomor HP, kode OTP, (2FA) secara interaktif
    entities = await resolve_chats(client, cfg.chats)
    if not entities:
        raise SystemExit("Tidak ada grup yang bisa dipantau.")

    async with httpx.AsyncClient() as http:
        matcher = ProductMatcher()
        ingestor = Ingestor(cfg, http)
        await matcher.refresh(http, cfg)

        @client.on(events.NewMessage(chats=entities, incoming=True))
        async def on_message(event) -> None:
            msg = event.message
            text = (event.raw_text or "").strip()
            if len(text) < cfg.min_text or msg.fwd_from is not None:  # abaikan forward/broadcast
                return
            sender = await event.get_sender()
            if not isinstance(sender, User) or sender.bot:
                return
            if not matcher.matches(text):
                return
            chat = await event.get_chat()
            ingestor.submit(
                build_payload(
                    text=text,
                    msg_id=msg.id,
                    date=msg.date,
                    chat_id=chat.id,
                    chat_username=getattr(chat, "username", None),
                    is_channel_like=isinstance(chat, Channel),
                    sender_id=sender.id,
                    sender_username=sender.username,
                    sender_first=sender.first_name,
                    sender_last=sender.last_name,
                    max_text=cfg.max_text,
                )
            )

        async def refresh_loop() -> None:
            while True:
                await asyncio.sleep(600)
                await matcher.refresh(http, cfg)

        tasks = [asyncio.create_task(ingestor.run()), asyncio.create_task(refresh_loop())]
        log.info("Worker aktif. Ctrl+C untuk berhenti.")
        try:
            await client.run_until_disconnected()
        finally:
            for t in tasks:
                t.cancel()
            await client.disconnect()


def main(argv: Optional[list] = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", nargs="?", default="run", choices=["run", "chats"])
    args = parser.parse_args(argv)

    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    cfg = load_config()
    try:
        asyncio.run(list_chats(cfg) if args.command == "chats" else run(cfg))
    except KeyboardInterrupt:
        log.info("Dihentikan.")


if __name__ == "__main__":
    main()

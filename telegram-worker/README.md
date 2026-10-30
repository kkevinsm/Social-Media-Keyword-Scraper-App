# Telegram Worker

Memantau grup/channel Telegram yang Anda ikuti (via akun Anda, MTProto/Telethon) dan meneruskan pesan calon pembeli ke dashboard ReplyBot (`POST /api/leads/ingest`).

**Read-only:** worker tidak pernah mengirim pesan/DM. Balasan tetap Anda kirim sendiri dari dashboard.

## Setup
```sh
cd telegram-worker
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env     # lalu isi nilainya
```
1. Buka https://my.telegram.org → *API development tools* → buat app → salin `api_id` & `api_hash` ke `.env`.
2. Isi `INGEST_TOKEN` dengan nilai `INGESTION_SECRET_KEY` dari `web/.env`, dan `API_URL` (mis. `http://localhost:3000`).
3. Lihat daftar grup beserta id-nya (login pertama kali: nomor HP, kode OTP, 2FA bila ada):
   ```sh
   .venv/bin/python worker.py chats
   ```
4. Isi `TG_CHATS` di `.env` dengan id/username grup target (pisahkan koma), lalu jalankan:
   ```sh
   .venv/bin/python worker.py run
   ```

## Cara kerja
- Pesan baru → abaikan: pesan pendek, forward/broadcast, bot, dan pengirim non-user.
- **Pra-filter:** hanya pesan yang menyebut produk aktif (daftar diambil dari `/api/products`, disegarkan tiap 10 menit) yang dikirim. Filter niat-beli & penjual tetap dijalankan server.
- Pengiriman memakai antrean (maks. 1000) dengan retry/backoff bila server/jaringan bermasalah. Antrean ada di memori: pesan yang belum terkirim hilang bila worker dimatikan.
- `external_id` = `<chat_id>:<message_id>`, jadi aman dari duplikat.
- Link balasan: grup publik → `t.me/<grup>/<id>`, supergroup privat → `t.me/c/<id>/<msg>`, grup biasa → `tg://user?id=<id>` (grup biasa tak punya link pesan).

## Keamanan
- File `session/*.session` = akses penuh ke akun Telegram Anda. Jangan di-commit atau dibagikan (sudah di `.gitignore`).
- Link undangan (`t.me/+xxx`) tidak didukung; gabung dulu secara manual lalu pakai id dari perintah `chats`.

## Tes
```sh
.venv/bin/python -m unittest -v
```
Mencakup parsing konfigurasi/grup, pembuatan payload, pra-filter, dan retry pengiriman (tanpa akun Telegram).

## Menjalankan 24/7
Untuk tahap pengembangan cukup jalankan di laptop. Untuk produksi, jalankan di VPS kecil (mis. dengan `systemd` atau `tmux`); login pertama (OTP) tetap harus interaktif.


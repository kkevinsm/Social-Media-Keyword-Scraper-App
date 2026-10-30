import asyncio
import unittest
from datetime import datetime, timedelta, timezone

import httpx

import worker as w

ENV = {"TG_API_ID": "123", "TG_API_HASH": "abc", "INGEST_TOKEN": "tok", "API_URL": "http://x.test/"}


def make_cfg(**over):
    return w.load_config({**ENV, **over})


class ConfigTests(unittest.TestCase):
    def test_ok_and_trailing_slash_stripped(self):
        c = make_cfg(TG_CHATS="@grupa, 12345 ,")
        self.assertEqual(c.api_url, "http://x.test")
        self.assertEqual(c.chats, ["@grupa", "12345"])

    def test_missing_required(self):
        with self.assertRaises(SystemExit):
            w.load_config({"TG_API_ID": "1"})

    def test_bad_api_id_and_url(self):
        with self.assertRaises(SystemExit):
            make_cfg(TG_API_ID="abc")
        with self.assertRaises(SystemExit):
            make_cfg(API_URL="ftp://x")


class ParseChatTests(unittest.TestCase):
    def test_variants(self):
        self.assertEqual(w.parse_chat_ref("-1001234567890"), -1001234567890)
        self.assertEqual(w.parse_chat_ref("@jualbeli_id"), "jualbeli_id")
        self.assertEqual(w.parse_chat_ref("https://t.me/jualbeli_id"), "jualbeli_id")
        self.assertEqual(w.parse_chat_ref("t.me/jualbeli_id/55"), "jualbeli_id")
        self.assertEqual(w.parse_chat_ref("https://t.me/c/1234567890/12"), -1001234567890)

    def test_invite_and_garbage_rejected(self):
        for bad in ("https://t.me/+AbCdEf", "t.me/joinchat/xyz", "!!", "ab"):
            with self.assertRaises(ValueError, msg=bad):
                w.parse_chat_ref(bad)


class PayloadTests(unittest.TestCase):
    base = dict(
        text="  butuh netflix 1 bulan  ",
        msg_id=7,
        date=datetime(2026, 10, 30, 17, 0, tzinfo=timezone(timedelta(hours=7))),
        chat_id=999,
        chat_username=None,
        is_channel_like=True,
        sender_id=42,
        sender_username=None,
        sender_first="Budi",
        sender_last=None,
    )

    def test_private_supergroup_no_username(self):
        p = w.build_payload(**self.base)
        self.assertEqual(p["external_id"], "999:7")
        self.assertEqual(p["author_username"], "user42")
        self.assertEqual(p["author_name"], "Budi")
        self.assertEqual(p["content"], "butuh netflix 1 bulan")
        self.assertEqual(p["post_url"], "https://t.me/c/999/7")
        self.assertEqual(p["posted_at"], "2026-10-30T10:00:00+00:00")  # dinormalkan ke UTC
        self.assertEqual(p["platform"], "telegram")

    def test_public_group_link(self):
        p = w.build_payload(**{**self.base, "chat_username": "jualbeli", "sender_username": "budi99"})
        self.assertEqual(p["post_url"], "https://t.me/jualbeli/7")
        self.assertEqual(p["author_username"], "budi99")

    def test_basic_group_falls_back_to_user_link(self):
        p = w.build_payload(**{**self.base, "is_channel_like": False})
        self.assertEqual(p["post_url"], "tg://user?id=42")

    def test_text_truncated(self):
        p = w.build_payload(**{**self.base, "text": "x" * 5000, "max_text": 100})
        self.assertEqual(len(p["content"]), 100)

    def test_same_msg_id_in_different_chats_not_colliding(self):
        a = w.build_payload(**self.base)
        b = w.build_payload(**{**self.base, "chat_id": 1000})
        self.assertNotEqual(a["external_id"], b["external_id"])


class MatcherTests(unittest.TestCase):
    def test_empty_terms_passes_everything(self):
        self.assertTrue(w.ProductMatcher().matches("apa saja"))

    def test_matches_name_or_slug_case_insensitive(self):
        m = w.ProductMatcher(terms=["netflix", "prime-video"])
        self.assertTrue(m.matches("Butuh NETFLIX dong"))
        self.assertFalse(m.matches("butuh sepatu"))

    def test_refresh_loads_active_only_and_survives_failure(self):
        def handler(req):
            self.assertEqual(req.headers["authorization"], "Bearer tok")
            return httpx.Response(200, json={"products": [
                {"name": "Netflix", "slug": "netflix", "isActive": True},
                {"name": "Canva", "slug": "canva", "isActive": False},
            ]})

        async def go():
            m = w.ProductMatcher()
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as h:
                await m.refresh(h, make_cfg())
            self.assertEqual(m.terms, ["netflix"])
            async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(500))) as h:
                await m.refresh(h, make_cfg())
            self.assertEqual(m.terms, ["netflix"])  # daftar lama dipertahankan

        asyncio.run(go())


class IngestorTests(unittest.TestCase):
    def _run(self, responses, payload=None):
        calls = []

        def handler(req):
            calls.append(req)
            r = responses[min(len(calls) - 1, len(responses) - 1)]
            if isinstance(r, Exception):
                raise r
            return httpx.Response(r, json={"status": "success"})

        async def go():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as h:
                ing = w.Ingestor(make_cfg(), h, backoff_base=0.001)
                ok = await ing.deliver(payload or {"external_id": "1:1"})
            return ok

        return asyncio.run(go()), calls

    def test_success_sends_bearer_to_ingest_path(self):
        ok, calls = self._run([200])
        self.assertTrue(ok)
        self.assertEqual(str(calls[0].url), "http://x.test/api/leads/ingest")
        self.assertEqual(calls[0].headers["authorization"], "Bearer tok")

    def test_retries_5xx_429_and_network_error_then_succeeds(self):
        ok, calls = self._run([503, 429, httpx.ConnectError("down"), 200])
        self.assertTrue(ok)
        self.assertEqual(len(calls), 4)

    def test_auth_failure_and_bad_payload_are_dropped_without_retry(self):
        for code in (401, 403, 400):
            ok, calls = self._run([code])
            self.assertFalse(ok)
            self.assertEqual(len(calls), 1, code)

    def test_full_queue_drops_oldest(self):
        async def go():
            async with httpx.AsyncClient() as h:
                ing = w.Ingestor(make_cfg(), h, queue_size=2)
                for i in range(3):
                    ing.submit({"external_id": str(i)})
                return [ing.queue.get_nowait()["external_id"] for _ in range(2)]

        self.assertEqual(asyncio.run(go()), ["1", "2"])


if __name__ == "__main__":
    unittest.main()


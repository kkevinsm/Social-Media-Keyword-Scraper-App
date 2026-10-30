# ReplyBot Lead Collector (Chrome Extension)

Membaca postingan yang tampil di tab pencarian **X** dan **Threads** (dari browser & login Anda sendiri), lalu mengirimnya ke dashboard `POST /api/leads/ingest`.

## Pasang
1. Buka `chrome://extensions` → aktifkan **Developer mode**.
2. **Load unpacked** → pilih folder `extension/` ini.
3. Klik ikon extension → **Pengaturan** → isi **URL dashboard** dan **Ingestion token** (`INGESTION_SECRET_KEY` di `web/.env`) → **Tes koneksi**.

## Pakai
- Buka pencarian, mis. `https://x.com/search?q=butuh%20netflix&f=live` atau pencarian Threads. Postingan yang tampil dikirim otomatis; filter niat-beli/penjual dilakukan server.
- "Muat ulang pencarian" (popup) default **mati**. Jika dinyalakan, minimal tiap 2 menit; interval pendek meningkatkan risiko pembatasan akun.

## Catatan
- Origin yang diizinkan: `localhost`, `127.0.0.1`, `*.vercel.app`. Untuk domain kustom, tambahkan ke `host_permissions` di `manifest.json`.
- Selector DOM X/Threads bisa berubah sewaktu-waktu; parser Threads bersifat best-effort. Jika tidak ada lead masuk, kemungkinan besar selector perlu diperbarui di `src/content.js`.


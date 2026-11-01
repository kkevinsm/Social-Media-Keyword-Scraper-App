# ReplyBot - Social Media Keyword Scraper & CRM

Aplikasi otomatisasi pencari calon pembeli (Leads Finder) produk digital di **X.com**, **Threads**, dan **Telegram** dengan Dashboard CRM dan integrasi **Supabase** serta siap deploy ke **Vercel**.

---

## Struktur Proyek

```text
reply-bot/
├── web/               # Next.js 16 Web Dashboard CRM + API Ingest (Vercel Ready)
├── extension/         # Chrome Extension Manifest V3 (Scraper X & Threads)
├── telegram-worker/   # Python Worker Telethon MTProto Listener (Telegram)
└── SUPABASE_SETUP.md  # Panduan integrasi database Supabase
```

---

## Fitur Utama

1. **Dashboard Peluang Real-Time:**
   * Filter tab: Baru, Ditindaklanjuti, Selesai, Diabaikan.
   * Highlight kata kunci intent beli secara otomatis.
   * Tombol *1-Click "Balas Pakai Template"* yang langsung menyalin copywriting penawaran dan membuka postingan pembeli.
   * Ekspor data leads ke CSV.
2. **Keamanan Login Admin:**
   * Dilindungi sistem autentikasi session cookie (Username & Password).
   * Endpoint Ingestion aman dengan proteksi Bearer Token.
3. **Smart Negation Filter:**
   * Memfilter dan membuang tweet/chat dari sesama penjual (*WTS, ready stock, open slot, testi*, dll).
4. **Database Cloud:**
   * Terintegrasi dengan **Supabase PostgreSQL** via Prisma ORM.

---

## Cara Menjalankan

### 1. Web Dashboard
```bash
cd web
npm install
npm run dev
```
Buka di browser: `http://localhost:3000` (Login: `admin` / `admin123`).

### 2. Chrome Extension
1. Buka `chrome://extensions` di Google Chrome -> Aktifkan **Developer mode**.
2. Klik **Load unpacked** -> Pilih folder `extension/`.
3. Buka Pengaturan extension dan masukkan URL dashboard serta ingestion token Anda.

### 3. Telegram Worker
```bash
cd telegram-worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python worker.py chats
python worker.py run
```


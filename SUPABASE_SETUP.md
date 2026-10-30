# Panduan Setup Supabase & Deploy ke Vercel

Dokumen ini memandu Anda menghubungkan **Supabase (PostgreSQL Cloud)** ke aplikasi **ReplyBot** untuk dideploy ke **Vercel**.

---

## Langkah 1: Buat Database di Supabase (Gratis)

1. Buka [https://supabase.com](https://supabase.com) dan login / sign up.
2. Klik **"New project"**.
3. Isi data:
   * **Name:** `reply-bot`
   * **Database Password:** Buat password yang kuat dan **simpan/ingat password ini**.
   * **Region:** Pilih yang terdekat (misal: *Singapore*).
4. Klik **"Create new project"** dan tunggu ~1-2 menit hingga database selesai dibuat.

---

## Langkah 2: Ambil Connection String Supabase

1. Di dashboard Supabase, buka menu **Project Settings** (ikon gerigi di kiri bawah) -> **Database**.
2. Gulir ke bawah ke bagian **Connection string**.
3. Pilih tab **URI**:
   * Mode: **Transaction** (Port `6543`) -> Ini untuk `DATABASE_URL` (Connection Pooling).
   * Mode: **Session** (Port `5432`) -> Ini untuk `DIRECT_URL`.
4. Ganti `[YOUR-PASSWORD]` dengan password database yang Anda buat di Langkah 1.

Contoh hasil URI:
```env
DATABASE_URL="postgresql://postgres.xxxxxx:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxxxx:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

---

## Langkah 3: Push Schema & Seed Awal ke Supabase

Dari laptop Anda, jalankan perintah ini sekali saja untuk membuat tabel dan mengisi 9 produk bawaan ke database Supabase:

```bash
cd web

# 1. Ganti schema ke PostgreSQL
cp prisma/schema.supabase.prisma prisma/schema.prisma

# 2. Push tabel ke Supabase (ganti URL di bawah dengan milik Anda)
DATABASE_URL="postgresql://postgres.xxxxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" \
DIRECT_URL="postgresql://postgres.xxxxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" \
npx prisma db push

# 3. Masukkan 9 produk bawaan (Netflix, Canva, dll)
DATABASE_URL="postgresql://postgres.xxxxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" \
node prisma/seed.js
```

---

## Langkah 4: Deploy ke Vercel

1. Buka [https://vercel.com](https://vercel.com) -> Klik **"Add New..."** -> **"Project"**.
2. Hubungkan repository GitHub Anda yang berisi project `reply-bot`.
3. Di pengaturan proyek Vercel:
   * **Root Directory:** Pilih `web`
4. Di bagian **Environment Variables**, masukkan 3 kunci ini:
   * `DATABASE_URL`: *(URI Transaction Pooler Supabase Anda)*
   * `DIRECT_URL`: *(URI Session Supabase Anda)*
   * `INGESTION_SECRET_KEY`: *(Token rahasia bebas, misal: `rahasia_replybot_998877`)*
   * `ADMIN_USERNAME`: *(Username login admin, default: `admin`)*
   * `ADMIN_PASSWORD`: *(Password login admin Anda)*
5. Klik **"Deploy"**.

---

## Langkah 5: Hubungkan Extension & Telegram

Setelah website Anda aktif di Vercel (misal `https://reply-bot-anda.vercel.app`):
1. Buka pengaturan **Chrome Extension**:
   * Ganti URL ke: `https://reply-bot-anda.vercel.app`
   * Masukkan Token: nilai `INGESTION_SECRET_KEY` Anda.
2. Di file `.env` **Telegram Worker**:
   * Ganti `API_URL` ke: `https://reply-bot-anda.vercel.app`
   * Ganti `INGEST_TOKEN` ke: nilai `INGESTION_SECRET_KEY` Anda.


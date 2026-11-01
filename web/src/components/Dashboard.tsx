'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clock, Download, ExternalLink, LogOut, RefreshCw, Search, Settings, Sparkles, X } from 'lucide-react'
import LeadCard from './LeadCard'
import SearchXModal from './SearchXModal'
import type { LeadCounts, LeadDTO, LeadStatus, ProductDTO } from '@/lib/types'
import { formatLiveClock } from '@/lib/utils'
import { DEFAULT_HASHTAGS, DEFAULT_INTENT_KEYWORDS, DEFAULT_NEGATIVE_KEYWORDS } from '@/lib/settings'

type Tab = 'semua' | LeadStatus
const TABS: { key: Tab; label: string }[] = [
  { key: 'semua', label: 'Semua' },
  { key: 'baru', label: 'Baru' },
  { key: 'ditindaklanjuti', label: 'Ditindaklanjuti' },
  { key: 'selesai', label: 'Selesai' },
  { key: 'abaikan', label: 'Diabaikan' },
]
const EMPTY_COUNTS: LeadCounts = { semua: 0, baru: 0, ditindaklanjuti: 0, selesai: 0, abaikan: 0 }

export default function Dashboard() {
  const router = useRouter()
  const [leads, setLeads] = useState<LeadDTO[]>([])
  const [counts, setCounts] = useState<LeadCounts>(EMPTY_COUNTS)
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [tab, setTab] = useState<Tab>('semua')
  const [product, setProduct] = useState('semua')
  const [platform, setPlatform] = useState('semua')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [auto, setAuto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  // Search in X Modal State (Screenshot 2)
  const [isSearchXOpen, setIsSearchXOpen] = useState(false)
  const [settings, setSettings] = useState({
    hashtags: DEFAULT_HASHTAGS,
    intentKeywords: DEFAULT_INTENT_KEYWORDS,
    negativeKeywords: DEFAULT_NEGATIVE_KEYWORDS,
  })

  // Bookmarklet Quick Capture Modal State
  const [quickSaveOpen, setQuickSaveOpen] = useState(false)
  const [quickUrl, setQuickUrl] = useState('')
  const [quickText, setQuickText] = useState('')
  const [quickProductId, setQuickProductId] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)

  // Live realtime clock yang berdetik setiap detik
  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => {})

    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setSettings({
            hashtags: d.settings.hashtags || DEFAULT_HASHTAGS,
            intentKeywords: d.settings.intentKeywords || DEFAULT_INTENT_KEYWORDS,
            negativeKeywords: d.settings.negativeKeywords || DEFAULT_NEGATIVE_KEYWORDS,
          })
        }
      })
      .catch(() => {})
  }, [])

  // Check URL query parameters for Bookmarklet invocation (?action=save&url=...&text=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('action') === 'save') {
        const url = sp.get('url') || ''
        const text = sp.get('text') || ''
        setQuickUrl(url)
        setQuickText(text)
        setQuickSaveOpen(true)
      }
    }
  }, [])

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const qs = new URLSearchParams({ status: tab, product, platform, search: debounced, limit: '100' })
        const res = await fetch(`/api/leads?${qs}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setLeads(data.leads)
        setCounts(data.counts)
        setUpdatedAt(new Date())
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat data')
      } finally {
        setLoading(false)
      }
    },
    [tab, product, platform, debounced]
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => load(true), 15000)
    return () => clearInterval(id)
  }, [auto, load])

  async function updateStatus(id: string, status: LeadStatus) {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) load(true)
  }

  async function remove(id: string) {
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (res.ok) load(true)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  async function handleScrapeXApi() {
    setScraping(true)
    setScrapeMsg('Sedang menarik tweet via API X dengan filter ketat...')
    try {
      const res = await fetch('/api/scrape/x-api', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setScrapeMsg(`Selesai! ${data.savedLeads || 0} leads baru disimpan (dari ${data.totalFetched || 0} tweet).`)
        load(true)
      } else {
        setScrapeMsg(`Gagal: ${data.error || 'Terjadi kesalahan'}`)
      }
    } catch {
      setScrapeMsg('Gagal menghubungkan ke server')
    } finally {
      setScraping(false)
      setTimeout(() => setScrapeMsg(null), 5000)
    }
  }

  async function handleQuickSaveLead(e: React.FormEvent) {
    e.preventDefault()
    setQuickSaving(true)
    try {
      // Parse username from tweet URL
      const m = quickUrl.match(/(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/)
      const username = m ? m[1] : 'anon'
      const extId = m ? m[2] : String(Date.now())

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'x',
          externalId: extId,
          authorUsername: username,
          authorName: username,
          content: quickText,
          postUrl: quickUrl,
          matchedProductId: quickProductId || null,
        }),
      })

      if (res.ok) {
        setQuickSaveOpen(false)
        load(true)
        // Clean URL params
        window.history.replaceState({}, '', '/')
      } else {
        alert('Gagal menyimpan peluang')
      }
    } finally {
      setQuickSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Peluang masuk</h1>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">{counts.baru} baru</span>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          {/* Tombol Cari Calon Pembeli di X (Screenshot 2) */}
          <button
            onClick={() => setIsSearchXOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-3.5 py-1.5 font-bold text-rose-900 shadow-xs transition hover:bg-rose-100"
            title="Cari calon pembeli di X secara langsung (Gratis tanpa API)"
          >
            <Sparkles size={14} className="text-rose-600" />
            Cari di X (Gratis)
          </button>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 font-medium">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Otomatis: {auto ? 'nyala' : 'mati'}
          </label>
          <button onClick={() => load()} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 font-medium hover:bg-white">
            <RefreshCw size={14} /> Segarkan
          </button>
          <button
            onClick={handleScrapeXApi}
            disabled={scraping}
            className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3.5 py-1.5 font-semibold text-sky-800 shadow-sm transition hover:bg-sky-100 disabled:opacity-50"
            title="Tarik calon pembeli terbaru dari X via API"
          >
            <Sparkles size={14} className={scraping ? 'animate-spin' : 'text-sky-600'} />
            {scraping ? 'Menarik...' : 'Tarik via API X'}
          </button>
          <a href="/api/leads/export" className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 font-medium hover:bg-white">
            <Download size={14} /> Ekspor CSV
          </a>
          <Link href="/pengaturan" className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 font-semibold text-white">
            <Settings size={14} /> Pengaturan
          </Link>
          <button
            onClick={handleLogout}
            title="Keluar"
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white/80 px-3 py-1.5 font-medium text-rose-700 hover:bg-rose-50"
          >
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </header>

      {/* Realtime Live Clock & Sync Indicator */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-white/90 px-3.5 py-1.5 font-medium shadow-xs backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <Clock size={13} className="text-slate-500" />
          <span>
            Waktu saat ini:{' '}
            <strong className="font-semibold text-slate-800">
              {currentTime ? formatLiveClock(currentTime) : 'Menghitung waktu...'}
            </strong>
          </span>
        </div>
        {updatedAt && (
          <span className="text-slate-500">
            Terakhir disegarkan: <strong className="text-slate-700">{updatedAt.toLocaleTimeString('id-ID')} WIB</strong>
          </span>
        )}
      </div>

      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-brand-border" aria-label="Status peluang">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${
              tab === t.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label} <span className="ml-1 rounded-full bg-white/80 px-2 py-0.5 text-xs">{counts[t.key]}</span>
          </button>
        ))}
      </nav>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari username, isi postingan…"
            className="w-full rounded-full border border-brand-border bg-white/90 py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>
        <select value={product} onChange={(e) => setProduct(e.target.value)} className="rounded-full border border-brand-border bg-white/90 px-4 py-2.5" aria-label="Filter produk">
          <option value="semua">Semua produk</option>
          {products.map((p) => (
            <option key={p.id} value={p.slug}>{p.name}</option>
          ))}
        </select>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-full border border-brand-border bg-white/90 px-4 py-2.5" aria-label="Filter platform">
          <option value="semua">Semua platform</option>
          <option value="x">X</option>
          <option value="threads">Threads</option>
          <option value="telegram">Telegram</option>
        </select>
      </div>

      {scrapeMsg && (
        <div
          role="status"
          className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-800 animate-in fade-in"
        >
          {scrapeMsg}
        </div>
      )}
      {updatedAt && (
        <p className="mt-3 text-xs text-slate-500">Diperbarui {updatedAt.toLocaleTimeString('id-ID')}</p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Gagal memuat: {error}</p>
      )}

      <section className="mt-4 grid gap-4 md:grid-cols-2" aria-live="polite">
        {loading && !leads.length ? (
          <p className="col-span-full py-16 text-center text-slate-500">Memuat…</p>
        ) : leads.length ? (
          leads.map((l) => <LeadCard key={l.id} lead={l} onStatus={updateStatus} onDelete={remove} />)
        ) : (
          <div className="col-span-full rounded-3xl bg-white/70 py-16 text-center text-slate-500">
            <p className="font-semibold text-slate-700">Belum ada peluang yang cocok.</p>
            <p className="mt-1 text-sm">
              Gunakan tombol <strong>Cari di X (Gratis)</strong> di atas untuk membuka percakapan calon pembeli terbaru di X, atau tarik via API.
            </p>
          </div>
        )}
      </section>

      {/* Modal: Cari calon pembeli di X (Screenshot 2) */}
      <SearchXModal
        isOpen={isSearchXOpen}
        onClose={() => setIsSearchXOpen(false)}
        products={products}
        hashtags={settings.hashtags}
        intentKeywords={settings.intentKeywords}
        negativeKeywords={settings.negativeKeywords}
      />

      {/* Modal: Simpan Peluang dari Bookmarklet X */}
      {quickSaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-brand-border bg-white p-6 shadow-2xl">
            <button
              onClick={() => {
                setQuickSaveOpen(false)
                window.history.replaceState({}, '', '/')
              }}
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
            <h3 className="text-xl font-black text-slate-900">🍓 Simpan Peluang dari X</h3>
            <p className="mt-1 text-xs text-slate-600">
              Postingan yang Anda simpan dari bookmarklet X akan langsung dimasukkan ke daftar peluang.
            </p>

            <form onSubmit={handleQuickSaveLead} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Link Postingan X</label>
                <input
                  type="url"
                  required
                  value={quickUrl}
                  onChange={(e) => setQuickUrl(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs outline-none focus:border-brand focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Teks Postingan</label>
                <textarea
                  rows={4}
                  required
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-brand focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Pilih Produk</label>
                <select
                  value={quickProductId}
                  onChange={(e) => setQuickProductId(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs outline-none focus:border-brand focus:bg-white"
                >
                  <option value="">Deteksi Otomatis / Umum</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuickSaveOpen(false)
                    window.history.replaceState({}, '', '/')
                  }}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={quickSaving}
                  className="rounded-full bg-brand px-6 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand/90 disabled:opacity-50"
                >
                  {quickSaving ? 'Menyimpan...' : 'Simpan Peluang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, LogOut, RefreshCw, Search, Settings } from 'lucide-react'
import LeadCard from './LeadCard'
import type { LeadCounts, LeadDTO, LeadStatus, ProductDTO } from '@/lib/types'

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
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => { })
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Peluang masuk</h1>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">{counts.baru} baru</span>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 font-medium">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Otomatis: {auto ? 'nyala' : 'mati'}
          </label>
          <button onClick={() => load()} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 font-medium hover:bg-white">
            <RefreshCw size={14} /> Segarkan
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

      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-brand-border" aria-label="Status peluang">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === t.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
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
          <p className="col-span-full rounded-3xl bg-white/70 py-16 text-center text-slate-500">
            Belum ada peluang. Pasang Chrome Extension lalu buka pencarian X / Threads.
          </p>
        )}
      </section>
    </div>
  )
}


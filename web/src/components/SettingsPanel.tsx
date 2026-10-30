'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LogOut, Plus, Save, Trash2 } from 'lucide-react'
import type { ProductDTO } from '@/lib/types'

interface Rule { id: string; intentKeywords: string; negativeKeywords: string; hashtags: string }
type ProductFull = ProductDTO & { rules: Rule[] }

function ProductEditor({ product, onChanged }: { product: ProductFull; onChanged: () => void }) {
  const rule = product.rules[0]
  const tpl = product.templates?.[0]
  const [intent, setIntent] = useState(rule?.intentKeywords ?? '')
  const [negative, setNegative] = useState(rule?.negativeKeywords ?? '')
  const [tags, setTags] = useState(rule?.hashtags ?? '')
  const [body, setBody] = useState(tpl?.bodyText ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function save() {
    setSaving(true)
    setMsg('')
    try {
      const r1 = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentKeywords: intent, negativeKeywords: negative, hashtags: tags }),
      })
      const r2 = tpl
        ? await fetch(`/api/templates/${tpl.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bodyText: body }),
        })
        : r1
      setMsg(r1.ok && r2.ok ? 'Tersimpan ✓' : 'Gagal menyimpan')
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function toggle() {
    await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !product.isActive }),
    })
    onChanged()
  }

  async function remove() {
    if (!confirm(`Hapus produk ${product.name} beserta aturannya?`)) return
    await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    onChanged()
  }

  const field = 'mt-1 w-full rounded-2xl border border-brand-border bg-white px-3 py-2 text-sm'

  return (
    <details className="rounded-3xl border border-brand-border bg-white/90 p-4">
      <summary className="flex cursor-pointer items-center gap-3 font-semibold">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft font-bold text-brand">{product.iconText}</span>
        {product.name}
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs ${product.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
          {product.isActive ? 'dipantau' : 'nonaktif'}
        </span>
      </summary>
      <div className="mt-4 grid gap-3">
        <label className="text-sm font-medium">Kata niat beli (pisahkan koma)
          <textarea className={field} rows={2} value={intent} onChange={(e) => setIntent(e.target.value)} />
        </label>
        <label className="text-sm font-medium">Kata yang diabaikan / tanda penjual (pisahkan koma)
          <textarea className={field} rows={2} value={negative} onChange={(e) => setNegative(e.target.value)} />
        </label>
        <label className="text-sm font-medium">Hashtag
          <input className={field} value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <label className="text-sm font-medium">Template balasan <span className="font-normal text-slate-500">(variabel: {'{user}'}, {'{nama_user}'}, {'{produk}'})</span>
          <textarea className={field} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            <Save size={14} /> Simpan
          </button>
          <button onClick={toggle} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium">
            {product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
          <button onClick={remove} className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm text-rose-700">
            <Trash2 size={14} /> Hapus
          </button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </div>
      </div>
    </details>
  )
}

export default function SettingsPanel() {
  const router = useRouter()
  const [products, setProducts] = useState<ProductFull[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const load = useCallback(async () => {
    const res = await fetch('/api/products')
    if (res.ok) setProducts((await res.json()).products)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add() {
    if (!name.trim()) return
    setError('')
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (res.ok) {
      setName('')
      load()
    } else {
      setError((await res.json()).error ?? 'Gagal menambah produk')
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand">
          <ArrowLeft size={14} /> Kembali ke peluang
        </Link>
        <button
          onClick={handleLogout}
          title="Keluar"
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
        >
          <LogOut size={13} /> Keluar
        </button>
      </div>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Produk pantauan</h1>
      <p className="mt-1 text-sm text-slate-600">Atur produk, kata kunci, dan template balasan per produk.</p>

      <div className="mt-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Nama aplikasi baru, mis. Zoom"
          className="flex-1 rounded-full border border-brand-border bg-white px-4 py-2.5"
        />
        <button onClick={add} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 font-semibold text-white">
          <Plus size={16} /> Tambah
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}

      <div className="mt-5 grid gap-3">
        {products.map((p) => (
          <ProductEditor key={`${p.id}-${p.templates?.[0]?.bodyText}`} product={p} onChanged={load} />
        ))}
      </div>

      <section className="mt-8 rounded-3xl border border-brand-border bg-white/90 p-4 text-sm">
        <h2 className="font-bold">Endpoint untuk Extension & Telegram worker</h2>
        <code className="mt-2 block break-all rounded-xl bg-slate-100 px-3 py-2">POST /api/leads/ingest</code>
        <p className="mt-2 text-slate-600">Header <code>Authorization: Bearer &lt;INGESTION_SECRET_KEY&gt;</code>. Nilai kunci ada di file <code>.env</code> Anda.</p>
      </section>
    </div>
  )
}


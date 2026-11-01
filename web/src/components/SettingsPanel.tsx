'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  Hash,
  LogOut,
  Pencil,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import type { ProductDTO } from '@/lib/types'
import { DEFAULT_HASHTAGS, DEFAULT_INTENT_KEYWORDS, DEFAULT_NEGATIVE_KEYWORDS } from '@/lib/settings'

interface Rule {
  id: string
  intentKeywords: string
  negativeKeywords: string
  hashtags: string
}

type ProductFull = ProductDTO & {
  rules?: Rule[]
  templates?: { id: string; bodyText: string; title: string }[]
}

const DEFAULT_APPS = [
  { name: 'Netflix', slug: 'netflix', color: '#E50914', iconText: 'N' },
  { name: 'Canva', slug: 'canva', color: '#00C4CC', iconText: 'C' },
  { name: 'CapCut', slug: 'capcut', color: '#111111', iconText: 'C' },
  { name: 'Spotify', slug: 'spotify', color: '#1DB954', iconText: 'S' },
  { name: 'ChatGPT', slug: 'chatgpt', color: '#10A37F', iconText: 'C' },
  { name: 'YouTube', slug: 'youtube', color: '#FF0000', iconText: 'Y' },
  { name: 'Prime Video', slug: 'prime-video', color: '#00A8E1', iconText: 'P' },
  { name: 'Vidio', slug: 'vidio', color: '#ED1C24', iconText: 'V' },
  { name: 'Disney+', slug: 'disney-plus', color: '#113CCF', iconText: 'D' },
]

export default function SettingsPanel() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'products' | 'keywords'>('products')

  // Products state
  const [products, setProducts] = useState<ProductFull[]>([])
  const [loading, setLoading] = useState(true)

  // Add/Edit Product Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductFull | null>(null)
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState('#ec4899')
  const [formIconText, setFormIconText] = useState('')
  const [formTemplate, setFormTemplate] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Global Keywords State (Screenshot 3)
  const [hashtags, setHashtags] = useState(DEFAULT_HASHTAGS)
  const [intentKeywords, setIntentKeywords] = useState(DEFAULT_INTENT_KEYWORDS)
  const [negativeKeywords, setNegativeKeywords] = useState(DEFAULT_NEGATIVE_KEYWORDS)
  const [savingKeywords, setSavingKeywords] = useState(false)
  const [keywordSuccessMsg, setKeywordSuccessMsg] = useState('')

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [prodRes, setRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/settings'),
      ])

      if (prodRes.ok) {
        const prodData = await prodRes.json()
        setProducts(prodData.products || [])
      }

      if (setRes.ok) {
        const setData = await setRes.json()
        if (setData.settings) {
          setHashtags(setData.settings.hashtags || DEFAULT_HASHTAGS)
          setIntentKeywords(setData.settings.intentKeywords || DEFAULT_INTENT_KEYWORDS)
          setNegativeKeywords(setData.settings.negativeKeywords || DEFAULT_NEGATIVE_KEYWORDS)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Toggle Product Active Checkbox
  async function toggleActive(product: ProductFull) {
    const updated = !product.isActive
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isActive: updated } : p))
    )
    await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: updated }),
    })
  }

  // Delete Product
  async function deleteProduct(product: ProductFull) {
    if (!confirm(`Hapus aplikasi ${product.name}?`)) return
    setProducts((prev) => prev.filter((p) => p.id !== product.id))
    await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
  }

  // Open Modal for Add
  function openAddModal() {
    setEditingProduct(null)
    setFormName('')
    setFormColor('#ec4899')
    setFormIconText('')
    setFormTemplate(
      'Halo kak @{user}! Ready akun {produk} Premium resmi garansi anti on-hold / limit. Harga terjangkau & proses kilat. Langsung DM ya kak! ✨'
    )
    setFormError('')
    setIsModalOpen(true)
  }

  // Open Modal for Edit
  function openEditModal(product: ProductFull) {
    setEditingProduct(product)
    setFormName(product.name)
    setFormColor(product.color || '#ec4899')
    setFormIconText(product.iconText || product.name.charAt(0).toUpperCase())
    setFormTemplate(
      product.templates?.[0]?.bodyText ||
        `Halo kak @{user}! Ready akun ${product.name} Premium resmi garansi. Minat langsung DM ya kak! ✨`
    )
    setFormError('')
    setIsModalOpen(true)
  }

  // Save Add/Edit
  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) {
      setFormError('Nama aplikasi wajib diisi')
      return
    }

    setFormSaving(true)
    setFormError('')

    try {
      if (editingProduct) {
        // Update product
        const res1 = await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            color: formColor,
            iconText: formIconText.trim() || formName.trim().charAt(0).toUpperCase(),
          }),
        })

        const tpl = editingProduct.templates?.[0]
        if (tpl) {
          await fetch(`/api/templates/${tpl.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bodyText: formTemplate }),
          })
        }

        if (!res1.ok) throw new Error('Gagal memperbarui aplikasi')
      } else {
        // Create product
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            color: formColor,
            iconText: formIconText.trim() || formName.trim().charAt(0).toUpperCase(),
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Gagal menambah aplikasi')
        }
      }

      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan')
    } finally {
      setFormSaving(false)
    }
  }

  // Save Global Keywords (Screenshot 3)
  async function handleSaveKeywords(e: React.FormEvent) {
    e.preventDefault()
    setSavingKeywords(true)
    setKeywordSuccessMsg('')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashtags,
          intentKeywords,
          negativeKeywords,
        }),
      })

      if (res.ok) {
        setKeywordSuccessMsg('Pengaturan kata kunci berhasil disimpan! ✓')
        setTimeout(() => setKeywordSuccessMsg(''), 4000)
      } else {
        alert('Gagal menyimpan pengaturan kata kunci')
      }
    } finally {
      setSavingKeywords(false)
    }
  }

  // Check if product is default app
  function isDefaultApp(name: string) {
    return DEFAULT_APPS.some((a) => a.name.toLowerCase() === name.toLowerCase())
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition hover:underline"
        >
          <ArrowLeft size={16} /> Kembali ke peluang
        </Link>
        <button
          onClick={handleLogout}
          title="Keluar"
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          <LogOut size={13} /> Keluar
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="mt-6 flex rounded-2xl border border-brand-border bg-white/60 p-1 backdrop-blur">
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
            activeTab === 'products'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <SlidersHorizontal size={16} className={activeTab === 'products' ? 'text-brand' : ''} />
          Produk pantauan ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('keywords')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
            activeTab === 'keywords'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Hash size={16} className={activeTab === 'keywords' ? 'text-brand' : ''} />
          Hashtag & kata kunci
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: PRODUK PANTAUAN (Screenshot 1) */}
      {/* ========================================================= */}
      {activeTab === 'products' && (
        <div className="mt-6 animate-in fade-in">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <SlidersHorizontal size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Produk pantauan
              </h1>
              <p className="mt-0.5 text-sm text-slate-600">
                Pilih minimal satu atau tambahkan aplikasi sendiri.
              </p>
            </div>
          </div>

          {/* Action button: + Tambah aplikasi */}
          <div className="mt-5">
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-white/90 px-4 py-2 text-sm font-bold text-slate-800 shadow-xs transition hover:bg-white"
            >
              <Plus size={16} className="text-brand" /> Tambah aplikasi
            </button>
          </div>

          {/* Products Grid (2 columns on mobile/desktop like Screenshot 1) */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {products.map((prod) => {
              const initial = prod.iconText || prod.name.charAt(0).toUpperCase()
              return (
                <div
                  key={prod.id}
                  className="relative flex flex-col justify-between rounded-3xl border border-pink-200/80 bg-gradient-to-r from-pink-50/70 via-white to-pink-50/40 p-4 shadow-xs transition hover:shadow-sm"
                >
                  {/* Top card row: Icon + Name + Checkbox */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-extrabold shadow-xs"
                        style={{ color: prod.color || '#ec4899' }}
                      >
                        {initial}
                      </span>
                      <span className="font-bold text-slate-900">{prod.name}</span>
                    </div>

                    {/* Pink Checked Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleActive(prod)}
                      title={prod.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                        prod.isActive
                          ? 'bg-pink-500 text-white shadow-xs'
                          : 'border-2 border-slate-300 bg-white hover:border-pink-400'
                      }`}
                    >
                      {prod.isActive && <Check size={14} strokeWidth={3} />}
                    </button>
                  </div>

                  {/* Middle: Badge text */}
                  <p className="mt-2 text-xs text-slate-500">
                    {isDefaultApp(prod.name) ? 'Aplikasi bawaan' : 'Aplikasi sendiri'}
                  </p>

                  {/* Bottom: Action buttons (Ubah / Hapus) */}
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-pink-100/60 pt-2.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(prod)}
                      className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-pink-100/60"
                    >
                      <Pencil size={12} className="text-slate-500" /> Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProduct(prod)}
                      className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={12} /> Hapus
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {loading && !products.length && (
            <p className="py-12 text-center text-sm text-slate-500">Memuat produk...</p>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: HASHTAG & KATA KUNCI (Screenshot 3) */}
      {/* ========================================================= */}
      {activeTab === 'keywords' && (
        <form onSubmit={handleSaveKeywords} className="mt-6 animate-in fade-in">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <Hash size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Hashtag & kata kunci
              </h1>
              <p className="mt-0.5 text-sm text-slate-600">
                Tentukan percakapan yang ingin kamu temukan.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {/* 1. Hashtag pantauan */}
            <div className="rounded-3xl border border-brand-border bg-white/90 p-5 shadow-xs">
              <label className="block">
                <span className="text-base font-bold text-slate-900">Hashtag pantauan</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Pisahkan dengan koma atau baris baru. Maksimal 8 hashtag.
                </span>
                <textarea
                  rows={2}
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="zonauang, bealanja"
                  className="mt-2 w-full rounded-2xl border border-brand-border bg-white p-3 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <p className="mt-2 text-xs text-slate-500">
                Memakai #bealanja sesuai permintaanmu. Bisa diganti atau ditambah #belanja.
              </p>
            </div>

            {/* 2. Tanda ingin membeli */}
            <div className="rounded-3xl border border-brand-border bg-white/90 p-5 shadow-xs">
              <label className="block">
                <span className="text-base font-bold text-slate-900">Tanda ingin membeli</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Pisahkan dengan koma atau baris baru, maksimal 20 frasa. Tweet harus memuat
                  minimal satu.
                </span>
                <textarea
                  rows={4}
                  value={intentKeywords}
                  onChange={(e) => setIntentKeywords(e.target.value)}
                  placeholder="wtb, cari, nyari, butuh, mau beli, mau, pengen, adakah..."
                  className="mt-2 w-full rounded-2xl border border-brand-border bg-white p-3 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>
            </div>

            {/* 3. Abaikan kata */}
            <div className="rounded-3xl border border-brand-border bg-white/90 p-5 shadow-xs">
              <label className="block">
                <span className="text-base font-bold text-slate-900">Abaikan kata</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Pisahkan dengan koma atau baris baru, maksimal 30 frasa. Boleh dikosongkan.
                </span>
                <textarea
                  rows={4}
                  value={negativeKeywords}
                  onChange={(e) => setNegativeKeywords(e.target.value)}
                  placeholder="wts, open order, ready stock, ready stok, jual akun, price list..."
                  className="mt-2 w-full rounded-2xl border border-brand-border bg-white p-3 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={savingKeywords}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 font-bold text-white shadow-md transition hover:bg-brand/90 disabled:opacity-50"
            >
              <Save size={16} />
              {savingKeywords ? 'Menyimpan...' : 'Simpan kata kunci'}
            </button>
            {keywordSuccessMsg && (
              <span className="text-sm font-semibold text-emerald-700 animate-in fade-in">
                {keywordSuccessMsg}
              </span>
            )}
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* MODAL: Tambah / Ubah Aplikasi */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-brand-border bg-white p-6 shadow-xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-slate-900">
              {editingProduct ? `Ubah Aplikasi ${editingProduct.name}` : 'Tambah Aplikasi Baru'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Atur detail aplikasi dan template balasan otomatisnya.
            </p>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Nama Aplikasi</label>
                <input
                  type="text"
                  required
                  placeholder="mis. Netflix, CapCut, Zoom"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-brand focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Huruf Ikon</label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="mis. N"
                    value={formIconText}
                    onChange={(e) => setFormIconText(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-brand focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Warna Brand</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="h-9 w-14 cursor-pointer rounded-xl border border-slate-200 p-0.5"
                    />
                    <span className="text-xs font-mono text-slate-600">{formColor}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Template Balasan Cepat
                  <span className="block font-normal text-slate-500">
                    Variabel: {'{user}'}, {'{produk}'}
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={formTemplate}
                  onChange={(e) => setFormTemplate(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-brand focus:bg-white"
                />
              </div>

              {formError && (
                <p className="text-xs font-semibold text-rose-600">{formError}</p>
              )}

              <div className="mt-5 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="rounded-full bg-brand px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand/90 disabled:opacity-50"
                >
                  {formSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

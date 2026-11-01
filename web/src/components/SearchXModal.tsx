'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink, Sparkles, X } from 'lucide-react'
import type { ProductDTO } from '@/lib/types'
import { parseKeywordsList } from '@/lib/settings'

interface SearchXModalProps {
  isOpen: boolean
  onClose: () => void
  products: ProductDTO[]
  hashtags: string
  intentKeywords: string
  negativeKeywords: string
}

export default function SearchXModal({
  isOpen,
  onClose,
  products,
  hashtags,
  intentKeywords,
  negativeKeywords,
}: SearchXModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const activeProducts = products.filter((p) => p.isActive)

  // Format Hashtag query: (#zonauang OR #bealanja)
  const tagsList = parseKeywordsList(hashtags).map((t) => (t.startsWith('#') ? t : `#${t}`))
  const tagsQuery = tagsList.length ? `(${tagsList.join(' OR ')})` : ''

  // Format Intent query: (wtb OR cari OR nyari OR butuh OR "mau beli"...)
  const intentsList = parseKeywordsList(intentKeywords).map((i) =>
    i.includes(' ') ? `"${i}"` : i
  )
  const intentsQuery = intentsList.length ? `(${intentsList.slice(0, 10).join(' OR ')})` : ''

  // Format Negative query: -wts -"open order" -"ready stock"
  const negativesList = parseKeywordsList(negativeKeywords).map((n) =>
    n.includes(' ') ? `-"${n}"` : `-${n}`
  )
  const negativesQuery = negativesList.slice(0, 8).join(' ')

  // Search URL generator
  function getSearchUrl(productQueryPart: string) {
    const parts = [tagsQuery, productQueryPart, intentsQuery, negativesQuery].filter(Boolean)
    const fullQuery = parts.join(' ')
    return `https://x.com/search?q=${encodeURIComponent(fullQuery)}&f=live`
  }

  // All Monitored Products Search URL
  const allProductsQuery =
    activeProducts.length > 0
      ? `(${activeProducts.map((p) => (p.name.includes(' ') ? `"${p.name}"` : p.name)).join(' OR ')})`
      : ''
  const allSearchUrl = getSearchUrl(allProductsQuery)

  // Bookmarklet code that grabs current tweet URL & selected text and opens ReplyBot
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://reply-bot-app.vercel.app'
  const bookmarkletCode = `javascript:(function(){const u=window.location.href;const t=window.getSelection().toString()||document.querySelector('article[data-testid="tweet"] [data-testid="tweetText"]')?.innerText||'';window.open('${origin}/?action=save&url='+encodeURIComponent(u)+'&text='+encodeURIComponent(t),'_blank');})();`

  function copyBookmarklet() {
    navigator.clipboard.writeText(bookmarkletCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-brand-border bg-[#FDFBF7] p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-800"
        >
          <X size={20} />
        </button>

        {/* Top Badge */}
        <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-amber-700">
          <Sparkles size={14} className="text-amber-500" />
          <span>GRATIS • TANPA API</span>
        </div>

        {/* Title & Subtitle */}
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
          Cari calon pembeli di X
        </h2>
        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
          Membuka pencarian X (tab <strong>Terbaru</strong>) memakai hashtag, tanda ingin membeli & abaikan kata dari pengaturanmu.
        </p>

        {/* Big Crimson Top Button */}
        <div className="mt-5">
          <a
            href={allSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#9E1B32] py-3 text-center text-sm font-bold text-white shadow-md transition hover:bg-[#85162a]"
          >
            <span>🔎 Cari semua aplikasi dipantau ({activeProducts.length})</span>
            <ExternalLink size={16} />
          </a>
        </div>

        {/* 2-Column Grid of Monitored Apps */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {activeProducts.map((prod) => {
            const singleQuery = prod.name.includes(' ') ? `"${prod.name}"` : prod.name
            const url = getSearchUrl(singleQuery)
            return (
              <div
                key={prod.id}
                className="flex items-center justify-between rounded-2xl border border-stone-200/80 bg-white px-4 py-2.5 shadow-xs"
              >
                <span className="text-sm font-bold text-slate-900">{prod.name}</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#9E1B32] hover:underline"
                >
                  Cari <ExternalLink size={12} />
                </a>
              </div>
            )
          })}
        </div>

        {/* Bottom Section: Simpan dari X dengan 1 ketukan */}
        <div className="mt-6 border-t border-stone-200/80 pt-5">
          <h3 className="text-base font-extrabold text-slate-900">
            Simpan dari X dengan 1 ketukan
          </h3>
          <ol className="mt-2.5 space-y-2 text-xs text-slate-700 leading-relaxed list-decimal pl-4">
            <li>
              Salin kode bookmark di bawah, lalu buat <strong>bookmark baru</strong> di browser (mis. Safari/Chrome) dan ganti alamatnya (URL) dengan kode ini. Beri nama 🍓 <strong>Simpan ke ReplyBot</strong>.
            </li>
            <li>
              Saat membuka postingan di x.com, <strong>blok teks postingannya</strong> (opsional), lalu ketuk bookmark itu.
            </li>
            <li>
              Admin ReplyBot terbuka dengan link & teks sudah terisi → tekan <strong>Simpan peluang</strong>.
            </li>
          </ol>

          {/* Bookmarklet Code Box */}
          <div className="mt-3 relative rounded-2xl border border-stone-200 bg-stone-100/80 p-3">
            <pre className="overflow-x-auto text-[11px] font-mono text-slate-700 select-all whitespace-pre-wrap break-all">
              {bookmarkletCode}
            </pre>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={copyBookmarklet}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copied ? 'Tersalin ke Clipboard!' : 'Salin Bookmarklet'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


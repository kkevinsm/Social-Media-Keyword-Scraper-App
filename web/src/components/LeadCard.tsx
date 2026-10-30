'use client'

import { useState } from 'react'
import { ExternalLink, Copy, Check, Trash2, MessageSquareReply, EyeOff } from 'lucide-react'
import type { LeadDTO, LeadStatus } from '@/lib/types'
import { FALLBACK_TEMPLATE, PLATFORM_LABEL, copyText, fillTemplate, formatPostDateWIB, splitHighlight, timeAgo } from '@/lib/utils'

const STATUS_STYLE: Record<LeadStatus, string> = {
  baru: 'bg-amber-100 text-amber-800',
  ditindaklanjuti: 'bg-sky-100 text-sky-800',
  selesai: 'bg-emerald-100 text-emerald-800',
  abaikan: 'bg-slate-100 text-slate-600',
}
const STATUS_LABEL: Record<LeadStatus, string> = {
  baru: 'Baru',
  ditindaklanjuti: 'Ditindaklanjuti',
  selesai: 'Selesai',
  abaikan: 'Diabaikan',
}
const PLATFORM_STYLE = {
  x: 'bg-slate-900 text-white',
  telegram: 'bg-sky-500 text-white',
  threads: 'bg-fuchsia-600 text-white',
} as const

interface Props {
  lead: LeadDTO
  onStatus: (id: string, status: LeadStatus) => void
  onDelete: (id: string) => void
}

export default function LeadCard({ lead, onStatus, onDelete }: Props) {
  const [copied, setCopied] = useState(false)
  const keywords = lead.matchedKeywords.split(',')
  const parts = splitHighlight(lead.content, keywords)
  const template = lead.matchedProduct?.templates?.[0]?.bodyText ?? FALLBACK_TEMPLATE
  const reply = fillTemplate(template, lead)
  const initial = (lead.authorName || lead.authorUsername).charAt(0).toUpperCase()

  async function flashCopied() {
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function handleReply() {
    await copyText(reply)
    flashCopied()
    window.open(lead.postUrl, '_blank', 'noopener,noreferrer')
    if (lead.status === 'baru') onStatus(lead.id, 'ditindaklanjuti')
  }

  async function handleCopyOnly() {
    await copyText(reply)
    flashCopied()
  }

  return (
    <article className="rounded-3xl border border-brand-border bg-white/90 p-4 shadow-sm backdrop-blur">
      <header className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg font-bold text-brand">
          {lead.authorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lead.authorAvatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{lead.authorName || lead.authorUsername}</p>
          <p className="truncate text-sm text-slate-500">
            @{lead.authorUsername} · {timeAgo(lead.postedAt)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[lead.status]}`}>
          {STATUS_LABEL[lead.status]}
        </span>
      </header>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className={`rounded-full px-2.5 py-1 ${PLATFORM_STYLE[lead.platform]}`}>{PLATFORM_LABEL[lead.platform]}</span>
        {lead.matchedProduct && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{lead.matchedProduct.name}</span>
        )}
        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">mencari produk</span>
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
        {parts.map((p, i) => (p.match ? <mark key={i} className="kw">{p.text}</mark> : <span key={i}>{p.text}</span>))}
      </p>

      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
        <span className="font-medium text-slate-700">Cocok:</span>
        <span className="truncate">{lead.matchedKeywords || lead.matchedProduct?.name || 'kata kunci'}</span>
        <span>·</span>
        <span>{formatPostDateWIB(lead.postedAt)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleReply}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
        >
          <MessageSquareReply size={16} /> Balas pakai template
        </button>
        <a
          href={lead.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          Buka postingan <ExternalLink size={14} />
        </a>
        <button
          onClick={handleCopyOnly}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          {copied ? 'Tersalin' : 'Salin balasan'}
        </button>
      </div>

      <footer className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-brand-border pt-3">
        <select
          value={lead.status}
          onChange={(e) => onStatus(lead.id, e.target.value as LeadStatus)}
          aria-label="Ubah status"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm"
        >
          {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button
          onClick={() => onStatus(lead.id, 'selesai')}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-emerald-50"
        >
          <Check size={14} /> Selesai
        </button>
        <button
          onClick={() => onStatus(lead.id, 'abaikan')}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          <EyeOff size={14} /> Abaikan
        </button>
        <button
          onClick={() => confirm('Hapus peluang ini?') && onDelete(lead.id)}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
        >
          <Trash2 size={14} /> Hapus
        </button>
      </footer>
    </article>
  )
}


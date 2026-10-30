import type { LeadDTO, Platform } from './types'

export const PLATFORM_LABEL: Record<Platform, string> = {
  x: 'X',
  telegram: 'Telegram',
  threads: 'Threads',
}

export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.floor(h / 24)} hari lalu`
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Memecah teks menjadi bagian biasa & bagian yang cocok dengan keyword (untuk di-highlight tanpa dangerouslySetInnerHTML). */
export function splitHighlight(text: string, keywords: string[]): { text: string; match: boolean }[] {
  const terms = keywords.map((k) => k.trim()).filter(Boolean)
  if (!terms.length) return [{ text, match: false }]
  const re = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
  return text
    .split(re)
    .filter((p) => p !== '')
    .map((p) => ({ text: p, match: terms.some((t) => t.toLowerCase() === p.toLowerCase()) }))
}

export function fillTemplate(body: string, lead: Pick<LeadDTO, 'authorUsername' | 'authorName' | 'matchedProduct'>): string {
  return body
    .replaceAll('{user}', lead.authorUsername)
    .replaceAll('{nama_user}', lead.authorName || lead.authorUsername)
    .replaceAll('{produk}', lead.matchedProduct?.name ?? 'produk digital')
}

export const FALLBACK_TEMPLATE =
  'Halo kak @{user}! Ready {produk} Premium bergaransi, fast respon. Langsung DM ya kak ✨'

/** Salin ke clipboard dengan fallback untuk konteks non-HTTPS. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }
}


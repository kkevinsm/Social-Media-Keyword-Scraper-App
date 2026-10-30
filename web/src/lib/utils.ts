import type { LeadDTO, Platform } from './types'

export const PLATFORM_LABEL: Record<Platform, string> = {
  x: 'X',
  telegram: 'Telegram',
  threads: 'Threads',
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'baru saja'
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${Math.max(1, s)} detik lalu`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  return `${d} hari lalu`
}

export function formatPostDateWIB(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) + ' WIB'
  } catch {
    return ''
  }
}

export function formatLiveClock(d: Date): string {
  try {
    const dateStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)

    const timeStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d)

    return `${dateStr} · ${timeStr} WIB`
  } catch {
    return d.toLocaleTimeString('id-ID')
  }
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

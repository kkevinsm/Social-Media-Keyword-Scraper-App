import { connection } from 'next/server'
import { prisma } from '@/lib/prisma'

function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value)
  // Cegah CSV/formula injection saat dibuka di Excel/Sheets
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET() {
  await connection()
  const leads = await prisma.lead.findMany({
    include: { matchedProduct: true },
    orderBy: { postedAt: 'desc' },
  })

  const header = ['platform', 'username', 'nama', 'produk', 'isi', 'keyword', 'status', 'url', 'waktu_posting']
  const rows = leads.map((l) =>
    [l.platform, l.authorUsername, l.authorName, l.matchedProduct?.name, l.content, l.matchedKeywords, l.status, l.postUrl, l.postedAt.toISOString()]
      .map(csvCell)
      .join(',')
  )

  return new Response('\uFEFF' + [header.join(','), ...rows].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="peluang-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}


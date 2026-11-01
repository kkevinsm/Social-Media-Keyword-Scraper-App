import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGlobalSettings, matchLeadContent } from '@/lib/settings'

export async function POST(req: NextRequest) {
  try {
    // 1. Validasi Autentikasi Bearer Token
    const authHeader = req.headers.get('authorization')
    const secretKey = process.env.INGESTION_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json({ error: 'Server belum dikonfigurasi: INGESTION_SECRET_KEY kosong' }, { status: 500 })
    }

    if (!authHeader || authHeader.replace('Bearer ', '').trim() !== secretKey) {
      return NextResponse.json({ error: 'Unauthorized: Invalid ingestion token' }, { status: 401 })
    }

    const body = await req.json()
    const {
      platform,
      external_id,
      author_name,
      author_username,
      author_avatar_url,
      content,
      post_url,
      posted_at,
    } = body

    if (!platform || !external_id || !author_username || !content || !post_url) {
      return NextResponse.json(
        { error: 'Bad Request: Missing required fields (platform, external_id, author_username, content, post_url)' },
        { status: 400 }
      )
    }

    // 2. Cek Idempotency / Deduplikasi
    const existing = await prisma.lead.findUnique({
      where: {
        platform_externalId: {
          platform,
          externalId: String(external_id),
        },
      },
    })

    if (existing) {
      return NextResponse.json({ status: 'skipped', reason: 'duplicate', id: existing.id })
    }

    // 3. Ambil data produk aktif dan pengaturan global keyword
    const [activeProducts, globalSettings] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, isActive: true },
      }),
      getGlobalSettings(),
    ])

    // 4. Deteksi kecocokan menggunakan engine terpadu (Produk + Tanda Ingin Membeli - Kata Negatif)
    const matchResult = matchLeadContent({
      content,
      products: activeProducts,
      globalSettings,
    })

    if (!matchResult.matched || !matchResult.product) {
      return NextResponse.json({
        status: 'ignored',
        reason: matchResult.reason,
        keyword: (matchResult as any).keyword,
      })
    }

    // 5. Simpan Lead ke Database
    const newLead = await prisma.lead.create({
      data: {
        externalId: String(external_id),
        platform,
        authorName: author_name || author_username,
        authorUsername: author_username.replace('@', ''),
        authorAvatarUrl: author_avatar_url || '',
        content,
        matchedProductId: matchResult.product.id,
        matchedKeywords: matchResult.matchedKeywords,
        postUrl: post_url,
        status: 'baru',
        postedAt: posted_at ? new Date(posted_at) : new Date(),
      },
      include: {
        matchedProduct: true,
      },
    })

    return NextResponse.json({
      status: 'success',
      lead: newLead,
    })
  } catch (error: any) {
    console.error('Ingest API error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

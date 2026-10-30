import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    const contentLower = content.toLowerCase()

    // 3. Ambil data produk dan aturan filter aktif
    const activeProducts = await prisma.product.findMany({
      where: { isActive: true },
      include: { rules: true },
    })

    // Kumpulkan seluruh kata kunci negasi (Blacklist Penjual)
    const allNegativeKeywords = new Set<string>()
    for (const prod of activeProducts) {
      for (const rule of prod.rules) {
        rule.negativeKeywords
          .split(',')
          .map((k: string) => k.trim().toLowerCase())
          .filter(Boolean)
          .forEach((k: string) => allNegativeKeywords.add(k))
      }
    }

    // Cek apakah postingan mengandung kata negasi
    for (const negWord of allNegativeKeywords) {
      if (contentLower.includes(negWord)) {
        return NextResponse.json({
          status: 'ignored',
          reason: 'negative_keyword_matched',
          keyword: negWord,
        })
      }
    }

    // 4. Deteksi kecocokan produk & intent beli
    let matchedProductId: string | null = null
    const matchedKeywordsList: string[] = []

    for (const prod of activeProducts) {
      const prodName = prod.name.toLowerCase()
      const prodSlug = prod.slug.toLowerCase()

      // Cek apakah nama produk disebutkan
      if (contentLower.includes(prodName) || contentLower.includes(prodSlug)) {
        matchedProductId = prod.id
        matchedKeywordsList.push(prod.name)

        // Cek intent beli dari aturan produk ini
        for (const rule of prod.rules) {
          const intentWords = rule.intentKeywords
            .split(',')
            .map((k: string) => k.trim().toLowerCase())
            .filter(Boolean)

          for (const intent of intentWords) {
            if (contentLower.includes(intent) && !matchedKeywordsList.includes(intent)) {
              matchedKeywordsList.push(intent)
            }
          }

          const hashtags = rule.hashtags
            .split(',')
            .map((k: string) => k.trim().toLowerCase())
            .filter(Boolean)

          for (const tag of hashtags) {
            if (contentLower.includes(tag) && !matchedKeywordsList.includes(tag)) {
              matchedKeywordsList.push(tag)
            }
          }
        }
        break // Cocokkan dengan produk pertama yang terdeteksi
      }
    }

    // Jika tidak menyebutkan produk yang dipantau sama sekali, drop
    if (!matchedProductId) {
      return NextResponse.json({
        status: 'ignored',
        reason: 'no_monitored_product_matched',
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
        matchedProductId,
        matchedKeywords: matchedKeywordsList.join(','),
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

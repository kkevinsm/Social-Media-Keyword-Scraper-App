import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    // 1. Ambil API Key dari header, body, atau environment
    const body = await req.json().catch(() => ({}))
    const apiKey =
      body.apiKey ||
      req.headers.get('x-twitter-api-key') ||
      process.env.TWITTER_API_KEY ||
      'new1_9a2790a365264495a616dc0baa48908c'

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key twitterapi.io belum dikonfigurasi' },
        { status: 400 }
      )
    }

    // 2. Ambil produk yang aktif dan aturannya
    const activeProducts = await prisma.product.findMany({
      where: { isActive: true },
      include: { rules: true },
    })

    if (!activeProducts.length) {
      return NextResponse.json({ message: 'Tidak ada produk aktif untuk dipantau', totalFetched: 0 })
    }

    // Kumpulkan seluruh kata kunci negasi (penjual lain / WTS)
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

    // 3. Tentukan kata pencarian (misal 3 produk pertama atau custom query)
    const query = body.query || 'butuh netflix OR butuh canva OR butuh capcut #zonauang'
    const searchUrl = `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(
      query
    )}&queryType=Latest`

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json(
        { error: `Gagal memanggil twitterapi.io (HTTP ${response.status}): ${errText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const tweets = data.tweets || data.data?.tweets || []

    let savedCount = 0
    let skippedDuplicate = 0
    let ignoredCompetitor = 0

    for (const tw of tweets) {
      const externalId = tw.id || tw.id_str
      const authorUsername = tw.author?.userName || tw.user?.screen_name || 'anon'
      const authorName = tw.author?.name || tw.user?.name || authorUsername
      const authorAvatarUrl = tw.author?.profilePicture || tw.user?.profile_image_url_https || ''
      const content = tw.text || tw.full_text || ''
      const postUrl = tw.url || `https://x.com/${authorUsername}/status/${externalId}`
      const postedAt = tw.createdAt ? new Date(tw.createdAt) : new Date()

      const contentLower = content.toLowerCase()

      // Cek negasi (WTS / sesama penjual)
      let isCompetitor = false
      for (const neg of allNegativeKeywords) {
        if (contentLower.includes(neg)) {
          isCompetitor = true
          ignoredCompetitor++
          break
        }
      }
      if (isCompetitor) continue

      // Cek produk yang cocok
      let matchedProductId: string | null = null
      const matchedKeywordsList: string[] = []

      for (const prod of activeProducts) {
        if (contentLower.includes(prod.name.toLowerCase()) || contentLower.includes(prod.slug.toLowerCase())) {
          matchedProductId = prod.id
          matchedKeywordsList.push(prod.name)

          for (const rule of prod.rules) {
            rule.intentKeywords
              .split(',')
              .map((k: string) => k.trim().toLowerCase())
              .filter(Boolean)
              .forEach((intent: string) => {
                if (contentLower.includes(intent) && !matchedKeywordsList.includes(intent)) {
                  matchedKeywordsList.push(intent)
                }
              })
          }
          break
        }
      }

      if (!matchedProductId) continue

      // Simpan ke database dengan proteksi duplikat (upsert)
      try {
        const existing = await prisma.lead.findUnique({
          where: {
            platform_externalId: {
              platform: 'x',
              externalId: String(externalId),
            },
          },
        })

        if (existing) {
          skippedDuplicate++
          continue
        }

        await prisma.lead.create({
          data: {
            externalId: String(externalId),
            platform: 'x',
            authorName,
            authorUsername,
            authorAvatarUrl,
            content,
            matchedProductId,
            matchedKeywords: matchedKeywordsList.join(','),
            postUrl,
            status: 'baru',
            postedAt,
          },
        })
        savedCount++
      } catch {
        skippedDuplicate++
      }
    }

    return NextResponse.json({
      success: true,
      query,
      totalFetched: tweets.length,
      savedLeads: savedCount,
      skippedDuplicate,
      ignoredCompetitor,
    })
  } catch (error: any) {
    console.error('Scrape API error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}


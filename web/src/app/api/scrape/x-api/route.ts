import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGlobalSettings, matchLeadContent, parseKeywordsList } from '@/lib/settings'

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

    // 2. Ambil produk yang aktif dan pengaturan global keywords
    const [activeProducts, globalSettings] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, isActive: true },
      }),
      getGlobalSettings(),
    ])

    if (!activeProducts.length) {
      return NextResponse.json({ message: 'Tidak ada produk aktif untuk dipantau', totalFetched: 0 })
    }

    // 3. Tentukan kata pencarian (query)
    let query = body.query
    if (!query) {
      // Buat query otomatis berbasis hashtag dan intent
      const hashtags = parseKeywordsList(globalSettings.hashtags)
        .slice(0, 2)
        .map((t) => (t.startsWith('#') ? t : `#${t}`))
        .join(' OR ')

      const sampleProducts = activeProducts.slice(0, 4).map((p) => p.name).join(' OR ')
      const sampleIntents = parseKeywordsList(globalSettings.intentKeywords).slice(0, 3).join(' OR ')

      if (hashtags) {
        query = `(${sampleProducts}) (${sampleIntents}) (${hashtags}) -wts`
      } else {
        query = `(${sampleProducts}) (${sampleIntents}) -wts`
      }
    }

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
    let ignoredFilter = 0

    for (const tw of tweets) {
      const externalId = tw.id || tw.id_str
      const authorUsername = tw.author?.userName || tw.user?.screen_name || 'anon'
      const authorName = tw.author?.name || tw.user?.name || authorUsername
      const authorAvatarUrl = tw.author?.profilePicture || tw.user?.profile_image_url_https || ''
      const content = tw.text || tw.full_text || ''
      const postUrl = tw.url || `https://x.com/${authorUsername}/status/${externalId}`
      let postedAt = new Date()
      if (tw.createdAt) {
        const parsed = new Date(tw.createdAt)
        if (!isNaN(parsed.getTime())) {
          postedAt = parsed
        }
      }

      // Evaluasi filter ketat (Produk + Tanda Ingin Membeli - Kata Negatif)
      const matchResult = matchLeadContent({
        content,
        products: activeProducts,
        globalSettings,
      })

      if (!matchResult.matched || !matchResult.product) {
        ignoredFilter++
        continue
      }

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
            matchedProductId: matchResult.product.id,
            matchedKeywords: matchResult.matchedKeywords,
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
      ignoredFilter,
    })
  } catch (error: any) {
    console.error('Scrape API error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

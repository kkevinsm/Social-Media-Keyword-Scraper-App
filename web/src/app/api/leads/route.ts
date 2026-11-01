import { NextRequest, NextResponse, connection } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  await connection()
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') // 'semua' | 'baru' | 'ditindaklanjuti' | 'selesai' | 'abaikan'
    const productSlug = searchParams.get('product')
    const platform = searchParams.get('platform')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: any = {}

    if (status && status !== 'semua') {
      where.status = status
    }

    if (platform && platform !== 'semua') {
      where.platform = platform
    }

    if (productSlug && productSlug !== 'semua') {
      where.matchedProduct = {
        slug: productSlug,
      }
    }

    if (search && search.trim()) {
      where.OR = [
        { content: { contains: search } },
        { authorUsername: { contains: search } },
        { authorName: { contains: search } },
      ]
    }

    // Ambil data leads
    const [leads, totalCount] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          matchedProduct: {
            include: {
              templates: {
                where: { isDefault: true },
              },
            },
          },
        },
        orderBy: {
          postedAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ])

    // Hitung counter status untuk tab badge
    const [countSemua, countBaru, countDitindaklanjuti, countSelesai, countAbaikan] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'baru' } }),
      prisma.lead.count({ where: { status: 'ditindaklanjuti' } }),
      prisma.lead.count({ where: { status: 'selesai' } }),
      prisma.lead.count({ where: { status: 'abaikan' } }),
    ])

    return NextResponse.json({
      leads,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      counts: {
        semua: countSemua,
        baru: countBaru,
        ditindaklanjuti: countDitindaklanjuti,
        selesai: countSelesai,
        abaikan: countAbaikan,
      },
    })
  } catch (error: any) {
    console.error('Fetch leads error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      platform = 'x',
      externalId = String(Date.now()),
      authorUsername = 'manual',
      authorName,
      content,
      postUrl,
      matchedProductId,
      matchedKeywords = 'manual',
    } = body

    if (!content || !postUrl) {
      return NextResponse.json({ error: 'Content and postUrl are required' }, { status: 400 })
    }

    const lead = await prisma.lead.create({
      data: {
        platform,
        externalId: String(externalId),
        authorUsername,
        authorName: authorName || authorUsername,
        content,
        postUrl,
        matchedProductId: matchedProductId || null,
        matchedKeywords,
        status: 'baru',
        postedAt: new Date(),
      },
      include: {
        matchedProduct: true,
      },
    })

    return NextResponse.json({ success: true, lead })
  } catch (error: any) {
    console.error('Create lead error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

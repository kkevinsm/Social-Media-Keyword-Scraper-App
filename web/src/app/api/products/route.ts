import { NextRequest, NextResponse, connection } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  await connection()
  try {
    const products = await prisma.product.findMany({
      include: {
        rules: true,
        templates: true,
        _count: {
          select: { leads: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ products })
  } catch (error: any) {
    console.error('Fetch products error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, color, iconText, intentKeywords, negativeKeywords, hashtags } = body

    if (!name) {
      return NextResponse.json({ error: 'Nama produk wajib diisi' }, { status: 400 })
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

    const newProduct = await prisma.product.create({
      data: {
        name,
        slug,
        color: color || '#EC4899',
        iconText: iconText || name.charAt(0).toUpperCase(),
        rules: {
          create: {
            intentKeywords: intentKeywords || 'butuh,mau beli,ready,cari',
            negativeKeywords: negativeKeywords || 'wts,ready stock,open slot,testi',
            hashtags: hashtags || '#zonauang,#zonajajan',
          },
        },
        templates: {
          create: [
            {
              title: `Template ${name}`,
              bodyText: `Halo kak @{user}! Ready ${name} Premium bergaransi full. Fast respon & amanah, langsung DM ya kak! ✨`,
              isDefault: true,
            },
          ],
        },
      },
      include: {
        rules: true,
        templates: true,
      },
    })

    return NextResponse.json({ success: true, product: newProduct })
  } catch (error: any) {
    console.error('Create product error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}


import { NextRequest, NextResponse, connection } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEFAULT_HASHTAGS, DEFAULT_INTENT_KEYWORDS, DEFAULT_NEGATIVE_KEYWORDS, getGlobalSettings } from '@/lib/settings'

export async function GET() {
  await connection()
  try {
    const settings = await getGlobalSettings()
    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Fetch settings error:', error)
    return NextResponse.json(
      {
        settings: {
          hashtags: DEFAULT_HASHTAGS,
          intentKeywords: DEFAULT_INTENT_KEYWORDS,
          negativeKeywords: DEFAULT_NEGATIVE_KEYWORDS,
        },
      },
      { status: 200 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { hashtags, intentKeywords, negativeKeywords } = body

    const updates = []

    if (typeof hashtags === 'string') {
      updates.push(
        prisma.setting.upsert({
          where: { key: 'hashtags' },
          create: { key: 'hashtags', value: hashtags.trim() },
          update: { value: hashtags.trim() },
        })
      )
    }

    if (typeof intentKeywords === 'string') {
      updates.push(
        prisma.setting.upsert({
          where: { key: 'intent_keywords' },
          create: { key: 'intent_keywords', value: intentKeywords.trim() },
          update: { value: intentKeywords.trim() },
        })
      )
    }

    if (typeof negativeKeywords === 'string') {
      updates.push(
        prisma.setting.upsert({
          where: { key: 'negative_keywords' },
          create: { key: 'negative_keywords', value: negativeKeywords.trim() },
          update: { value: negativeKeywords.trim() },
        })
      )
    }

    await prisma.$transaction(updates)

    const updatedSettings = await getGlobalSettings()
    return NextResponse.json({ success: true, settings: updatedSettings })
  } catch (error: any) {
    console.error('Update settings error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}


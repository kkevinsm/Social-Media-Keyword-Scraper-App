import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { title, bodyText } = await req.json()
    if (typeof bodyText !== 'string' || !bodyText.trim()) {
      return NextResponse.json({ error: 'Isi template wajib diisi' }, { status: 400 })
    }
    const template = await prisma.replyTemplate.update({
      where: { id },
      data: { bodyText, ...(typeof title === 'string' && title.trim() && { title }) },
    })
    return NextResponse.json({ success: true, template })
  } catch (error) {
    console.error('Update template error:', error)
    return NextResponse.json({ error: 'Gagal memperbarui template' }, { status: 500 })
  }
}


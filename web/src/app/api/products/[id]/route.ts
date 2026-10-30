import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const data: { isActive?: boolean; name?: string } = {}
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()

    const product = await prisma.product.update({ where: { id }, data })

    // Opsional: perbarui keyword rule pertama milik produk
    const { intentKeywords, negativeKeywords, hashtags } = body
    if (intentKeywords != null || negativeKeywords != null || hashtags != null) {
      const rule = await prisma.keywordRule.findFirst({ where: { productId: id } })
      const ruleData = {
        ...(typeof intentKeywords === 'string' && { intentKeywords }),
        ...(typeof negativeKeywords === 'string' && { negativeKeywords }),
        ...(typeof hashtags === 'string' && { hashtags }),
      }
      if (rule) await prisma.keywordRule.update({ where: { id: rule.id }, data: ruleData })
      else await prisma.keywordRule.create({ data: { productId: id, ...ruleData } })
    }

    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error('Update product error:', error)
    return NextResponse.json({ error: 'Gagal memperbarui produk' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.product.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete product error:', error)
    return NextResponse.json({ error: 'Gagal menghapus produk' }, { status: 500 })
  }
}


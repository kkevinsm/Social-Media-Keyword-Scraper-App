import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status } = body

    if (!status || !['baru', 'ditindaklanjuti', 'selesai', 'abaikan'].includes(status)) {
      return NextResponse.json(
        { error: 'Status tidak valid. Pilihan: baru, ditindaklanjuti, selesai, abaikan' },
        { status: 400 }
      )
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json({ success: true, lead: updated })
  } catch (error: any) {
    console.error('Update lead error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.lead.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Lead berhasil dihapus' })
  } catch (error: any) {
    console.error('Delete lead error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}


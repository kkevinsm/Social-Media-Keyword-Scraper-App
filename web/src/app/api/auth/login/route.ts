import { NextRequest, NextResponse } from 'next/server'
import { getExpectedSessionToken, isValidCredentials, SESSION_COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password || !isValidCredentials(username, password)) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    const token = getExpectedSessionToken()
    const res = NextResponse.json({ success: true, message: 'Login berhasil' })

    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    })

    return res
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan internal' }, { status: 500 })
  }
}

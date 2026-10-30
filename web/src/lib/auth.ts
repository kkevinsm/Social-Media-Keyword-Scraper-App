import { cookies } from 'next/headers'
import crypto from 'crypto'

const SESSION_COOKIE_NAME = 'replybot_admin_session'
const SECRET_SALT = process.env.INGESTION_SECRET_KEY || 'replybot_salt_secret'

export function getExpectedSessionToken(): string {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  return crypto
    .createHmac('sha256', SECRET_SALT)
    .update(`${adminUsername}:${adminPassword}`)
    .digest('hex')
}

export async function verifyAdminSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return false

  const expected = getExpectedSessionToken()
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}

export function isValidCredentials(username?: string, password?: string): boolean {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  return username === adminUsername && password === adminPassword
}

export { SESSION_COOKIE_NAME }

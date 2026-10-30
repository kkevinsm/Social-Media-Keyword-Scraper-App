export type Platform = 'x' | 'telegram' | 'threads'
export type LeadStatus = 'baru' | 'ditindaklanjuti' | 'selesai' | 'abaikan'

export interface ReplyTemplateDTO {
  id: string
  title: string
  bodyText: string
  isDefault: boolean
}

export interface ProductDTO {
  id: string
  name: string
  slug: string
  color: string
  iconText: string
  isActive: boolean
  templates?: ReplyTemplateDTO[]
}

export interface LeadDTO {
  id: string
  externalId: string
  platform: Platform
  authorName: string | null
  authorUsername: string
  authorAvatarUrl: string | null
  content: string
  matchedKeywords: string
  postUrl: string
  status: LeadStatus
  postedAt: string
  matchedProduct: ProductDTO | null
}

export interface LeadCounts {
  semua: number
  baru: number
  ditindaklanjuti: number
  selesai: number
  abaikan: number
}


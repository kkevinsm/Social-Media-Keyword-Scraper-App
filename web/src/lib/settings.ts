import { prisma } from './prisma'

export const DEFAULT_HASHTAGS = 'zonauang, bealanja'
export const DEFAULT_INTENT_KEYWORDS =
  'wtb, cari, nyari, butuh, mau beli, mau, pengen, adakah, ada yang jual, ada yg jual, info, want to buy, ada, need'
export const DEFAULT_NEGATIVE_KEYWORDS =
  'wts, open order, ready stock, ready stok, jual akun, price list, pricelist, jasa convert, giveaway, stock melimpah, stok melimpah, intip pl, open po'

export interface GlobalSettings {
  hashtags: string
  intentKeywords: string
  negativeKeywords: string
}

export async function getGlobalSettings(): Promise<GlobalSettings> {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: { in: ['hashtags', 'intent_keywords', 'negative_keywords'] },
      },
    })

    const map = new Map(settings.map((s) => [s.key, s.value]))

    return {
      hashtags: map.get('hashtags') || DEFAULT_HASHTAGS,
      intentKeywords: map.get('intent_keywords') || DEFAULT_INTENT_KEYWORDS,
      negativeKeywords: map.get('negative_keywords') || DEFAULT_NEGATIVE_KEYWORDS,
    }
  } catch (e) {
    console.error('Failed to load global settings, using defaults:', e)
    return {
      hashtags: DEFAULT_HASHTAGS,
      intentKeywords: DEFAULT_INTENT_KEYWORDS,
      negativeKeywords: DEFAULT_NEGATIVE_KEYWORDS,
    }
  }
}

export function parseKeywordsList(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0)
}

// Product synonym helpers
const PRODUCT_SYNONYMS: Record<string, string[]> = {
  netflix: ['netflix', 'netflik'],
  canva: ['canva'],
  capcut: ['capcut', 'cap cut'],
  spotify: ['spotify', 'spotifay'],
  chatgpt: ['chatgpt', 'chat gpt', 'chat-gpt', 'gpt 4', 'gpt-4', 'openai'],
  youtube: ['youtube', 'yt premium', 'yt prem', 'youtube premium'],
  'prime-video': ['prime video', 'primevideo', 'amazon prime', 'amazon video'],
  vidio: ['vidio', 'vidio.com', 'vidio premier', 'vidio platinum'],
  'disney-plus': ['disney+', 'disney plus', 'disneyplus', 'hotstar', 'disney+ hotstar'],
}

export function matchLeadContent({
  content,
  products,
  globalSettings,
}: {
  content: string
  products: Array<{ id: string; name: string; slug: string; isActive: boolean }>
  globalSettings: GlobalSettings
}) {
  const contentLower = content.toLowerCase()

  // 1. Cek Kata Negatif (Abaikan kata / sesama penjual / promo)
  const negativeList = parseKeywordsList(globalSettings.negativeKeywords)
  for (const neg of negativeList) {
    if (contentLower.includes(neg)) {
      return {
        matched: false,
        reason: 'negative_keyword_matched',
        keyword: neg,
      }
    }
  }

  // 2. Cek Tanda Ingin Membeli (Wajib ada minimal satu)
  const intentList = parseKeywordsList(globalSettings.intentKeywords)
  const matchedIntents: string[] = []
  for (const intent of intentList) {
    // Gunakan regex boundary untuk kata sangat pendek (misal: "mau", "ada", "need") agar tidak false match substring
    let isMatch = false
    if (intent.length <= 4) {
      const reg = new RegExp(`(^|[^a-z0-9])${intent}([^a-z0-9]|$)`, 'i')
      isMatch = reg.test(contentLower)
    } else {
      isMatch = contentLower.includes(intent)
    }

    if (isMatch) {
      matchedIntents.push(intent)
    }
  }

  if (matchedIntents.length === 0) {
    return {
      matched: false,
      reason: 'no_intent_matched',
    }
  }

  // 3. Cek Produk Pantauan yang Cocok
  let matchedProduct: { id: string; name: string; slug: string } | null = null
  const matchedProductKeywords: string[] = []

  const activeProducts = products.filter((p) => p.isActive)
  for (const prod of activeProducts) {
    const slug = prod.slug.toLowerCase()
    const name = prod.name.toLowerCase()
    const synonyms = PRODUCT_SYNONYMS[slug] || [name, slug]

    const foundSynonym = synonyms.find((syn) => {
      if (syn.length <= 3) {
        const reg = new RegExp(`(^|[^a-z0-9])${syn}([^a-z0-9]|$)`, 'i')
        return reg.test(contentLower)
      }
      return contentLower.includes(syn)
    })

    if (foundSynonym || contentLower.includes(name) || contentLower.includes(slug)) {
      matchedProduct = prod
      matchedProductKeywords.push(prod.name)
      break
    }
  }

  if (!matchedProduct) {
    return {
      matched: false,
      reason: 'no_monitored_product_matched',
    }
  }

  // Cek hashtag bila ada
  const hashtagList = parseKeywordsList(globalSettings.hashtags).map((t) =>
    t.startsWith('#') ? t : `#${t}`
  )
  for (const tag of hashtagList) {
    if (contentLower.includes(tag.toLowerCase())) {
      matchedProductKeywords.push(tag)
    }
  }

  const allMatched = [...new Set([...matchedProductKeywords, ...matchedIntents])]

  return {
    matched: true,
    product: matchedProduct,
    matchedKeywords: allMatched.join(', '),
  }
}


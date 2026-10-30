const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const DEFAULT_PRODUCTS = [
  { name: 'Netflix', slug: 'netflix', color: '#E50914', iconText: 'N' },
  { name: 'Canva', slug: 'canva', color: '#00C4CC', iconText: 'C' },
  { name: 'CapCut', slug: 'capcut', color: '#111111', iconText: 'C' },
  { name: 'Spotify', slug: 'spotify', color: '#1DB954', iconText: 'S' },
  { name: 'ChatGPT', slug: 'chatgpt', color: '#10A37F', iconText: 'C' },
  { name: 'YouTube', slug: 'youtube', color: '#FF0000', iconText: 'Y' },
  { name: 'Prime Video', slug: 'prime-video', color: '#00A8E1', iconText: 'P' },
  { name: 'Vidio', slug: 'vidio', color: '#ED1C24', iconText: 'V' },
  { name: 'Disney+', slug: 'disney-plus', color: '#113CCF', iconText: 'D' },
]

const DEFAULT_INTENT_KEYWORDS = 'butuh,mau beli,ready,cari,butuh cepet,ada yg jual,butuh akun,rekomen seller,berapa yaa,ada yg ready,mau langganan'
const DEFAULT_NEGATIVE_KEYWORDS = 'wts,ready stock,open slot,testi,order via dm,trusted,bergaransi dan trusted,olss,payment via,price list,pricelist,dm for order,slot ready'
const DEFAULT_HASHTAGS = '#zonauang,#zonajajan,#bealanja'

async function main() {
  console.log('Seeding initial data...')

  // Clean existing data for fresh seed
  await prisma.lead.deleteMany()
  await prisma.replyTemplate.deleteMany()
  await prisma.keywordRule.deleteMany()
  await prisma.product.deleteMany()

  for (const prod of DEFAULT_PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        name: prod.name,
        slug: prod.slug,
        color: prod.color,
        iconText: prod.iconText,
        rules: {
          create: {
            intentKeywords: DEFAULT_INTENT_KEYWORDS,
            negativeKeywords: DEFAULT_NEGATIVE_KEYWORDS,
            hashtags: DEFAULT_HASHTAGS,
          },
        },
        templates: {
          create: [
            {
              title: `Template Balasan ${prod.name}`,
              bodyText: `Halo kak @{user}! Ready akun ${prod.name} Premium resmi garansi anti on-hold / limit. Harga murah mahasiswa & proses kilat 1 menit. Langsung DM ya kak atau cek link di bio! ✨`,
              isDefault: true,
            },
          ],
        },
      },
    })

    console.log(`Created product: ${product.name}`)
  }

  // Seed sample leads similar to user's screenshots
  const netflixProd = await prisma.product.findUnique({ where: { slug: 'netflix' } })
  const disneyProd = await prisma.product.findUnique({ where: { slug: 'disney-plus' } })
  const capcutProd = await prisma.product.findUnique({ where: { slug: 'capcut' } })

  if (netflixProd) {
    await prisma.lead.create({
      data: {
        externalId: '18493029482931',
        platform: 'x',
        authorName: '피카 ✽',
        authorUsername: 'pixypaw',
        authorAvatarUrl: '',
        content: 'butuh cepet netflix 3 hari #zonauang',
        matchedProductId: netflixProd.id,
        matchedKeywords: 'butuh,netflix,#zonauang',
        postUrl: 'https://x.com/pixypaw/status/18493029482931',
        status: 'baru',
        postedAt: new Date(Date.now() - 1000 * 60 * 15),
      },
    })
  }

  if (disneyProd) {
    await prisma.lead.create({
      data: {
        externalId: '18493029482932',
        platform: 'x',
        authorName: 'sherin ✨',
        authorUsername: 'sherinplrrv',
        authorAvatarUrl: '',
        content: 'Disney+ seminggu apa sebulan berapa yaa, mau beli #zonauang',
        matchedProductId: disneyProd.id,
        matchedKeywords: 'Disney+,mau beli,#zonauang',
        postUrl: 'https://x.com/sherinplrrv/status/18493029482932',
        status: 'baru',
        postedAt: new Date(Date.now() - 1000 * 60 * 5),
      },
    })
  }

  if (capcutProd) {
    await prisma.lead.create({
      data: {
        externalId: '18493029482933',
        platform: 'threads',
        authorName: 'Jizel',
        authorUsername: 'neecdle',
        authorAvatarUrl: '',
        content: 'mau capcut pro yg fast respon dong, butuh buat ngedit tugas #zonauang',
        matchedProductId: capcutProd.id,
        matchedKeywords: 'capcut,mau,butuh',
        postUrl: 'https://www.threads.net/@neecdle',
        status: 'ditindaklanjuti',
        postedAt: new Date(Date.now() - 1000 * 60 * 60),
      },
    })
  }

  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


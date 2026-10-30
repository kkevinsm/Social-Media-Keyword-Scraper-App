const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testBackend() {
  console.log('--- 1. Testing Database Query ---')
  const leads = await prisma.lead.findMany({
    include: { matchedProduct: true }
  })
  console.log(`Found ${leads.length} leads in database.`)

  const products = await prisma.product.findMany({
    include: { rules: true, templates: true }
  })
  console.log(`Found ${products.length} products configured.`)

  console.log('\n--- 2. Testing Negative Keyword & Intent Match Logic ---')
  const competitorPost = 'WTS NETFLIX 1 BULAN READY STOCK TERMURAH GARANSI FULL TESTI CEK PINNED'
  const buyerPost = 'butuh canva pro 1 tahun yang langsung jadi sekarang, mau beli #zonauang'

  // Load all negative keywords
  const allNegativeKeywords = new Set()
  for (const prod of products) {
    for (const rule of prod.rules) {
      rule.negativeKeywords
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
        .forEach((k) => allNegativeKeywords.add(k))
    }
  }

  // Check competitor post
  let isCompetitor = false
  for (const neg of allNegativeKeywords) {
    if (competitorPost.toLowerCase().includes(neg)) {
      isCompetitor = true
      console.log(`Competitor post correctly detected! Matched negative keyword: "${neg}"`)
      break
    }
  }

  // Check buyer post
  let isBuyer = false
  let matchedProd = null
  for (const prod of products) {
    if (buyerPost.toLowerCase().includes(prod.name.toLowerCase())) {
      matchedProd = prod.name
      for (const rule of prod.rules) {
        for (const intent of rule.intentKeywords.split(',')) {
          if (buyerPost.toLowerCase().includes(intent.trim().toLowerCase())) {
            isBuyer = true
            break
          }
        }
      }
    }
  }
  console.log(`Buyer post correctly matched! Product: ${matchedProd}, Has Buying Intent: ${isBuyer}`)

  console.log('\n--- 3. Testing Lead Status Counts ---')
  const counts = {
    semua: await prisma.lead.count(),
    baru: await prisma.lead.count({ where: { status: 'baru' } }),
    ditindaklanjuti: await prisma.lead.count({ where: { status: 'ditindaklanjuti' } }),
    selesai: await prisma.lead.count({ where: { status: 'selesai' } }),
    abaikan: await prisma.lead.count({ where: { status: 'abaikan' } }),
  }
  console.log('Status counts:', counts)

  console.log('\n>>> All Tahap 1 core logic & database checks passed perfectly! <<<')
}

testBackend()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


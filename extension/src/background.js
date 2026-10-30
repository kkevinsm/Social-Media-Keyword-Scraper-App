/**
 * Service worker: antrean + pengiriman ke POST /api/leads/ingest.
 * Token hanya dibaca di sini (tidak pernah diteruskan ke content script).
 */
const DEFAULTS = { apiUrl: 'https://web-seven-gilt-52.vercel.app', token: '' }
const MAX_QUEUE = 500
const MAX_SEEN = 3000

let chain = Promise.resolve()
const serialize = (fn) => (chain = chain.then(fn, fn))

async function getCfg() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(Object.keys(DEFAULTS))) }
}

async function bumpStats(patch) {
  const { stats = {} } = await chrome.storage.local.get('stats')
  const next = { sent: 0, accepted: 0, ...stats }
  for (const [k, v] of Object.entries(patch)) next[k] = typeof v === 'number' && k !== 'at' ? (next[k] || 0) + v : v
  await chrome.storage.local.set({ stats: next })
}

function enqueue(leads) {
  return serialize(async () => {
    const { queue = [], seen = [] } = await chrome.storage.local.get(['queue', 'seen'])
    const seenSet = new Set(seen)
    for (const l of leads) {
      const key = `${l.platform}:${l.external_id}`
      if (seenSet.has(key)) continue
      seenSet.add(key)
      queue.push(l)
    }
    await chrome.storage.local.set({
      queue: queue.slice(-MAX_QUEUE),
      seen: Array.from(seenSet).slice(-MAX_SEEN),
    })
  })
}

function flush() {
  return serialize(async () => {
    const { apiUrl, token } = await getCfg()
    if (!token) {
      await bumpStats({ lastError: 'Token belum diisi (buka Pengaturan extension)' })
      return
    }
    const endpoint = `${apiUrl.replace(/\/+$/, '')}/api/leads/ingest`
    for (;;) {
      const { queue = [] } = await chrome.storage.local.get('queue')
      if (!queue.length) break
      let res
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(queue[0]),
          signal: AbortSignal.timeout(15000),
        })
      } catch {
        await bumpStats({ lastError: 'Server tidak terjangkau, akan dicoba lagi' })
        return
      }
      if (res.status === 401 || res.status === 403) {
        await bumpStats({ lastError: 'Token ditolak server' })
        return
      }
      if (res.status === 429 || res.status >= 500) {
        await bumpStats({ lastError: `Server error ${res.status}, akan dicoba lagi` })
        return
      }
      // 2xx atau 4xx lain (payload buruk): buang item agar antrean tidak macet
      let body = {}
      try {
        body = await res.json()
      } catch {}
      await chrome.storage.local.set({ queue: queue.slice(1) })
      await bumpStats({ sent: 1, accepted: body.status === 'success' ? 1 : 0, lastError: '', at: Date.now() })
    }
  })
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'LEADS' && Array.isArray(msg.leads)) {
    enqueue(msg.leads.slice(0, 100)).then(flush)
  } else if (msg?.type === 'FLUSH') {
    flush().then(() => sendResponse({ ok: true }))
    return true
  } else if (msg?.type === 'TEST') {
    // Kirim payload kosong: 401 = token salah, 400 = token benar (auth dicek lebih dulu)
    getCfg().then(async ({ apiUrl, token }) => {
      try {
        const r = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/leads/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: '{}',
          signal: AbortSignal.timeout(10000),
        })
        sendResponse({ status: r.status })
      } catch {
        sendResponse({ status: 0 })
      }
    })
    return true
  }
})

chrome.alarms.create('flush', { periodInMinutes: 1 })
chrome.alarms.onAlarm.addListener((a) => a.name === 'flush' && flush())
chrome.runtime.onStartup.addListener(flush)


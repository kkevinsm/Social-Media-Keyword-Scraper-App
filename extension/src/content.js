/**
 * Content script: membaca postingan yang SUDAH tampil di halaman (X & Threads)
 * lalu mengirimkannya ke service worker. Tidak melakukan klik/scroll/request sendiri.
 */
(() => {
  const host = location.hostname
  const PLATFORM = host.endsWith('x.com') || host.endsWith('twitter.com') ? 'x' : 'threads'
  const MAX_TEXT = 1000
  const seen = new Set()
  let enabled = true
  let debounce = null

  const clean = (s) => (s || '').replace(/\u00a0/g, ' ').trim().slice(0, MAX_TEXT)

  function parseX(article) {
    if (article.querySelector('[data-testid="placementTracking"]')) return null // iklan
    const time = article.querySelector('time')
    const href = time?.closest('a')?.getAttribute('href')
    const m = href && href.match(/^\/([^/]+)\/status\/(\d+)/)
    if (!m) return null
    const text = clean(article.querySelector('[data-testid="tweetText"]')?.innerText)
    if (!text) return null
    const name = clean(article.querySelector('[data-testid="User-Name"] span span')?.textContent)
    return {
      platform: 'x',
      external_id: m[2],
      author_username: m[1],
      author_name: name || m[1],
      author_avatar_url: article.querySelector('[data-testid="Tweet-User-Avatar"] img')?.src || '',
      content: text,
      post_url: `https://x.com/${m[1]}/status/${m[2]}`,
      posted_at: time.getAttribute('datetime') || new Date().toISOString(),
    }
  }

  // Struktur DOM Threads berubah-ubah; parser ini best-effort berbasis link /@user/post/KODE.
  function parseThreads(anchor) {
    let path
    try {
      path = new URL(anchor.href, location.origin).pathname
    } catch {
      return null
    }
    const m = path.match(/^\/@([^/]+)\/post\/([^/?#]+)/)
    if (!m) return null
    const box = anchor.closest('[data-pressable-container="true"]') || anchor.parentElement?.parentElement?.parentElement
    if (!box) return null
    const lines = []
    box.querySelectorAll('span[dir="auto"]').forEach((el) => {
      if (el.closest('a')) return // lewati username & waktu
      const t = clean(el.innerText)
      if (t && lines[lines.length - 1] !== t) lines.push(t)
    })
    const text = clean(lines.join('\n'))
    if (!text) return null
    const time = anchor.querySelector('time') || box.querySelector('time')
    return {
      platform: 'threads',
      external_id: m[2],
      author_username: m[1],
      author_name: m[1],
      author_avatar_url: box.querySelector('img[alt*="profile picture" i]')?.src || '',
      content: text,
      post_url: `${location.origin}/@${m[1]}/post/${m[2]}`,
      posted_at: time?.getAttribute('datetime') || new Date().toISOString(),
    }
  }

  function scan() {
    if (!enabled) return
    const found = []
    if (PLATFORM === 'x') {
      document.querySelectorAll('article[data-testid="tweet"]').forEach((a) => found.push(parseX(a)))
    } else {
      document.querySelectorAll('a[href*="/post/"]').forEach((a) => {
        if (a.querySelector('time')) found.push(parseThreads(a))
      })
    }
    const fresh = found.filter((l) => l && !seen.has(`${l.platform}:${l.external_id}`))
    if (!fresh.length) return
    fresh.forEach((l) => seen.add(`${l.platform}:${l.external_id}`))
    try {
      chrome.runtime.sendMessage({ type: 'LEADS', leads: fresh })
    } catch {
      // Extension di-reload/update: konteks lama tidak valid, hentikan observer.
      observer.disconnect()
    }
  }

  const schedule = () => {
    clearTimeout(debounce)
    debounce = setTimeout(scan, 800)
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })

  // Pengaturan: nyala/mati + muat ulang otomatis (khusus halaman pencarian, default mati)
  let reloadTimer = null
  function applySettings(s) {
    enabled = s.enabled !== false
    clearTimeout(reloadTimer)
    const minutes = Number(s.reloadMinutes) || 0
    if (enabled && minutes >= 2 && location.pathname.startsWith('/search')) {
      reloadTimer = setTimeout(() => location.reload(), minutes * 60000)
    }
    if (enabled) schedule()
  }

  chrome.storage.local.get(['enabled', 'reloadMinutes'], applySettings)
  chrome.storage.onChanged.addListener((_c, area) => {
    if (area === 'local') chrome.storage.local.get(['enabled', 'reloadMinutes'], applySettings)
  })
})()


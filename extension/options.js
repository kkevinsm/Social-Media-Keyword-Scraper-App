const $ = (id) => document.getElementById(id)
const say = (t) => ($('msg').textContent = t)

chrome.storage.local.get(['apiUrl', 'token']).then(({ apiUrl, token }) => {
  $('apiUrl').value = apiUrl || 'https://web-seven-gilt-52.vercel.app'
  $('token').value = token || ''
})

function normalizeUrl(v) {
  const u = new URL(v.trim())
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol')
  return u.origin
}

$('save').addEventListener('click', async () => {
  try {
    await chrome.storage.local.set({ apiUrl: normalizeUrl($('apiUrl').value), token: $('token').value.trim() })
    say('Tersimpan ✓')
  } catch {
    say('URL tidak valid (harus diawali http:// atau https://)')
  }
})

$('test').addEventListener('click', async () => {
  $('save').click()
  say('Menguji…')
  const { status } = await chrome.runtime.sendMessage({ type: 'TEST' })
  say(
    status === 400 ? 'Terhubung & token benar ✓'
      : status === 401 ? 'Token salah ✗'
      : status === 0 ? 'Server tidak terjangkau (cek URL & apakah dashboard sedang jalan)'
      : `Respons tak terduga: HTTP ${status}`
  )
})


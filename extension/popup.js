const $ = (id) => document.getElementById(id)

async function render() {
  const { enabled = true, reloadMinutes = 0, queue = [], stats = {}, token = '' } = await chrome.storage.local.get([
    'enabled', 'reloadMinutes', 'queue', 'stats', 'token',
  ])
  $('enabled').checked = enabled !== false
  $('reload').value = String(reloadMinutes)
  const lines = [
    `Antrean: <b>${queue.length}</b>`,
    `Terkirim: <b>${stats.sent || 0}</b> · Lolos filter: <b>${stats.accepted || 0}</b>`,
  ]
  if (!token) lines.push('<span class="err">Token belum diisi — buka Pengaturan</span>')
  else if (stats.lastError) lines.push(`<span class="err">${stats.lastError}</span>`)
  $('stat').innerHTML = lines.join('<br>') // semua nilai berasal dari kode ini / angka, bukan konten postingan
}

$('enabled').addEventListener('change', (e) => chrome.storage.local.set({ enabled: e.target.checked }))
$('reload').addEventListener('change', (e) => chrome.storage.local.set({ reloadMinutes: Number(e.target.value) }))
$('flush').addEventListener('click', async () => {
  $('flush').disabled = true
  await chrome.runtime.sendMessage({ type: 'FLUSH' })
  $('flush').disabled = false
  render()
})
$('opts').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.runtime.openOptionsPage()
})

chrome.storage.onChanged.addListener(render)
render()


// Ticket 0804, macOS only: the Frame tools menu's place on every frame in real Safari (`safaridriver`, Safari >
// Develop > "Allow Remote Automation"). Serve a build on :4173 (`npx vite preview`), then run this; docs/testing.md.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

// A synthetic 8-column Project, in the app's stored form (`safari-seed.json`).
const seed = JSON.parse(readFileSync(new URL('./safari-seed.json', import.meta.url), 'utf8'))

const url = process.argv[2] ?? 'http://127.0.0.1:4173/bd-beads/'
const PORT = 4455
const driver = spawn('safaridriver', ['-p', String(PORT)], { stdio: 'ignore' })
const base = `http://127.0.0.1:${PORT}`
const call = async (method, path, body) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json()
  if (json.value?.error) throw new Error(`${path}: ${json.value.message}`)
  return json.value
}
let session
try {
  await sleep(1000)
  session = (await call('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } })).sessionId
  const run = (script, ...args) => call('POST', `/session/${session}/execute/sync`, { script, args })
  spawn('osascript', ['-e', 'tell application "Safari" to activate'], { stdio: 'ignore' })
  await call('POST', `/session/${session}/window/rect`, { width: 1400, height: 900 })
  // An 8-column Frame (safari-seed.json), so the band folds into the Frame tools menu.
  await call('POST', `/session/${session}/url`, { url })
  await run(`localStorage.setItem('openbeads:storage-note-seen', 'yes'); localStorage.setItem(arguments[0], arguments[1]); sessionStorage.setItem('openbeads:editor-chosen', '1')`, seed.key, seed.value)
  await call('POST', `/session/${session}/url`, { url })
  await sleep(2500)
  const found = await run(`return !!document.querySelector('[data-testid="margin-frame-tools"]')`)
  if (!found) throw new Error('No Frame tools button on screen: the seeded Project did not open.')
  await run(`
    const button = document.querySelector('[data-testid="margin-frame-tools"]')
    const rects = []
    const started = performance.now()
    const tick = () => {
      const list = document.querySelector('[data-testid="margin-frame-tools-mirror"]')?.closest('[popover]')
      const b = button.getBoundingClientRect()
      const r = list?.getBoundingClientRect()
      if (r && r.width) rects.push({ ms: Math.round(performance.now() - started), button: [b.left, b.bottom], menu: [r.left, r.top], clear: getComputedStyle(list).opacity === '0' })
      if (performance.now() - started < 600) requestAnimationFrame(tick)
      else window.__frames = rects
    }
    button.click()
    requestAnimationFrame(tick)
    return true`)
  let rects = null
  for (let i = 0; i < 20 && !rects; i++) {
    await sleep(500)
    rects = await run('return window.__frames')
  }
  if (!rects) throw new Error('Safari ran no animation frames (keep its window in front).')
  const bad = rects.filter((f) => !f.clear && (Math.abs(f.menu[1] - (f.button[1] + 4)) > 2 || f.menu[0] < 8))
  console.log(`${rects.length} frames recorded, ${bad.length} off their place (frame tools menu should be 4px under the button)`)
  for (const f of bad.slice(0, 10)) console.log(JSON.stringify(f))
  process.exitCode = bad.length || !rects.length ? 1 : 0
} finally {
  if (session) await call('DELETE', `/session/${session}`).catch(() => {})
  driver.kill()
}

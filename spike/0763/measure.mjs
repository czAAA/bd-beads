// Spike 0763: drive the spike page in a desktop browser (Playwright's chromium or webkit, or the real safari through
// safaridriver), every photo; print its table, the browser process's peak memory and any request off the origin.
//   node spike/0763/measure.mjs <page url> [chromium|webkit|safari] [--headed] [--device <name>] [--taps-only] [--compare] [--lean]
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { chromium, webkit } from '@playwright/test'

const [url, name = 'chromium', ...flags] = process.argv.slice(2)
const flag = (f) => flags.includes(f)
const at = flags.indexOf('--device')
const device = at >= 0 ? flags[at + 1] : 'desktop'
const PROCESS = { chromium: /ms-playwright.*Renderer/, webkit: /ms-playwright.*WebContent/, safari: /^(?!.*ms-playwright).*com\.apple\.WebKit\.WebContent/ }

// Each driver runs a script body in the page and returns its value.
async function playwright() {
  const browser = await { chromium, webkit }[name].launch({ headless: !flag('--headed') })
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1200, height: 900 } })
  const origin = new URL(url).origin
  const elsewhere = new Set()
  page.on('request', (r) => {
    if (!/^(blob|data):/.test(r.url()) && !r.url().startsWith(origin)) elsewhere.add(r.url())
  })
  page.on('pageerror', (e) => console.error('page error:', e.message))
  await page.goto(url)
  return {
    run: (body) => page.evaluate(`(() => { ${body} })()`),
    open: () => page.goto(url),
    elsewhere: () => [...elsewhere],
    close: () => browser.close(),
  }
}

async function safari() {
  const port = 4763
  const driver = spawn('/usr/bin/safaridriver', ['-p', String(port)], { stdio: 'inherit' })
  await new Promise((r) => setTimeout(r, 1500))
  const call = async (method, path, body) => {
    const res = await fetch(`http://localhost:${port}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok) throw new Error(`safaridriver ${path}: ${JSON.stringify(json.value)}`)
    return json.value
  }
  const { sessionId } = await call('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } })
  const s = `/session/${sessionId}`
  await call('POST', `${s}/window/rect`, { width: 1200, height: 1000 })
  await call('POST', `${s}/url`, { url })
  return {
    run: (body) => call('POST', `${s}/execute/sync`, { script: body, args: [] }),
    open: () => call('POST', `${s}/url`, { url }),
    // Safari's worker requests aren't visible here; the page's own resources are.
    elsewhere: () => call('POST', `${s}/execute/sync`, { script: `return performance.getEntriesByType('resource').map((e) => e.name).filter((n) => !n.startsWith(location.origin))`, args: [] }),
    close: async () => {
      await call('DELETE', s)
      driver.kill()
    },
  }
}

// The peak resident size of the largest browser process that grew since start(): the one running the page and its worker.
// Safari keeps that process's memory after a worker ends, so its growth on a later photo can be small.
function sampleMemory() {
  const base = new Map()
  const peak = new Map()
  let sampling = true
  const sample = async () => {
    const { stdout } = await promisify(execFile)('ps', ['-axo', 'pid=,rss=,command='], { maxBuffer: 1 << 24 })
    for (const line of stdout.split('\n')) {
      const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)
      if (!m || !PROCESS[name].test(m[3])) continue
      const kb = Number(m[2])
      if (!base.has(m[1])) base.set(m[1], kb)
      peak.set(m[1], Math.max(peak.get(m[1]) ?? 0, kb))
    }
  }
  const loop = (async () => {
    while (sampling) {
      await sample()
      await new Promise((r) => setTimeout(r, 200))
    }
  })()
  return async () => {
    sampling = false
    await loop
    let best = { peak: 0, growth: 0 }
    for (const [pid, kb] of peak) if (kb > base.get(pid) && kb > best.peak) best = { peak: kb, growth: kb - base.get(pid) }
    return { peakMb: (best.peak * 1024) / 1e6, growthMb: (best.growth * 1024) / 1e6 }
  }
}

const page = name === 'safari' ? await safari() : await playwright()
const status = () => page.run(`return document.getElementById('status').textContent`)
async function until(text) {
  for (;;) {
    const s = await status()
    if (s.startsWith('Failed')) throw new Error(s)
    if (s.startsWith(text)) return
    await new Promise((r) => setTimeout(r, 300))
  }
}
const click = (id) => page.run(`document.getElementById('${id}').click()`)
const tap = (fx, fy) => page.run(`
  const v = document.getElementById('view'), r = v.getBoundingClientRect()
  v.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width * ${fx}, clientY: r.top + r.height * ${fy}, bubbles: true }))`)

await until('Picture')
await page.run(`localStorage.clear()`)
await page.open()
await page.run(`const d = document.getElementById('device'); d.value = ${JSON.stringify(device)}; d.dispatchEvent(new Event('change'))`)
await until('Picture')
if (flag('--lean')) await click('lean')
const photos = await page.run(`return [...document.querySelectorAll('#photos option')].map((o) => o.value)`)
const memory = []
for (const photo of photos) {
  await page.run(`const p = document.getElementById('photos'); p.value = ${JSON.stringify(photo)}; p.dispatchEvent(new Event('change'))`)
  await until('Picture')
  await click('restart')
  await new Promise((r) => setTimeout(r, 1500)) // the old worker's memory goes back before the next run is sampled
  const stop = sampleMemory()
  if (flag('--taps-only')) {
    await tap(1 / 2, 1 / 2)
    await until('Done')
    await tap(2 / 3, 1 / 2)
    await until('Done')
  } else {
    await click('all')
    await until('Run all done')
  }
  memory.push({ photo, ...(await stop()) })
  if (flag('--compare')) {
    await click('compare')
    await until('Compare done')
  }
}
const rows = await page.run(`return JSON.parse(localStorage.getItem('spike-0763-rows'))`)
const cell = (v, d = 0) => (v === undefined || v === null ? '' : v.toFixed(d))
console.log(`${device}, ${name}\n\n| Photo | Step | Model | ms | MB | Wasm MB | Note |\n| --- | --- | --- | --- | --- | --- | --- |`)
for (const r of rows) console.log(`| ${r.photo} | ${r.step} | ${r.model} | ${cell(r.ms)} | ${cell(r.mb, 1)} | ${cell(r.wasmMb)} | ${r.note ?? ''} |`)
console.log('\n| Photo | Peak process memory MB (ps RSS) | Grew by MB |\n| --- | --- | --- |')
for (const m of memory) console.log(`| ${m.photo} | ${cell(m.peakMb)} | ${cell(m.growthMb)} |`)
const elsewhere = await page.elsewhere()
console.log(elsewhere.length ? `\nRequests elsewhere:\n${elsewhere.join('\n')}` : '\nNo request left the page\'s origin.')
await page.close()

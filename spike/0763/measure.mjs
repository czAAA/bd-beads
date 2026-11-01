// Spike 0763: drive the spike page in a desktop browser through Playwright, every photo, and print its table and every
// request that left the page's own origin (there should be none).
//   node spike/0763/measure.mjs <page url> [chromium|webkit] [--taps-only] [--compare] [--lean]
import { chromium, webkit } from '@playwright/test'

const [url, name = 'chromium', ...flags] = process.argv.slice(2)
const browser = await { chromium, webkit }[name].launch()
const page = await browser.newPage({ ignoreHTTPSErrors: true })
const origin = new URL(url).origin
const elsewhere = new Set()
page.on('request', (r) => {
  if (!r.url().startsWith(origin) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) elsewhere.add(r.url())
})
page.on('pageerror', (e) => console.error('page error:', e.message))

const until = async (text) => {
  await page.waitForFunction((t) => {
    const s = document.getElementById('status').textContent
    return s.startsWith(t) || s.startsWith('Failed')
  }, text, { timeout: 600_000 })
  const s = await page.textContent('#status')
  if (s.startsWith('Failed')) throw new Error(s)
}

await page.goto(url)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.fill('#device', `desktop ${name} (Playwright)`)
await page.dispatchEvent('#device', 'change')
await until('Picture')
if (flags.includes('--lean')) await page.check('#lean')
const photos = await page.$$eval('#photos option', (o) => o.map((x) => x.value))
for (const photo of photos) {
  await page.selectOption('#photos', photo)
  await until('Picture')
  if (flags.includes('--taps-only')) {
    await page.click('#restart')
    const box = await page.locator('#view').boundingBox()
    await page.locator('#view').click({ position: { x: box.width / 2, y: box.height / 2 } })
    await until('Done')
    await page.locator('#view').click({ position: { x: box.width * 2 / 3, y: box.height / 2 } })
    await until('Done')
  } else {
    await page.click('#all')
    await until('Run all done')
  }
  if (flags.includes('--compare')) {
    await page.click('#compare')
    await until('Compare done')
  }
}
const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('spike-0763-rows')))
const cell = (v, d = 0) => (v === undefined ? '' : v.toFixed(d))
console.log('| Photo | Step | Model | ms | MB | Wasm MB | Note |\n| --- | --- | --- | --- | --- | --- | --- |')
for (const r of rows) console.log(`| ${r.photo} | ${r.step} | ${r.model} | ${cell(r.ms)} | ${cell(r.mb, 1)} | ${cell(r.wasmMb)} | ${r.note ?? ''} |`)
console.log(elsewhere.size ? `Requests elsewhere:\n${[...elsewhere].join('\n')}` : 'No request left the page\'s origin.')
await browser.close()

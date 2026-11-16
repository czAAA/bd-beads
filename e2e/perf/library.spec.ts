import { test } from '@playwright/test'
import { busyMs, throttle } from './measure'
import { gridBox, openApp, setZoom, settle } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'

// The library's start and save (ticket 1020), `npm run perf -- library`: many Projects seeded in localStorage. Reports the
// start of the editor, the first (which copies the old library) and the next, and what the main thread spends on a stroke
// and the save it starts. Env: PERF_SLOWDOWNS (4), PERF_LIBRARY (Projects, 30).

const SLOWDOWN = Number((process.env.PERF_SLOWDOWNS ?? '4').split(',')[0])
const PROJECTS = Number(process.env.PERF_LIBRARY ?? 30)
const STROKES = 30
const BASE = 1_700_000_000_000

test(`start and save with ${PROJECTS} Projects at ${SLOWDOWN}× slowdown`, async ({ page }) => {
  const library = Array.from({ length: PROJECTS }, (_, index) => ({
    ...fixtureProject({ technique: 'loom', columns: 60, rows: 90 }),
    id: `perf-${index}`,
    updatedAt: BASE + index,
    savedAt: BASE + index,
  }))
  const cdp = await throttle(page, SLOWDOWN)

  const firstStarted = Date.now()
  await openApp(page, library)
  const first = Date.now() - firstStarted

  const warm: number[] = []
  for (let run = 0; run < 5; run += 1) {
    const started = Date.now()
    await page.reload()
    await page.getByTestId('app-canvas').waitFor({ state: 'visible' })
    warm.push(Date.now() - started)
  }
  warm.sort((a, b) => a - b)

  await setZoom(page, 100)
  const grid = await gridBox(page)
  const busy: number[] = []
  for (let stroke = 0; stroke < STROKES; stroke += 1) {
    const row = 2 + (stroke % 6)
    const start = beadCentre({ technique: 'loom', rotation: 0 }, grid, 1, { row, column: 1 })
    const end = beadCentre({ technique: 'loom', rotation: 0 }, grid, 1, { row, column: 6 })
    await page.mouse.move(start.x, start.y)
    await settle(page)
    const before = await busyMs(cdp)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 4 })
    await page.mouse.up()
    await settle(page)
    await new Promise((resolve) => setTimeout(resolve, 150))
    busy.push((await busyMs(cdp)) - before)
  }
  busy.sort((a, b) => a - b)
  const median = (values: number[]) => values[Math.floor(values.length / 2)]!

  console.log(
    `\nlibrary of ${PROJECTS} Projects at ${SLOWDOWN}× slowdown\n` +
      `first start (copy included)  ${first} ms\n` +
      `next start, median of ${warm.length}      ${median(warm)} ms (min ${warm[0]}, max ${warm.at(-1)})\n` +
      `a stroke and its save, main-thread busy, median of ${STROKES}: ${Math.round(median(busy))} ms (min ${Math.round(busy[0]!)}, max ${Math.round(busy.at(-1)!)})\n`,
  )
})

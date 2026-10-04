import { test, type CDPSession, type Page } from '@playwright/test'
import { openApp, projectBox, settle } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'
import { fixturePicture } from '../support/picture'

/**
 * The performance check (ticket 103, ADR 0018), run by hand: `npm run perf`. It drives the production build in a real
 * browser at a chosen CPU slowdown and prints how the app holds up at the sizes that matter. Not part of CI, since a
 * shared runner's timings are too noisy to gate on.
 *
 *   PERF_SLOWDOWNS=4,6   the CPU slowdown factors to report at (default 4,6; 4 is a midrange Android tablet or a Core i3
 *                        laptop, "the floor"; 6 is a rougher one)
 *   PERF_SIZES=60x90,... limit the Project sizes (default 60x90,70x250,250x250)
 *   PERF_ONLY=hover,...  limit the interactions (open, hover, paint, select, paste, scroll, zoom, framing)
 *   PERF_TECHNIQUES=...  the Techniques the framing drag is measured in (default loom; loom,peyote,brick for all)
 *
 * Every interaction reports frames per second while it is being done continuously for a couple of seconds (the
 * browser produces a frame only when the main thread is free, so a slow render shows up as few frames), and the main
 * thread's busy milliseconds per frame. "open" and "zoom" are one-off actions, so they report how long one takes.
 */

const SLOWDOWNS = (process.env.PERF_SLOWDOWNS ?? '4,6').split(',').map(Number)
const SIZES = (process.env.PERF_SIZES ?? '60x90,70x250,250x250').split(',').map((size) => {
  const [columns, rows] = size.split('x').map(Number) as [number, number]
  return { columns, rows }
})
const FRAMING_SIZES = [...new Set(['60x90', '100x100', ...SIZES.map(({ columns, rows }) => `${columns}x${rows}`)])].map((size) => {
  const [columns, rows] = size.split('x').map(Number) as [number, number]
  return { columns, rows }
})
const TECHNIQUES = (process.env.PERF_TECHNIQUES ?? 'loom').split(',') as ('loom' | 'peyote' | 'brick')[]
const ONLY = process.env.PERF_ONLY?.split(',')
const wanted = (name: string) => !ONLY || ONLY.includes(name)

/** How long each continuous interaction runs. */
const BURST_MS = 2000
const WARM_UP_MS = 500
const FRAME_BUDGET_MS = 1000 / 60

interface Result {
  slowdown: number
  size: string
  what: string
  /** Frames per second over the burst, or undefined for a one-off. */
  fps?: number
  /** Main-thread busy time per frame (bursts) or for the whole action (one-offs), in ms. */
  ms: number
  note?: string
}
const results: Result[] = []

async function throttle(page: Page, slowdown: number): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: slowdown })
  await cdp.send('Performance.enable')
  return cdp
}

async function busyMs(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics')
  return (metrics.find((metric) => metric.name === 'TaskDuration')?.value ?? 0) * 1000
}

/** Counts frames in the page until stopped. */
async function startFrameCounter(page: Page): Promise<void> {
  await page.evaluate(() => {
    const counter = { frames: 0, running: true }
    ;(window as unknown as { __frames: typeof counter }).__frames = counter
    const tick = () => {
      counter.frames += 1
      if (counter.running) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  })
}

async function stopFrameCounter(page: Page): Promise<number> {
  return page.evaluate(() => {
    const counter = (window as unknown as { __frames: { frames: number; running: boolean } }).__frames
    counter.running = false
    return counter.frames
  })
}

/** Runs `step` over and over for BURST_MS, and reports the frame rate and the main-thread cost per frame. */
async function burst(page: Page, cdp: CDPSession, step: (index: number) => Promise<void>): Promise<{ fps: number; ms: number }> {
  // A short unmeasured run first, so the page's first-time costs (compiling, caches) are not counted as steady state.
  const warmUntil = Date.now() + WARM_UP_MS
  for (let index = 0; Date.now() < warmUntil; index += 1) {
    await step(index)
  }
  await settle(page)
  const busyBefore = await busyMs(cdp)
  await startFrameCounter(page)
  const started = Date.now()
  let index = 0
  while (Date.now() - started < BURST_MS) {
    await step(index)
    index += 1
  }
  const elapsed = (Date.now() - started) / 1000
  const frames = Math.max(1, await stopFrameCounter(page))
  const busy = (await busyMs(cdp)) - busyBefore
  return { fps: frames / elapsed, ms: busy / frames }
}

function label({ columns, rows }: { columns: number; rows: number }): string {
  return `${columns}×${rows}`
}

/** A painted Project of this size to open, plus a tiny one to come from, so "open" starts from somewhere else. */
function libraryFor(columns: number, rows: number) {
  return [
    { ...fixtureProject({ technique: 'loom', columns: 4, rows: 4 }), id: 'small', updatedAt: 1_700_000_000_000 },
    { ...fixtureProject({ technique: 'loom', columns, rows }), id: 'big', name: 'Big', updatedAt: 1_600_000_000_000 },
  ]
}

async function openProject(page: Page, id: string): Promise<void> {
  await page.getByTestId(`select-project-${id}`).click()
  await page.getByTestId('confirm-modal-confirm').click()
  await settle(page)
}

/**
 * The centres of the beads that are on screen right now, in the order a pointer sweeping the page would meet them
 * (row by row): only beads a person could actually point at count, however big the Project is.
 */
function onScreenBeads(
  project: ReturnType<typeof fixtureProject>,
  box: { x: number; y: number; width: number; height: number },
  zoom: number,
  viewport: { width: number; height: number },
): { x: number; y: number }[] {
  const margin = 40
  const beads: { x: number; y: number }[] = []
  for (let row = 0; row < project.frame!.rows; row += 1) {
    for (let column = 0; column < project.frame!.columns; column += 1) {
      const centre = beadCentre(project, box, zoom, { row, column })
      if (centre.x > margin && centre.x < viewport.width - margin && centre.y > margin && centre.y < viewport.height - margin) {
        beads.push(centre)
      }
    }
  }
  return beads
}

/** Steps that walk the pointer around the beads on screen in a fixed, spread-out order, so runs are comparable. */
function sweep(page: Page, beads: { x: number; y: number }[]) {
  return async (index: number) => {
    const bead = beads[(index * 7) % beads.length]!
    await page.mouse.move(bead.x, bead.y)
  }
}

for (const slowdown of SLOWDOWNS) {
  for (const size of SIZES) {
    const name = label(size)

    test(`${name} at ${slowdown}× slowdown`, async ({ page }) => {
      const library = libraryFor(size.columns, size.rows)
      const big = library[1]!
      await openApp(page, library)
      const cdp = await throttle(page, slowdown)

      if (wanted('open')) {
        await openProject(page, 'small')
        const busyBefore = await busyMs(cdp)
        const started = Date.now()
        await openProject(page, 'big')
        results.push({ slowdown, size: name, what: 'open', ms: Date.now() - started, note: `busy ${Math.round((await busyMs(cdp)) - busyBefore)} ms` })
      } else {
        await openProject(page, 'big')
      }

      // The zoom a Project opens at: fit for a big one, 100% for a small one. Hover and paint are measured on the beads
      // that are on screen at that zoom, with the top of the grid brought to the top of the window.
      await page.getByTestId('zoom-reset').click()
      const grid = page.getByTestId('project-surface')
      await grid.evaluate((element) => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 120))
      await settle(page)
      const zoomPercent = Number.parseInt((await page.getByTestId('zoom-level').textContent()) ?? '100', 10)
      const zoom = zoomPercent / 100
      const box = await projectBox(page, (await grid.boundingBox())!)
      const beads = onScreenBeads(big, box, zoom, page.viewportSize()!)

      if (wanted('hover')) {
        const { fps, ms } = await burst(page, cdp, sweep(page, beads))
        results.push({ slowdown, size: name, what: 'hover', fps, ms, note: `at ${zoomPercent}% zoom, ${beads.length} beads on screen` })
      }

      if (wanted('paint')) {
        await page.mouse.move(beads[0]!.x, beads[0]!.y)
        await page.mouse.down()
        const { fps, ms } = await burst(page, cdp, sweep(page, beads))
        await page.mouse.up()
        results.push({ slowdown, size: name, what: 'paint', fps, ms, note: `at ${zoomPercent}% zoom, ${beads.length} beads on screen` })
      }

      if (wanted('select')) {
        // A Selection marked out by dragging the marquee to and fro across the beads on screen.
        await page.getByTestId('tool-select').click()
        await page.mouse.move(beads[0]!.x, beads[0]!.y)
        await page.mouse.down()
        const { fps, ms } = await burst(page, cdp, sweep(page, beads))
        await page.mouse.up()
        results.push({ slowdown, size: name, what: 'select drag', fps, ms, note: `at ${zoomPercent}% zoom` })

        if (wanted('paste')) {
          // A small block marked out and copied, then held under the pointer as it moves: the paste preview.
          const anchor = beads[Math.floor(beads.length / 2)]!
          const corner = beads[Math.floor(beads.length / 2) + 3 * Math.max(1, Math.round(1 / zoom))]!
          await page.mouse.move(anchor.x, anchor.y)
          await page.mouse.down()
          await page.mouse.move(corner.x, corner.y + 30, { steps: 4 })
          await page.mouse.up()
          await page.getByTestId('copy-button').click()
          const hovered = await burst(page, cdp, sweep(page, beads))
          results.push({ slowdown, size: name, what: 'paste hover', fps: hovered.fps, ms: hovered.ms, note: `at ${zoomPercent}% zoom` })
        }
        await page.getByTestId('tool-paint').click()
      }

      if (wanted('scroll')) {
        await page.mouse.move(box.x + box.width / 2, 300)
        const { fps, ms } = await burst(page, cdp, async (index) => {
          await page.mouse.wheel(0, index % 8 < 4 ? 120 : -120)
        })
        results.push({ slowdown, size: name, what: 'scroll', fps, ms })
      }

      if (wanted('zoom')) {
        const busyBefore = await busyMs(cdp)
        const started = Date.now()
        await page.getByTestId('zoom-in').click()
        await settle(page)
        const inMs = Date.now() - started
        const started2 = Date.now()
        await page.getByTestId('zoom-out').click()
        await settle(page)
        results.push({ slowdown, size: name, what: 'zoom step', ms: (inMs + Date.now() - started2) / 2, note: `busy ${Math.round(((await busyMs(cdp)) - busyBefore) / 2)} ms` })
      }
    })
  }

  if (wanted('framing')) {
    for (const [technique, size] of TECHNIQUES.flatMap((technique) => FRAMING_SIZES.map((size) => [technique, size] as const))) {
      const name = TECHNIQUES.length > 1 ? `${label(size)} ${technique}` : label(size)

      test(`framing ${name} at ${slowdown}× slowdown`, async ({ page }) => {
        await openApp(page, [])
        await page.getByTestId('technique-select').locator(`[data-value="${technique}"]`).click()
        await page.getByTestId('width-input').fill(String(size.columns))
        await page.getByTestId('height-input').fill(String(size.rows))
        await page.getByTestId('convert-image-input').setInputFiles({
          name: 'fixture.png',
          mimeType: 'image/png',
          buffer: fixturePicture(480, 320),
        })
        const preview = page.getByTestId('convert-image-box')
        try {
          await preview.waitFor({ timeout: 10_000 })
        } catch {
          results.push({ slowdown, size: name, what: 'framing drag', ms: NaN, note: 'no framing step appeared' })
          return
        }
        await page.getByTestId('zoom-in').click()
        await page.getByTestId('zoom-in').click()
        const cdp = await throttle(page, slowdown)
        // The part of the preview that is on screen: a tall frame reaches far below the fold.
        await preview.scrollIntoViewIfNeeded()
        const box = (await preview.boundingBox())!
        const viewport = page.viewportSize()!
        const shown = {
          x: Math.max(box.x, 0),
          y: Math.max(box.y, 0),
          width: Math.min(box.x + box.width, viewport.width) - Math.max(box.x, 0),
          height: Math.min(box.y + box.height, viewport.height) - Math.max(box.y, 0),
        }
        await page.mouse.move(shown.x + shown.width * 0.5, shown.y + shown.height * 0.5)
        await page.mouse.down()
        const { fps, ms } = await burst(page, cdp, async (index) => {
          const phase = index % 40
          const t = phase < 20 ? phase / 20 : (40 - phase) / 20
          await page.mouse.move(shown.x + shown.width * (0.35 + 0.3 * t), shown.y + shown.height * (0.4 + 0.2 * t))
        })
        await page.mouse.up()
        results.push({ slowdown, size: name, what: 'framing drag', fps, ms })
      })
    }
  }
}

test.afterAll(() => {
  const order = ['open', 'hover', 'paint', 'select drag', 'paste hover', 'scroll', 'zoom step', 'framing drag']
  const lines = ['', 'Performance check (production build; fps over a 2 s burst, ms = main-thread busy per frame or per action)', '']
  for (const slowdown of SLOWDOWNS) {
    lines.push(`── ${slowdown}× CPU slowdown ${'─'.repeat(60)}`)
    const rows = results
      .filter((result) => result.slowdown === slowdown)
      .sort((a, b) => order.indexOf(a.what) - order.indexOf(b.what) || a.size.localeCompare(b.size, undefined, { numeric: true }))
    for (const { what, size, fps, ms, note } of rows) {
      const rate = fps === undefined ? '        ' : `${fps.toFixed(0).padStart(3)} fps `
      const cost = Number.isNaN(ms) ? '   n/a' : `${ms.toFixed(0).padStart(5)} ms`
      const verdict = fps === undefined ? '' : fps >= 30 ? '' : ' (below 30)'
      lines.push(`${what.padEnd(13)} ${size.padEnd(9)} ${rate}${cost}${verdict}${note ? `  ${note}` : ''}`)
    }
    lines.push('')
  }
  lines.push(`(a frame is ${FRAME_BUDGET_MS.toFixed(1)} ms at 60 fps; 30 fps is the floor)`)
  console.log(lines.join('\n'))
})

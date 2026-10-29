import { test, type CDPSession, type Page } from '@playwright/test'
import { busyMs, startFrameCounter, stopFrameCounter, throttle } from './measure'
import { chooseNewProjectTechnique, copySelection, currentZoomPercent, openApp, openStripPanel, openNewProjectForm, projectBox, selectTool, settle, convertPicture } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'
import { fixturePicture } from '../support/picture'

// The performance check (ticket 103, ADR 0018), run by hand: `npm run perf`, not in CI (noisy runner timings).
// Env: PERF_SLOWDOWNS (default 4,6), PERF_SIZES (default 60x90,70x250,250x250), PERF_ONLY (framing, crop, …), PERF_TECHNIQUES.
// Reports fps and busy ms per frame for continuous interactions; 'open' and 'zoom' are one-off, so report duration.

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
  await openStripPanel(page, 'strip-menu')
  await page.getByTestId('menu-saved-projects').click()
  await settle(page)
  await page.getByTestId(`select-project-${id}`).click()
  await settle(page)
  // Picking the Project that is already open asks nothing and changes nothing.
  const confirm = page.getByTestId('confirm-modal-confirm')
  if ((await confirm.count()) > 0) {
    await confirm.click()
    await settle(page)
  }
}

/** The centres of the on-screen beads, row by row as a sweeping pointer would meet them: only beads a person can
 * point at. */
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
      const zoomPercent = await currentZoomPercent(page)
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
        await selectTool(page, 'select')
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
          await copySelection(page)
          const hovered = await burst(page, cdp, sweep(page, beads))
          results.push({ slowdown, size: name, what: 'paste hover', fps: hovered.fps, ms: hovered.ms, note: `at ${zoomPercent}% zoom` })
        }
        await selectTool(page, 'paint')
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
        await openNewProjectForm(page)
        await chooseNewProjectTechnique(page, technique)
        await convertPicture(page, fixturePicture(480, 320), size)
        const preview = page.getByTestId('convert-image-box')
        try {
          await preview.waitFor({ timeout: 10_000 })
        } catch {
          results.push({ slowdown, size: name, what: 'framing drag', ms: NaN, note: 'no framing step appeared' })
          return
        }
        // The picture at 150%, so there is picture to drag under the Frame (By size).
        await page.getByTestId('convert-picture-zoom').focus()
        await page.keyboard.press('ArrowRight')
        await page.keyboard.press('ArrowRight')
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

  // By Pixel to bead ratio (spec 0645): one pixel one bead, the bottom-right crop handle dragged back and forth.
  if (wanted('crop')) {
    for (const [technique, size] of TECHNIQUES.flatMap((technique) => FRAMING_SIZES.map((size) => [technique, size] as const))) {
      const name = TECHNIQUES.length > 1 ? `${label(size)} ${technique}` : label(size)

      test(`crop ${name} at ${slowdown}× slowdown`, async ({ page }) => {
        await openApp(page, [])
        await openNewProjectForm(page)
        await chooseNewProjectTechnique(page, technique)
        await convertPicture(page, fixturePicture(size.columns, size.rows))
        if ((await page.getByTestId('convert-size-mode').locator('[aria-checked="true"]').getAttribute('data-value')) !== 'ratio') {
          await page.getByTestId('convert-size-mode').locator('[data-value="ratio"]').click()
        }
        await page.getByTestId('ratio-1-1').click()
        const handle = page.getByTestId('convert-crop-bottomRight')
        const box = (await handle.boundingBox())!
        const cdp = await throttle(page, slowdown)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        const { fps, ms } = await burst(page, cdp, async (index) => {
          const phase = index % 40
          const t = phase < 20 ? phase / 20 : (40 - phase) / 20
          await page.mouse.move(box.x + box.width / 2 - 60 * t, box.y + box.height / 2 - 40 * t)
        })
        await page.mouse.up()
        results.push({ slowdown, size: name, what: 'crop drag', fps, ms })
      })
    }
  }
}

test.afterAll(() => {
  const order = ['open', 'hover', 'paint', 'select drag', 'paste hover', 'scroll', 'zoom step', 'framing drag', 'crop drag']
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

import { test, type Page } from '@playwright/test'
import type { BeadMap } from '../../src/domain/canvas'
import { findBuiltInColor } from '../../src/domain/palette'
import type { Project } from '../../src/domain/project'
import type { Technique } from '../../src/domain/weave'
import { withLayers } from '../../src/testUtils/layerFields'
import { openApp, selectTool, settle } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'

// A Piece carried by the Piece tool against the same beads following the pointer as a paste (ticket 1150), in Safari's
// engine at a MacBook's density, `E2E_PORT=<a free port> npm run perf -- pieceCarry`: frames drawn, the longest and the
// mean gap between two frames, and how long the drag took, over the same path. Env: PERF_CARRY (fixture names).

const ONLY = process.env.PERF_CARRY?.split(',')
const MOVES = 90
/** Px a move goes along and down. */
const STEP = { x: 4, y: 2 }
/** A real mouse reports about this often. */
const MOVE_EVERY_MS = 8

test.use({ browserName: 'webkit', deviceScaleFactor: 2, viewport: { width: 1710, height: 907 } })

const [GREY, RED, BLUE] = ['grey', 'red', 'blue'].map((id) => findBuiltInColor(id)!.hex) as [string, string, string]

/** An open Canvas with a full Piece of `side` × `side` beads at its start, and `others` small Pieces above it, clear
 * of where it is carried: a Piece waits at a place it can't lie whole. */
function canvasWith(technique: Technique, side: number, others = 6): Project {
  const beads: BeadMap = {}
  const put = (row: number, column: number, color: string) => ((beads[row] ??= {})[column] = color)
  for (let row = 0; row < side; row += 1) for (let column = 0; column < side; column += 1) put(row, column, (row + column) % 7 === 0 ? RED : GREY)
  for (let other = 0; other < others; other += 1) {
    for (let row = 0; row < 12; row += 1) for (let column = 0; column < 12; column += 1) put(row - 20, other * 16 + column, BLUE)
  }
  const open = withLayers(fixtureProject({ technique, blank: true }), { frame: undefined })
  return { ...withLayers(open, { beads }), id: `carry-${technique}-${side}` }
}

const FIXTURES: Record<string, () => Project> = {
  'loom 20': () => canvasWith('loom', 20),
  'loom 60': () => canvasWith('loom', 60),
  'peyote 60': () => canvasWith('peyote', 60),
  'loom 120': () => canvasWith('loom', 120),
}

interface Watch {
  stamps: number[]
  running: boolean
}

async function watchFrames(page: Page): Promise<void> {
  await page.evaluate(() => {
    const watch = { stamps: [performance.now()], running: true }
    ;(window as unknown as { __watch: typeof watch }).__watch = watch
    const tick = (now: number) => {
      watch.stamps.push(now)
      if (watch.running) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

async function frames(page: Page): Promise<{ frames: number; longest: number; mean: number; over33: number }> {
  return page.evaluate(() => {
    const watch = (window as unknown as { __watch: Watch }).__watch
    watch.running = false
    const stamps = [...watch.stamps, performance.now()]
    const gaps = stamps.slice(1).map((stamp, index) => stamp - stamps[index]!)
    return { frames: gaps.length, longest: Math.max(...gaps), mean: gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length, over33: gaps.filter((gap) => gap > 33).length }
  })
}

const lines: string[] = []

for (const [name, build] of Object.entries(FIXTURES)) {
  if (ONLY && !ONLY.includes(name)) continue
  test(`a Piece of ${name} carried by the Piece tool and as a paste`, async ({ page }) => {
    test.setTimeout(5 * 60_000)
    const project = build()
    await openApp(page, [project])
    await page.waitForTimeout(1000)
    const surface = page.getByTestId('project-surface')
    const where = async (row: number, column: number) => {
      const box = (await surface.boundingBox())!
      const zoom = Number(await surface.getAttribute('data-zoom'))
      const scroll = { x: Number(await surface.getAttribute('data-scroll-x')), y: Number(await surface.getAttribute('data-scroll-y')) }
      return beadCentre(project, box, zoom, { row, column }, scroll)
    }
    const measure = async (what: string, act: () => Promise<void>) => {
      await settle(page)
      await watchFrames(page)
      const began = Date.now()
      await act()
      const took = Date.now() - began
      const seen = await frames(page)
      const zoom = await page.getByTestId('canvas-strip-zoom').getAttribute('data-zoom-percent')
      lines.push(
        `${name.padEnd(10)} at ${`${zoom}%`.padEnd(5)} ${what.padEnd(12)} ${String(took).padStart(6)} ms  ${String(seen.frames).padStart(4)} frames  mean ${seen.mean.toFixed(1).padStart(6)} ms  longest ${seen.longest.toFixed(0).padStart(5)} ms  ${String(seen.over33).padStart(3)} over 33 ms`,
      )
    }
    const path = async (from: { x: number; y: number }) => {
      for (let index = 1; index <= MOVES; index += 1) {
        await page.mouse.move(from.x + STEP.x * index, from.y + STEP.y * index)
        await page.waitForTimeout(MOVE_EVERY_MS)
      }
    }

    await selectTool(page, 'piece')
    const held = await where(3, 3)
    await page.mouse.click(held.x, held.y)
    await settle(page)
    await page.mouse.move(held.x, held.y)
    await page.mouse.down()
    await measure('Piece carry', () => path(held))
    await page.mouse.up()
    await page.waitForTimeout(500)
    await page.keyboard.press('ControlOrMeta+z')
    await page.waitForTimeout(500)

    // The same beads as a paste: cut, then the stamp follows the pointer over the same path.
    await page.mouse.click(held.x, held.y)
    await settle(page)
    await page.keyboard.press('ControlOrMeta+x')
    await page.waitForTimeout(500)
    await page.mouse.move(held.x, held.y)
    await measure('paste stamp', () => path(held))
  })
}

test.afterAll(() => {
  console.log(['', 'A Piece carried by the Piece tool against the same beads as a paste, WebKit at 2× (ticket 1150)', ...lines, ''].join('\n'))
})

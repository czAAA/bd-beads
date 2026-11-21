import { test, type Page } from '@playwright/test'
import type { BeadMap } from '../../src/domain/canvas'
import { findBuiltInColor } from '../../src/domain/palette'
import type { Project } from '../../src/domain/project'
import type { Technique } from '../../src/domain/weave'
import { withLayers } from '../../src/testUtils/layerFields'
import { openApp, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

// A two-finger twist and a two-finger pan over the Canvas and its Frame (ticket 1187: each drawn on its own surface), in
// Safari's engine at an iPad's density, `E2E_PORT=<a free port> npm run perf -- surfaceTwist`: frames drawn, the mean
// and the longest gap between two frames and how many gaps were over 33 ms. Env: PERF_TECHNIQUES (default loom,peyote).

const TECHNIQUES = (process.env.PERF_TECHNIQUES ?? 'loom,peyote').split(',') as Technique[]
const MOVES = 60
/** An iPad reports a touch about this often. */
const MOVE_EVERY_MS = 16

test.use({ browserName: 'webkit', deviceScaleFactor: 2, viewport: { width: 1366, height: 1024 }, hasTouch: true })

const [GREY, RED] = ['grey', 'red'].map((id) => findBuiltInColor(id)!.hex) as [string, string]

/** A 60 × 60 Frame of beads at the middle of a 160 × 160 Canvas of beads round it. */
function framedCanvas(technique: Technique): Project {
  const beads: BeadMap = {}
  for (let row = -50; row < 110; row += 1) {
    for (let column = -50; column < 110; column += 1) (beads[row] ??= {})[column] = (row + column) % 7 === 0 ? RED : GREY
  }
  return { ...withLayers(fixtureProject({ technique, columns: 60, rows: 60 }), { beads }), id: `twist-${technique}` }
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

/** Two touches on the surface, moved together: each step gives both fingers' points in client px. */
async function twoFingers(page: Page, path: (step: number) => [{ x: number; y: number }, { x: number; y: number }]): Promise<void> {
  const fire = (type: string, id: number, point: { x: number; y: number }) =>
    page.evaluate(
      ({ type, id, point }) => {
        const surface = document.querySelector('[data-testid="project-surface"]')!
        surface.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: point.x, clientY: point.y, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1 }))
      },
      { type, id, point },
    )
  const [a, b] = path(0)
  await fire('pointerdown', 1, a)
  await fire('pointerdown', 2, b)
  for (let step = 1; step <= MOVES; step += 1) {
    const [p, q] = path(step)
    await fire('pointermove', 1, p)
    await fire('pointermove', 2, q)
    await page.waitForTimeout(MOVE_EVERY_MS)
  }
  const [p, q] = path(MOVES)
  await fire('pointerup', 1, p)
  await fire('pointerup', 2, q)
}

const lines: string[] = []

for (const technique of TECHNIQUES) {
  test(`a twist and a pan over a Frame on a full ${technique} Canvas`, async ({ page }) => {
    test.setTimeout(5 * 60_000)
    await openApp(page, [framedCanvas(technique)])
    await page.waitForTimeout(1500)
    const box = (await page.getByTestId('project-surface').boundingBox())!
    const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const measure = async (what: string, act: () => Promise<void>) => {
      await settle(page)
      await watchFrames(page)
      const began = Date.now()
      await act()
      const took = Date.now() - began
      const seen = await frames(page)
      await page.waitForTimeout(800)
      // What the gesture did, so a run that missed it shows: the quarter turn the Canvas settled on and the scroll.
      const surface = page.getByTestId('project-surface')
      const [rotation, x, y] = await Promise.all(['data-rotation', 'data-scroll-x', 'data-scroll-y'].map((name) => surface.getAttribute(name)))
      const did = `at ${rotation}°, scroll ${Math.round(Number(x))}, ${Math.round(Number(y))}`
      lines.push(
        `${technique.padEnd(7)} ${what.padEnd(6)} ${String(took).padStart(6)} ms  ${String(seen.frames).padStart(4)} frames  mean ${seen.mean.toFixed(1).padStart(6)} ms  longest ${seen.longest.toFixed(0).padStart(5)} ms  ${String(seen.over33).padStart(3)} over 33 ms  (${did})`,
      )
    }
    // A 60° twist about the middle, the fingers 300 px apart.
    await measure('twist', () =>
      twoFingers(page, (step) => {
        const angle = ((step / MOVES) * 60 * Math.PI) / 180
        const [dx, dy] = [150 * Math.cos(angle), 150 * Math.sin(angle)]
        return [{ x: middle.x - dx, y: middle.y - dy }, { x: middle.x + dx, y: middle.y + dy }]
      }),
    )
    // A 360 px pan with both fingers.
    await measure('pan', () =>
      twoFingers(page, (step) => {
        const by = (step / MOVES) * 360
        return [{ x: middle.x - 150 + by, y: middle.y + by / 3 }, { x: middle.x + 150 + by, y: middle.y + by / 3 }]
      }),
    )
  })
}

test.afterAll(() => {
  console.log(['', 'A two-finger twist and pan over a Frame on a full Canvas, WebKit at 2× (ticket 1187)', ...lines, ''].join('\n'))
})

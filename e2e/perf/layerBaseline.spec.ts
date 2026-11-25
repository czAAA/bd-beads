import { test, type Page } from '@playwright/test'
import { withFrameSheet } from '../../src/domain/frameSheet'
import { frameIdOf } from '../../src/domain/layerRecord'
import type { BeadMap } from '../../src/domain/canvas'
import { findBuiltInColor } from '../../src/domain/palette'
import type { Project } from '../../src/domain/project'
import type { Technique } from '../../src/domain/weave'
import { withLayers } from '../../src/testUtils/layerFields'
import { openApp, settle } from '../support/app'
import { fixtureProject } from '../support/projects'
import { frames, MOVES, twoFingers, watchFrames } from './gestures'

// What layers cost on an iPad (ticket 1235, spec 1234): a full Canvas with one Frame or four, in Safari's engine at 2×.
// Each gesture reports frame gaps and canvas memory (every canvas's width × height × 4 bytes, at its peak and at rest).
// `E2E_PORT=<a free port> npm run perf -- layerBaseline`. Env: PERF_FRAMES (default 1,4).

const FRAME_COUNTS = (process.env.PERF_FRAMES ?? '1,4').split(',').map(Number)
const FRAME_TECHNIQUES: Technique[] = ['loom', 'peyote', 'brick', 'loom']
const FRAME_SIZE = 60
/** One Frame's room on the Canvas: its 60 beads and a margin round them. */
const STEP = 80

test.use({ browserName: 'webkit', deviceScaleFactor: 2, viewport: { width: 1366, height: 1024 }, hasTouch: true })

const [GREY, RED] = ['grey', 'red'].map((id) => findBuiltInColor(id)!.hex) as [string, string]

/** `count` Frames of 60 × 60 beads, two by two, on a Canvas of beads round and between them. */
function layeredProject(count: number): Project {
  const beads: BeadMap = {}
  const extent = Math.ceil(count / 2) * STEP + 50
  for (let row = -50; row < extent; row += 1) {
    for (let column = -50; column < STEP * 2 + 50; column += 1) (beads[row] ??= {})[column] = (row + column) % 7 === 0 ? RED : GREY
  }
  let project = withLayers(fixtureProject({ technique: FRAME_TECHNIQUES[0]!, columns: FRAME_SIZE, rows: FRAME_SIZE }), { beads })
  for (let index = 1; index < count; index += 1) {
    const technique = FRAME_TECHNIQUES[index % FRAME_TECHNIQUES.length]!
    const sheet = { row: Math.floor(index / 2) * STEP, column: (index % 2) * STEP, rows: FRAME_SIZE, columns: FRAME_SIZE, beads: {}, technique }
    project = withFrameSheet(project, sheet, { frame: frameIdOf({ id: `layer-${index}` }) })
  }
  return { ...project, id: `layers-${count}` }
}

/** Starts sampling every canvas's backing bytes, and the largest total seen. */
async function watchMemory(page: Page): Promise<void> {
  await page.evaluate(() => {
    const total = () => [...document.querySelectorAll('canvas')].reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0)
    const watch = { peak: total(), timer: 0 }
    ;(window as unknown as { __memory: typeof watch }).__memory = watch
    watch.timer = window.setInterval(() => (watch.peak = Math.max(watch.peak, total())), 20)
  })
}

async function memory(page: Page): Promise<{ peak: number; rest: number; canvases: number }> {
  return page.evaluate(() => {
    const watch = (window as unknown as { __memory: { peak: number; timer: number } }).__memory
    clearInterval(watch.timer)
    const canvases = [...document.querySelectorAll('canvas')]
    return { peak: watch.peak, rest: canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0), canvases: canvases.filter((canvas) => canvas.width * canvas.height > 0).length }
  })
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(0).padStart(4)
const lines: string[] = []

for (const count of FRAME_COUNTS) {
  test(`${count} Frame${count === 1 ? '' : 's'} on a full Canvas`, async ({ page }) => {
    test.setTimeout(5 * 60_000)
    await openApp(page, [layeredProject(count)])
    await page.waitForTimeout(1500)
    const box = (await page.getByTestId('project-surface').boundingBox())!
    const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const measure = async (what: string, act: () => Promise<void>, after = 800) => {
      await settle(page)
      await watchMemory(page)
      await watchFrames(page)
      const began = Date.now()
      await act()
      const took = Date.now() - began
      const seen = await frames(page)
      // The turn and the fade play for about a second after the press: the copies are let go once they have.
      await page.waitForTimeout(after)
      const held = await memory(page)
      lines.push(
        `${String(count)} Frames ${what.padEnd(13)} ${String(took).padStart(6)} ms  ${String(seen.frames).padStart(4)} frames  mean ${seen.mean.toFixed(1).padStart(6)} ms  longest ${seen.longest.toFixed(0).padStart(5)} ms  ${String(seen.over33).padStart(3)} over 33 ms  canvas memory peak ${mb(held.peak)} MB, at rest ${mb(held.rest)} MB (${held.canvases} canvases)`,
      )
    }
    await measure('open', () => Promise.resolve(), 0)
    // Rotate Frame is a button in the Frame's popover, so it comes first, with the Frame still in view.
    await measure('Rotate Frame', async () => {
      await page.getByTestId('margin-frame-tools').first().click({ timeout: 15_000 })
      await page.getByTestId('margin-frame-tools-rotate').click({ timeout: 15_000 })
    }, 1500)
    await measure('Rotate canvas', async () => {
      await page.getByTestId('strip-rotate-canvas').click({ timeout: 15_000 })
    }, 1500)
    await measure('twist', () =>
      twoFingers(page, (step) => {
        const angle = ((step / MOVES) * 60 * Math.PI) / 180
        const [dx, dy] = [150 * Math.cos(angle), 150 * Math.sin(angle)]
        return [{ x: middle.x - dx, y: middle.y - dy }, { x: middle.x + dx, y: middle.y + dy }]
      }),
    )
    await measure('pan', () =>
      twoFingers(page, (step) => {
        const by = (step / MOVES) * 360
        return [{ x: middle.x - 150 + by, y: middle.y + by / 3 }, { x: middle.x + 150 + by, y: middle.y + by / 3 }]
      }),
    )
    // A pinch to twice the spread.
    await measure('zoom', () =>
      twoFingers(page, (step) => {
        const half = 100 + (step / MOVES) * 100
        return [{ x: middle.x - half, y: middle.y }, { x: middle.x + half, y: middle.y }]
      }),
    )
  })
}

test.afterAll(() => {
  console.log(['', 'Layers on a full Canvas, WebKit at 2×, iPad size (ticket 1235)', ...lines, ''].join('\n'))
})

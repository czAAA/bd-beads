import { expect, test, type CDPSession, type Page } from '@playwright/test'
import type { GridPosition } from '../../src/domain/grid'
import type { BeadMap } from '../../src/domain/canvas'
import type { Project } from '../../src/domain/project'
import type { Technique } from '../../src/domain/weave'
import { FILL_CAP } from '../../src/domain/fill'
import { findBuiltInColor } from '../../src/domain/palette'
import { beadsOfLayer, withFrameSheet } from '../../src/domain/layerRecord'
import { withLayers } from '../../src/testUtils/layerFields'
import { openApp, projectBox, savedProject, selectTool, setZoom, settle } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'
import { canvasFixtures, isGround } from './canvasFixtures'
import { attribution, busyMs, longFramesSince, pageNow, throttle, watchLongFrames } from './measure'

// Fill reach (ticket 0715), by hand with `npm run perf`: a Fill at the Fill cap with its redraw, save and Piece recount,
// a refused press a screen from the scattered Pieces at the Zoom floor, and small edits on a layer at the cap (ticket
// 0731), each held to the 100 ms an edit has. Env: PERF_SLOWDOWNS (4), PERF_TECHNIQUES (loom,peyote).

const SLOWDOWNS = (process.env.PERF_SLOWDOWNS ?? '4').split(',').map(Number)
const TECHNIQUES = (process.env.PERF_TECHNIQUES ?? 'loom,peyote').split(',') as Technique[]
const EDIT_BUDGET_MS = 100
/** How long the opening view is given to draw itself sharp, and an edit to finish what it set going (a save). */
const OPENING_SETTLE_MS = 1500
const AFTERMATH_MS = 300
/** The capped Piece's side: the Fill cap's square root unless PERF_FILL_SIDE asks for another, to find where it fits. */
const SIDE = Number(process.env.PERF_FILL_SIDE ?? Math.floor(Math.sqrt(FILL_CAP)))

const lines: string[] = []

/** A square Piece of as many beads as the Fill cap, in the 0673 fixtures' pattern: a ground a Fill floods, with a lone
 * accent bead here and there, so the Fill paints just under the cap. */
function cappedPiece(technique: Technique): Project {
  const side = SIDE
  const ground = findBuiltInColor('grey')!.hex
  const accent = findBuiltInColor('red')!.hex
  const beads: BeadMap = {}
  for (let row = 0; row < side; row += 1) {
    beads[row] = {}
    for (let column = 0; column < side; column += 1) beads[row]![column] = isGround(row, column) ? ground : accent
  }
  const base = withFrameSheet(fixtureProject({ technique, columns: 1, rows: 1, blank: true }), undefined)
  return withLayers(base, { id: 'capped', name: 'Perf capped', beads, updatedAt: 1_700_000_000_000, createdAt: 1_700_000_000_000 })
}

/** Where a Canvas position is on screen, at the view as it stands now. */
async function screenOf(page: Page, project: Project): Promise<(position: GridPosition) => { x: number; y: number }> {
  const surface = page.getByTestId('project-surface')
  const zoom = Number(await surface.getAttribute('data-zoom'))
  const box = await projectBox(page, (await surface.boundingBox())!)
  return (position) => beadCentre(project, box, zoom, position)
}

/** Clicks once and measures the main thread's busy time until it has settled, its save included. */
async function timedClick(page: Page, at: { x: number; y: number }, slowdown: number): Promise<{ ms: number; long: string }> {
  const cdp = await throttle(page, slowdown)
  await page.waitForTimeout(OPENING_SETTLE_MS)
  return timed(page, cdp, () => page.mouse.click(at.x, at.y))
}

/** The main thread's busy time of `act` until it has settled, its save included, with the long frames it made. */
async function timed(page: Page, cdp: CDPSession, act: () => Promise<void>): Promise<{ ms: number; long: string }> {
  await settle(page)
  const since = await pageNow(page)
  const before = await busyMs(cdp)
  await act()
  await settle(page)
  await page.waitForTimeout(AFTERMATH_MS)
  const ms = (await busyMs(cdp)) - before
  const frames = await longFramesSince(page, since)
  const long = frames === undefined ? 'long frames n/a' : `${frames.length} long frames${frames.length ? ` (max ${Math.round(Math.max(...frames.map((frame) => frame.duration)))} ms; ${attribution(frames)})` : ''}`
  return { ms, long }
}

function record(what: string, slowdown: number, technique: Technique, { ms, long }: { ms: number; long: string }, note: string): void {
  const verdict = ms > EDIT_BUDGET_MS ? `OVER (> ${EDIT_BUDGET_MS} ms)` : 'ok'
  lines.push(`${slowdown}× ${technique.padEnd(7)} ${what.padEnd(16)} ${ms.toFixed(0).padStart(6)} ms busy  ${verdict.padEnd(18)} ${long}  [${note}]`)
}

for (const slowdown of SLOWDOWNS) {
  for (const technique of TECHNIQUES) {
    test(`a Fill at the cap, ${technique} at ${slowdown}× slowdown`, async ({ page }) => {
      const project = cappedPiece(technique)
      await watchLongFrames(page)
      await openApp(page, [project])
      await selectTool(page, 'fill')
      const at = await screenOf(page, project)
      const side = SIDE
      let press = { row: Math.floor(side / 2), column: Math.floor(side / 2) }
      while (!isGround(press.row, press.column)) press = { ...press, column: press.column + 1 }
      record('fill at the cap', slowdown, technique, await timedClick(page, at(press), slowdown), `${side}×${side} Piece, its ground flooded`)
    })

    test(`a refused Fill a screen away at the Zoom floor, ${technique} at ${slowdown}× slowdown`, async ({ page }) => {
      const scattered = canvasFixtures(technique).find(({ name }) => name === 'scattered')!
      await watchLongFrames(page)
      await openApp(page, scattered.library)
      await setZoom(page, 10)
      // One screen to the right of where the Zoom floor left the view: the Pieces are off the left edge.
      const surface = (await page.getByTestId('project-surface').boundingBox())!
      await selectTool(page, 'hand')
      await page.mouse.move(surface.x + surface.width - 10, surface.y + surface.height / 2)
      await page.mouse.down()
      await page.mouse.move(surface.x + 10, surface.y + surface.height / 2, { steps: 10 })
      await page.mouse.up()
      await selectTool(page, 'fill')
      const stored = async () => beadsOfLayer(await savedProject(page), 'canvas')
      const before = await stored()

      const measured = await timedClick(page, { x: surface.x + surface.width / 2, y: surface.y + surface.height / 2 }, slowdown)
      record('refused fill', slowdown, technique, measured, 'empty space a screen from the scattered Pieces, at 10%')
      await expect(page.getByTestId('fill-refused')).toBeVisible()
      expect(await stored()).toEqual(before)
    })
  }
}

for (const slowdown of SLOWDOWNS) {
  for (const technique of TECHNIQUES) {
    test(`small edits on a layer at the cap, ${technique} at ${slowdown}× slowdown`, async ({ page }) => {
      const project = cappedPiece(technique)
      await watchLongFrames(page)
      await openApp(page, [project])
      const cdp = await throttle(page, slowdown)
      await page.waitForTimeout(OPENING_SETTLE_MS)
      const at = await screenOf(page, project)
      const middle = Math.floor(SIDE / 2)
      let accent = { row: middle, column: middle }
      while (isGround(accent.row, accent.column)) accent = { ...accent, column: accent.column + 1 }
      const note = `${SIDE}×${SIDE} Piece, rulers on`

      await selectTool(page, 'fill')
      record('one-bead fill', slowdown, technique, await timed(page, cdp, () => page.mouse.click(at(accent).x, at(accent).y)), note)

      const stroke = async (row: number) => {
        await page.mouse.move(at({ row, column: middle - 10 }).x, at({ row, column: middle - 10 }).y)
        await page.mouse.down()
        for (let step = 1; step <= 20; step += 1) await page.mouse.move(at({ row, column: middle - 10 + step }).x, at({ row, column: middle - 10 + step }).y)
      }
      await selectTool(page, 'paint')
      await stroke(middle - 20)
      record('stroke end', slowdown, technique, await timed(page, cdp, () => page.mouse.up()), note)

      record('undo', slowdown, technique, await timed(page, cdp, () => page.keyboard.press('ControlOrMeta+z')), note)

      await selectTool(page, 'erase')
      await stroke(middle + 20)
      record('erase stroke end', slowdown, technique, await timed(page, cdp, () => page.mouse.up()), note)
    })
  }
}

test.afterAll(() => {
  console.log(['', `Fill reach performance check (production build; budget ${EDIT_BUDGET_MS} ms an edit, Fill cap ${FILL_CAP.toLocaleString('en')})`, ...lines, ''].join('\n'))
})

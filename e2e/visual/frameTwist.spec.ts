import { frameIdIn } from '../../src/testUtils/frameId'
import { expect, test, type Page } from '@playwright/test'
import { canvasOf, frameById, frameIdOf, frameOf, orientationOf } from '../../src/domain/layerRecord'
import { canvasAngleOf, frameAngleOf, tableTurnOf } from '../../src/domain/table'
import { currentZoomPercent, openApp, savedProject, settle } from '../support/app'
import { fixtureProject } from '../support/projects'
import { withFrameSheet } from '../../src/domain/frameSheet'
import { onCanvas } from '../../src/testUtils/onCanvas'

// A two-finger twist on touch (ticket 1190): one that starts on the Frame's sheet turns the Frame about its centre, one
// anywhere else the Canvas, and pan and pinch move both, in Safari's engine at an iPad's density, as the owner's iPad.

// The config's launch flags are Chromium's: WebKit on Linux refuses to start with them.
test.use({ browserName: 'webkit', deviceScaleFactor: 2, viewport: { width: 1366, height: 1024 }, hasTouch: true, launchOptions: { args: [] } })

type Point = { x: number; y: number }

/** Two fingers on the surface: down at `path(0)`, moved through each step to `path(steps)`, then up. */
async function twoFingers(page: Page, path: (step: number) => [Point, Point], steps = 24): Promise<void> {
  await page.evaluate(
    ({ points }) => {
      const surface = document.querySelector('[data-testid="project-surface"]')!
      const fire = (type: string, id: number, { x, y }: Point) =>
        surface.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1 }))
      const [a, b] = points[0]!
      fire('pointerdown', 1, a)
      fire('pointerdown', 2, b)
      for (const [p, q] of points.slice(1)) {
        fire('pointermove', 1, p)
        fire('pointermove', 2, q)
      }
      const [p, q] = points.at(-1)!
      fire('pointerup', 1, p)
      fire('pointerup', 2, q)
    },
    { points: Array.from({ length: steps + 1 }, (_, step) => path(step)) },
  )
  // The settle eases over the base duration before the Project keeps it.
  await page.waitForTimeout(400)
  await settle(page)
}

/** Two fingers held on the surface and moved one step per screen frame, as an iPad reports them, then held still for a few
 * frames before they lift (ticket 1227): the glue twist catches up with them in that time. */
async function pacedTwoFingers(page: Page, path: (step: number) => [Point, Point], steps = 24): Promise<void> {
  await page.evaluate(
    async ({ points }) => {
      const surface = document.querySelector('[data-testid="project-surface"]')!
      // A page the browser holds in the background pauses its frames: a short timer keeps the pacing going.
      const frame = () => new Promise<void>((done) => (requestAnimationFrame(() => done()), setTimeout(done, 40)))
      const fire = (type: string, id: number, { x, y }: Point) =>
        surface.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1 }))
      const [a, b] = points[0]!
      fire('pointerdown', 1, a)
      fire('pointerdown', 2, b)
      for (const [p, q] of points.slice(1)) {
        fire('pointermove', 1, p)
        fire('pointermove', 2, q)
        await frame()
      }
      const [p, q] = points.at(-1)!
      for (let held = 0; held < 12; held++) await frame()
      fire('pointerup', 1, p)
      fire('pointerup', 2, q)
    },
    { points: Array.from({ length: steps + 1 }, (_, step) => path(step)) },
  )
  await page.waitForTimeout(400)
  await settle(page)
}

/** Two fingers `spread` px either side of `at`, turned `degrees` clockwise by the last step, spread `scale` times as far. */
const twist = (at: Point, degrees: number, spread = 60, scale = 1) => (step: number, steps = 24): [Point, Point] => {
  const turn = ((degrees * step) / steps) * (Math.PI / 180)
  const reach = spread * (1 + ((scale - 1) * step) / steps)
  const [dx, dy] = [Math.cos(turn) * reach, Math.sin(turn) * reach]
  return [
    { x: at.x - dx, y: at.y - dy },
    { x: at.x + dx, y: at.y + dy },
  ]
}

test('pan, pinch and a twist anywhere each turn and move the whole Table (spec 1234)', async ({ page }) => {
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 16, rows: 10 })])
  await settle(page)
  const box = (await page.getByTestId('project-surface').boundingBox())!
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  // Pinch in: both layers zoom out, so the Canvas shows round the Frame's sheet.
  const before = await currentZoomPercent(page)
  await twoFingers(page, twist(middle, 0, 200, 0.4))
  const zoomed = await currentZoomPercent(page)
  expect(zoomed).toBeLessThan(before)

  // Pan: both layers move along with the fingers; nothing turns.
  await twoFingers(page, (step) => [
    { x: middle.x - 40 + step * 2, y: middle.y },
    { x: middle.x + 40 + step * 2, y: middle.y },
  ])
  const sheetMiddle = { x: middle.x + 48, y: middle.y }
  let saved = await savedProject(page)
  expect(orientationOf(saved)).toBe(0)
  expect(frameOf(saved)!.angle).toBe(0)

  // A twist with both fingers on the Frame turns the Table, every layer together, from where it engaged, about 10° into
  // the fingers' turn: the layers keep their own quarter turns and the Table turn is what is left.
  await twoFingers(page, twist(sheetMiddle, 35, 30))
  saved = await savedProject(page)
  const leaning = tableTurnOf(saved)
  expect(leaning).toBeGreaterThan(15)
  expect(leaning).toBeLessThan(35)
  expect(canvasAngleOf(saved)).toBe(leaning)
  expect(frameOf(saved)!.angle).toBe(0)
  expect(frameAngleOf(saved, frameIdIn(saved))).toBe(leaning)

  // A twist that starts off the Frame turns the Table as well, easing onto a quarter turn of the screen within 10°.
  await twoFingers(page, twist({ x: box.x + 120, y: box.y + 120 }, 75, 50))
  await expect.poll(async () => tableTurnOf(await savedProject(page))).toBe(90)
  const resaved = await savedProject(page)
  expect(frameOf(resaved)!.angle).toBe(0)
  expect(frameAngleOf(resaved, frameIdIn(resaved))).toBe(canvasAngleOf(resaved))
})

test('a twist paced like an iPad\'s catches up with the fingers once they stop, and Fit puts the Table turn back (ticket 1227)', async ({ page }) => {
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 16, rows: 10 })])
  await settle(page)
  const box = (await page.getByTestId('project-surface').boundingBox())!
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  // The Table twisted 35° by fingers on the sheet: the fingers turn the 10° that engages it, the rest is the Table's.
  await pacedTwoFingers(page, twist(middle, 35, 30))
  const leaning = tableTurnOf(await savedProject(page))
  expect(leaning).toBeGreaterThan(24)
  expect(leaning).toBeLessThan(26)

  // Fit: the Table turn back to 0°, every layer as it was.
  await page.getByTestId('zoom-reset').click()
  await expect.poll(async () => tableTurnOf(await savedProject(page))).toBe(0)
  const fitted = await savedProject(page)
  expect(orientationOf(fitted)).toBe(0)
  expect(frameOf(fitted)!.angle).toBe(0)
})

test('a twist with two Frames turns the Table, both Frames with it and neither alone (ticket 1220, spec 1234)', async ({ page }) => {
  const second = frameIdOf({ id: 'second' })
  const base = fixtureProject({ technique: 'loom', columns: 12, rows: 8 })
  const pair = withFrameSheet(base, onCanvas(base, { row: 1, column: 22, rows: 8, columns: 6, beads: {}, technique: 'loom' }), { frame: second })
  await openApp(page, [pair])
  await settle(page)
  await expect(page.getByTestId('margin-sheet')).toHaveCount(2)
  const sheet = (await page.locator(`[data-testid="margin-sheet"][data-frame="${second}"]`).boundingBox())!
  await twoFingers(page, twist({ x: sheet.x + sheet.width / 2, y: sheet.y + sheet.height / 2 }, 35, 20))
  const saved = await savedProject(page)
  expect(frameAngleOf(saved, second)).toBeGreaterThan(15)
  expect(frameAngleOf(saved, second)).toBeLessThan(35)
  expect(frameAngleOf(saved, frameIdIn(saved))).toBe(frameAngleOf(saved, second))
  expect(frameById(saved, second)!.angle).toBe(0)
  expect(canvasAngleOf(saved)).toBe(frameAngleOf(saved, second))
})

test('the iPad flow: Frames of other Techniques, a Table turn, then Rotate Frame and Rotate canvas turn only their own layer (ticket 1238)', async ({ page }) => {
  const second = frameIdOf({ id: 'second' })
  const base = fixtureProject({ technique: 'loom', columns: 12, rows: 8 })
  const pair = withFrameSheet(base, onCanvas(base, { row: 1, column: 22, rows: 8, columns: 6, beads: {}, technique: 'peyote' }), { frame: second })
  await openApp(page, [pair])
  await settle(page)
  const sheet = (await page.locator('[data-testid="project-surface"]').boundingBox())!
  await pacedTwoFingers(page, twist({ x: sheet.x + sheet.width / 2, y: sheet.y + sheet.height / 2 }, 35, 80))
  const twisted = await savedProject(page)
  const table = tableTurnOf(twisted)
  expect(table).toBeGreaterThan(20)
  expect(table).toBeLessThan(40)

  // Rotate canvas: the Canvas a quarter on, both Frames and the Table turn exactly as they were.
  await page.getByTestId('strip-rotate-canvas').click()
  await settle(page)
  await expect.poll(async () => canvasOf(await savedProject(page)).orientation).toBe((canvasOf(twisted).orientation + 90) % 360)
  const canvasTurned = await savedProject(page)
  expect(tableTurnOf(canvasTurned)).toBe(table)
  // The file keeps each centre from the Canvas's origin, which Rotate canvas moved: the Frames' own turns and their distance stay.
  const apart = (project: typeof twisted) => {
    const [a, b] = [frameById(project, frameIdIn(project))!.centre, frameById(project, second)!.centre]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  expect(apart(canvasTurned)).toBeCloseTo(apart(twisted), 3)
  for (const id of [second, frameIdIn(twisted)]) expect(frameById(canvasTurned, id)!.angle).toBe(frameById(twisted, id)!.angle)

  // Rotate Frame: only the one Frame, about its own centre.
  await page.locator(`[data-testid="margin-frame-tools"][data-frame="${second}"]`).click()
  await page.getByTestId('margin-frame-tools-rotate').click()
  await settle(page)
  await expect.poll(async () => frameById(await savedProject(page), second)!.quarterTurns).toBe(1)
  const frameTurned = await savedProject(page)
  expect(frameById(frameTurned, second)!.centre).toEqual(frameById(canvasTurned, second)!.centre)
  expect(frameById(frameTurned, frameIdIn(twisted))!.centre).toEqual(frameById(canvasTurned, frameIdIn(twisted))!.centre)
  expect(tableTurnOf(frameTurned)).toBe(table)
  expect(canvasOf(frameTurned).orientation).toBe(canvasOf(canvasTurned).orientation)
  expect(frameById(frameTurned, frameIdIn(twisted))!.quarterTurns ?? 0).toBe(0)
})

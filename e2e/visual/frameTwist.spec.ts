import { expect, test, type Page } from '@playwright/test'
import { frameOf, orientationOf } from '../../src/domain/layerRecord'
import { lieAlike } from '../../src/domain/table'
import { currentZoomPercent, openApp, savedProject, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

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

test('pan, pinch and a twist on the Frame and off it each turn and move what they should', async ({ page }) => {
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

  // A twist with both fingers on the Frame turns the Frame alone and leaves it leaning: from where it engaged, about 10°
  // into the fingers' turn.
  await twoFingers(page, twist(sheetMiddle, 35, 30))
  saved = await savedProject(page)
  const leaning = frameOf(saved)!.angle
  expect(leaning).toBeGreaterThan(15)
  expect(leaning).toBeLessThan(35)
  expect(orientationOf(saved)).toBe(0)
  expect(lieAlike(saved)).toBe(false)

  // A twist that starts off the Frame turns the Canvas alone, easing onto the quarter turn.
  await twoFingers(page, twist({ x: box.x + 120, y: box.y + 120 }, 100, 50))
  await expect.poll(async () => orientationOf(await savedProject(page))).toBe(90)
  expect(frameOf(await savedProject(page))!.angle).toBe(leaning)

  // Twisted on the Frame to within 10° of the Canvas's angle, it eases onto it and lies alike again.
  await twoFingers(page, twist(sheetMiddle, 75, 30))
  await expect.poll(async () => frameOf(await savedProject(page))!.angle).toBe(90)
  expect(lieAlike(await savedProject(page))).toBe(true)
})

test('a twist paced like an iPad\'s catches up with the fingers once they stop, and Fit puts the turns back (ticket 1227)', async ({ page }) => {
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 16, rows: 10 })])
  await settle(page)
  const box = (await page.getByTestId('project-surface').boundingBox())!
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  // The Frame twisted 35° by fingers on its sheet: the fingers turn the 10° that engages it, the rest is the Frame's.
  await pacedTwoFingers(page, twist(middle, 35, 30))
  const leaning = frameOf(await savedProject(page))!.angle
  expect(leaning).toBeGreaterThan(24)
  expect(leaning).toBeLessThan(26)

  // The Canvas twisted off the Frame, eased onto its quarter turn.
  await pacedTwoFingers(page, twist({ x: box.x + 120, y: box.y + 120 }, 100, 50))
  await expect.poll(async () => orientationOf(await savedProject(page))).toBe(90)

  // Fit: the Canvas back to 0°, the leaning Frame onto its nearest quarter turn.
  await page.getByTestId('zoom-reset').click()
  await expect.poll(async () => orientationOf(await savedProject(page))).toBe(0)
  expect(frameOf(await savedProject(page))!.angle).toBe(0)
})

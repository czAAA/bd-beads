import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import type { Background, Project } from '../../src/domain/project'
import type { Technique } from '../../src/domain/weave'
import { withLayers } from '../../src/testUtils/layerFields'
import { holdSettle, letSettle, openApp, settle, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'

// Panning a big pattern moves the drawn bitmap until the view settles (tickets 349, 0689). What it uncovers is the empty
// Canvas laid under the drawing as a CSS pattern (ticket 0717): with the pan held in flight, the screen must match the
// sharp frame drawn once it settles, the Position marks lined up with the grid and no bare patch anywhere.

/** How many pixels may differ, of all the canvas box shows: antialiasing where a mark line falls between pixels. */
const MOST_DIFFERENT = 0.002
/** How far apart two pixels' channels may be and still count as the same: a mark line's antialiasing differs by a few
 * levels between the canvas and CSS; at 10% the marks themselves are only 2 or 3 levels off the Background. */
const channelTolerance = (zoom: number) => (zoom <= 10 ? 1 : 8)

/** A small framed pattern with 10,000 beads stored far below it, so the view moves its bitmap (more than 8,000 beads
 * to draw) while the screen shows the Frame on empty Canvas, both layers on `background` (the default when left out). */
function bigProject(technique: Technique, rotation: Rotation, background?: Background) {
  const fixture = fixtureProject({ technique, rotation })
  const framed = background === undefined ? fixture : { ...fixture, layers: fixture.layers.map((layer) => ({ ...layer, background })) as Project['layers'] }
  const beads: Record<number, Record<number, string>> = {}
  for (let row = 3000; row < 3100; row += 1) {
    beads[row] = {}
    for (let column = 0; column < 100; column += 1) beads[row][column] = '#d03030'
  }
  return withLayers(framed, { beads })
}

/** The share of pixels two screenshots of the same box disagree on. */
function differing(a: Buffer, b: Buffer, tolerance: number): number {
  const [first, second] = [PNG.sync.read(a), PNG.sync.read(b)]
  let count = 0
  for (let at = 0; at < first.data.length; at += 4) {
    if ([0, 1, 2].some((channel) => Math.abs(first.data[at + channel]! - second.data[at + channel]!) > tolerance)) count += 1
  }
  return count / (first.width * first.height)
}

/** How far across the screen the pan goes: past the drawing area in the full look, short of the half drawing area the
 * draft look's bitmap reaches past it (ticket 0717). */
const FULL_PAN_ACROSS = 0.7
const DRAFT_PAN_ACROSS = 0.4

type Rotation = 0 | 90 | 180 | 270

/** Each Technique, every quarter turn, the three themes and Backgrounds other than the default (5 is Pebble in light,
 * Slate in dark; a Custom color draws in the look it reads best in). */
const CASES: { technique: Technique; rotation: Rotation; scheme: 'light' | 'dark' | 'contrast'; background?: Background }[] = [
  { technique: 'loom', rotation: 0, scheme: 'dark' },
  { technique: 'peyote', rotation: 0, scheme: 'light', background: 5 },
  { technique: 'peyote', rotation: 90, scheme: 'dark' },
  { technique: 'brick', rotation: 0, scheme: 'dark', background: 5 },
  { technique: 'loom', rotation: 270, scheme: 'contrast' },
  { technique: 'brick', rotation: 180, scheme: 'light', background: '#7a4b8c' },
]

for (const { technique, rotation, scheme, background } of CASES) {
  for (const zoom of [60, 30, 10]) {
    test(`${technique} at ${rotation}°, ${scheme}${background === undefined ? '' : ` on Background ${background}`}: a pan in flight at ${zoom}% shows what the settled view draws`, async ({ page }) => {
      await page.emulateMedia(scheme === 'contrast' ? { colorScheme: 'light', contrast: 'more' } : { colorScheme: scheme })
      await openApp(page, [bigProject(technique, rotation, background)])
      await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
      await setZoom(page, zoom)
      await expect(page.getByTestId('project-surface-cells')).toHaveCSS('transform', 'none')
      const surface = (await page.getByTestId('project-surface').boundingBox())!
      await page.mouse.move(surface.x + surface.width / 2, surface.y + surface.height / 2)

      await holdSettle(page)
      // Far enough to uncover a strip in the full look. The draft look's bitmap reaches half a screen past it, and a pan
      // further than that draws it again at once (ticket 0732), so there it stays inside.
      const across = zoom === 10 ? DRAFT_PAN_ACROSS : FULL_PAN_ACROSS
      await page.mouse.wheel(Math.round(surface.width * across), Math.round(surface.height * 0.3))
      await settle(page)
      await expect(page.getByTestId('project-surface-cells')).not.toHaveCSS('transform', 'none')
      const box = page.getByTestId('app-canvas')
      const inFlight = await box.screenshot()

      await letSettle(page)
      await expect(page.getByTestId('project-surface-cells')).toHaveCSS('transform', 'none')
      const settled = await box.screenshot()
      expect(differing(inFlight, settled, channelTolerance(zoom))).toBeLessThan(MOST_DIFFERENT)
    })
  }
}

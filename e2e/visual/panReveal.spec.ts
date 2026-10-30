import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import type { Technique } from '../../src/domain/weave'
import { withLayers } from '../../src/testUtils/layerFields'
import { holdSettle, openApp, settle, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'

// Panning a big pattern moves the drawn bitmap until the view settles (tickets 349, 0689). A pan that never pauses must
// still show the beads it reaches (ticket 0732): the draft look draws its bitmap again, the full look shows them on the
// stand-in under it, not bare Canvas till the pan stops.

/** A Canvas red from corner to corner, far wider than the screen, so a long pan only ever uncovers more red beads. */
function redField(technique: Technique) {
  const beads: Record<number, Record<number, string>> = {}
  for (let row = -200; row < 400; row += 1) {
    beads[row] = {}
    for (let column = -200; column < 1400; column += 1) beads[row][column] = '#d03030'
  }
  return withLayers(fixtureProject({ technique }), { beads })
}

/** The share of the shot's pixels that are the red beads (their gaps and rims aside, most of it). */
function redShare(shot: Buffer): number {
  const image = PNG.sync.read(shot)
  let red = 0
  for (let at = 0; at < image.data.length; at += 4) {
    const [r, g, b] = [image.data[at]!, image.data[at + 1]!, image.data[at + 2]!]
    if (r > 150 && g < 90 && b < 90) red += 1
  }
  return red / (image.width * image.height)
}

for (const { technique, zoom } of [
  { technique: 'loom', zoom: 60 },
  { technique: 'peyote', zoom: 100 },
  { technique: 'loom', zoom: 20 },
] as const) {
  test(`${technique} at ${zoom}%: a long pan that never pauses shows the beads it reaches`, async ({ page }) => {
    await openApp(page, [redField(technique)])
    await setZoom(page, zoom)
    const surface = (await page.getByTestId('project-surface').boundingBox())!
    await page.mouse.move(surface.x + surface.width / 2, surface.y + surface.height / 2)
    const box = page.getByTestId('project-surface')

    await holdSettle(page)
    // Two and a half screens to the right in small steps, a frame apart, as a trackpad sends them.
    for (let step = 0; step < 50; step += 1) {
      await page.mouse.wheel(Math.round(surface.width / 20), 0)
      await settle(page)
    }
    // The view opens on the small Frame amid the red, which a pan leaves behind: then red is all there is to show.
    expect(redShare(await box.screenshot())).toBeGreaterThan(0.85)
  })
}

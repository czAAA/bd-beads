import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import { openApp, setZoom } from '../support/app'
import { fixturePattern } from '../support/patterns'
import { MAX_DIFFERING_BLOCKS, compareToReference } from '../support/referenceCheck'
import { SCENARIOS } from './scenarios'

/**
 * The overlays that come with a tool, against the reference screenshots: the Selection marquee, the paste preview in its
 * own colors, Mirror's axis lines, the "Mirror current" dimming and the mirrored hover preview, at 25%, 100% and 300%,
 * upright and rotated. The scenarios (scenarios.ts) drive the app by its own controls and by pointer coordinates.
 * (Hover, Row progress and the plain look are in interaction.spec.ts and look.spec.ts.)
 */
const REFERENCES = fileURLToPath(new URL('./__screenshots__/', import.meta.url))
const ZOOMS = [25, 100, 300]
const COVERED = /selection|paste-preview|mirror-axes|mirror-current|hover-paint-mirrored/

for (const scenario of SCENARIOS.filter(({ name }) => COVERED.test(name))) {
  for (const rotated of [false, true]) {
    const orientation = rotated ? 'rotated' : 'upright'

    test(`${scenario.name}, ${orientation}`, async ({ page }) => {
      const pattern = fixturePattern({ technique: scenario.technique, rotated, rowProgress: scenario.rowProgress })
      await openApp(page, [pattern])

      await setZoom(page, 100)
      await scenario.prepare?.(page, { pattern, zoom: 100 })

      for (const zoom of ZOOMS) {
        await setZoom(page, zoom)
        await scenario.place?.(page, { pattern, zoom })

        const box = (await page.getByTestId('pattern-surface').boundingBox())!
        const expected = readFileSync(`${REFERENCES}${scenario.name}-${orientation}-${zoom}.png`)
        const { width, height } = PNG.sync.read(expected)
        const origin = { x: Math.floor(box.x), y: Math.floor(box.y) }
        const actual = await page.screenshot({ clip: { ...origin, width, height } })

        const label = `${scenario.name}, ${orientation}, ${zoom}%`
        const ignore = scenario.overlaid === 'all' ? new Set(pattern.grid.flatMap((cells, row) => cells.map((_cell, column) => `(${row}, ${column})`))) : new Set(scenario.overlaid)
        const { look, wrong } = compareToReference(actual, expected, pattern, zoom, box, origin, ignore)
        expect.soft(look, `${label}: look`).toBeLessThanOrEqual(MAX_DIFFERING_BLOCKS[scenario.technique])
        expect.soft(wrong, `${label}: beads in the wrong color`).toEqual([])
      }
    })
  }
}

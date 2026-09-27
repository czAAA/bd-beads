import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import { openApp, setZoom } from '../support/app'
import { fixturePattern } from '../support/patterns'
import { MAX_DIFFERING_BLOCKS, compareToReference, UPDATING_REFERENCES, writeReference } from '../support/referenceCheck'

/**
 * The look of a Pattern in the app, held to the reference screenshots (support/referenceCheck.ts says how the
 * comparison works): every Technique, plain and with Row progress in both directions, at 25%, 100% and 300%, upright
 * and rotated — the marker included, since the overlay layer draws it. The pointer tools are in interaction.spec.ts and
 * the overlays that come with a tool in overlays.spec.ts.
 */
const REFERENCES = fileURLToPath(new URL('./__screenshots__/', import.meta.url))
const ZOOMS = [25, 100, 300]
const TECHNIQUES = ['loom', 'peyote', 'brick'] as const

const scenarios = [
  ...TECHNIQUES.map((technique) => ({ name: `${technique}-plain`, technique, rowProgress: undefined })),
  ...TECHNIQUES.map((technique) => ({
    name: `${technique}-progress-rows`,
    technique,
    rowProgress: { enabled: true, direction: 'rows', currentRow: 4 } as const,
  })),
  ...TECHNIQUES.map((technique) => ({
    name: `${technique}-progress-columns`,
    technique,
    rowProgress: { enabled: true, direction: 'columns', currentColumn: 6 } as const,
  })),
]

for (const scenario of scenarios) {
  for (const rotated of [false, true]) {
    const orientation = rotated ? 'rotated' : 'upright'

    test(`${scenario.name}, ${orientation}`, async ({ page }) => {
      const pattern = fixturePattern({ technique: scenario.technique, rotated, rowProgress: scenario.rowProgress })
      await openApp(page, [pattern])
      await expect(page.getByTestId('pattern-surface-cells')).toHaveCount(1)

      for (const zoom of ZOOMS) {
        await setZoom(page, zoom)
        await page.mouse.move(5, 5)

        const box = (await page.getByTestId('pattern-surface').boundingBox())!
        const reference = `${REFERENCES}${scenario.name}-${orientation}-${zoom}.png`
        if (UPDATING_REFERENCES) await writeReference(page, reference, box, { x: Math.floor(box.x), y: Math.floor(box.y) })
        const expected = readFileSync(reference)
        const { width, height } = PNG.sync.read(expected)
        const origin = { x: Math.floor(box.x), y: Math.floor(box.y) }
        const actual = await page.screenshot({ clip: { ...origin, width, height } })

        const label = `${scenario.name}, ${orientation}, ${zoom}%`
        const { look, wrong } = compareToReference(actual, expected, pattern, zoom, box, origin)
        expect.soft(look, `${label}: look`).toBeLessThanOrEqual(MAX_DIFFERING_BLOCKS[scenario.technique])
        expect.soft(wrong, `${label}: beads in the wrong color`).toEqual([])
      }
    })
  }
}

/**
 * The comparisons have to fail when the picture is wrong, or a pass means nothing. Each of these draws a Pattern that
 * differs from the one the reference shows in one small way, at every zoom (25% is where a bead is smallest), and expects
 * the check to notice.
 */
test.describe('the check notices a wrong picture', () => {
  const reference = fixturePattern({ technique: 'loom' })

  const wrongPictures = {
    'a bead in another color': fixturePattern({ technique: 'loom', override: [{ row: 4, column: 7, color: '#2f6fed' }] }),
    'a bead left empty': fixturePattern({ technique: 'loom', override: [{ row: 4, column: 7, color: null }] }),
  }

  for (const [description, wrongPicture] of Object.entries(wrongPictures)) {
    test(description, async ({ page }) => {
      await openApp(page, [wrongPicture])

      for (const zoom of ZOOMS) {
        await setZoom(page, zoom)
        await page.mouse.move(5, 5)

        const box = (await page.getByTestId('pattern-surface').boundingBox())!
        const expected = readFileSync(`${REFERENCES}loom-plain-upright-${zoom}.png`)
        const { width, height } = PNG.sync.read(expected)
        const origin = { x: Math.floor(box.x), y: Math.floor(box.y) }
        const actual = await page.screenshot({ clip: { ...origin, width, height } })

        // Judged against the Pattern the reference shows, the one bead is found and nothing else is.
        expect(compareToReference(actual, expected, reference, zoom, box, origin).wrong, `${zoom}%`).toEqual(['(4, 7)'])
      }
    })
  }

  test('a Row progress marker the reference does not have', async ({ page }) => {
    await openApp(page, [fixturePattern({ technique: 'loom', rowProgress: { enabled: true, direction: 'rows', currentRow: 4 } })])
    await setZoom(page, 100)
    await page.mouse.move(5, 5)

    const box = (await page.getByTestId('pattern-surface').boundingBox())!
    const expected = readFileSync(`${REFERENCES}loom-plain-upright-100.png`)
    const { width, height } = PNG.sync.read(expected)
    const origin = { x: Math.floor(box.x), y: Math.floor(box.y) }
    const actual = await page.screenshot({ clip: { ...origin, width, height } })

    // The rows behind the pointer are faded and one is outlined: far more than the look is allowed to differ by.
    expect(compareToReference(actual, expected, reference, 100, box, origin).look).toBeGreaterThan(MAX_DIFFERING_BLOCKS.loom)
  })
})

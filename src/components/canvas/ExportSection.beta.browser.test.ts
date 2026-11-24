import { frameIdIn } from '../../testUtils/frameId'
import { afterEach, describe, expect, it } from 'vitest'
import { FIT_LOCALES, FIT_WIDTHS, mountAt, unmountAll } from '../../testUtils/browserFit'
import ExportSection from './ExportSection.vue'
import { createProject } from '../../domain/createProject'
import { withFrameSheet } from '../../domain/frameSheet'
import { withLayers } from '../../testUtils/layerFields'

afterEach(unmountAll)

/** The Beta chip inside PNG and PDF stays wholly inside its button, with room to the edge, however narrow the third of the
 * row and whatever the language: it once crossed the button's end edge where there was no free space (ticket 1198). */
const EDGE = 3

const custom = () =>
  withLayers(
    withFrameSheet(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), undefined, { frame: frameIdIn(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } })) }),
    { frame: { row: 2, column: 3, rows: 6, columns: 5, technique: 'loom', shape: 'triangle', beads: {} } },
  )

describe.each(FIT_LOCALES)('the Beta chip in the Export buttons (%s)', (locale) => {
  it.each(FIT_WIDTHS)('sits inside its button with room to the edge at %ipx', async (width) => {
    const mounted = await mountAt(ExportSection, { project: custom() }, { locale, width })
    const found: string[] = []
    for (const id of ['export-png', 'export-pdf']) {
      const button = mounted.root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.getBoundingClientRect()
      const chip = mounted.root.querySelector<HTMLElement>(`[data-testid="${id}"] [data-testid="beta-chip"]`)!.getBoundingClientRect()
      if (chip.right > button.right - EDGE) found.push(`${id}: chip ends ${(chip.right - button.right).toFixed(1)}px past its button's edge`)
      if (chip.top < button.top + EDGE || chip.bottom > button.bottom - EDGE) found.push(`${id}: chip too close to the top or bottom edge`)
    }
    expect(found).toEqual([])
  })
})

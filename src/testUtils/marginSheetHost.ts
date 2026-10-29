import { defineComponent, h } from 'vue'
import MarginSheet from '../components/canvas/MarginSheet.vue'
import { createProject } from '../domain/createProject'
import { createPalette, defaultPaletteIds } from '../domain/palette'
import type { Project } from '../domain/project'
import { frameOutsetPx } from '../rendering/rulerScale'
import { paintAt } from './layers'
import { withLayers } from './layerFields'

const moth = createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })

/** The margin sheet at `zoom` round a 30-column Frame, in a box that scrolls sideways as the drawing area pans: on a
 * phone the sheet is wider than the screen, and the canvas is moved to reach the rest (ticket 0657). */
export const marginSheetHost = (zoom: number) =>
  defineComponent({
    setup() {
      const bare: Project = withLayers(moth, { makerName: 'Ada', frame: { row: 0, column: 0, rows: 8, columns: 30, technique: 'loom' as const, beads: {}, name: 'Sun band' } })
      const project = createPalette(defaultPaletteIds()).colors.map((color) => color.hex).reduce((drawn, color, column) => paintAt(drawn, [{ row: 0, column }], color), bare)
      // Beads of 20px at 100%, the line out from them, the sheet 4 beads round them (ticket 0658's forms by zoom).
      const band = 80 * zoom
      const outset = frameOutsetPx(zoom)
      const beads = { width: 600 * zoom, height: 160 * zoom }
      const sheet = { left: 0, top: 0, width: beads.width + 2 * band, height: beads.height + 2 * band }
      const anchor = { box: { left: band - outset, top: band - outset, width: beads.width + 2 * outset, height: beads.height + 2 * outset }, sheet, band, viewport: { width: sheet.width, height: sheet.height } }
      return () => h('div', { style: { position: 'relative', overflowX: 'auto', width: '100%', height: `${sheet.height + 32}px` } }, [h(MarginSheet, { project, anchor, editing: false, pressing: false })])
    },
  })

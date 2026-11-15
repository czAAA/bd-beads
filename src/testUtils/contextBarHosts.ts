import { defineComponent, h } from 'vue'
import { expect, vi } from 'vitest'
import ContextBar from '../components/tools/ContextBar.vue'
import { BEAD_CATALOG } from '../domain/beads'
import { createProject } from '../domain/createProject'
import { MIRROR_OFF, type MirrorSetting } from '../domain/mirror'
import { paintAt } from './layers'

// The Selection bar and the Mirror bar with room to stand whole, for the hit-area tests (ticket 0962), with a mouse and
// on a touch screen. Where the Mirror bar must scroll sideways its box cuts its controls' pads to its own height.

const empty = createProject({ technique: 'loom', beadId: BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!.id, name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })
/** With a bead in it, so Copy and Fill are enabled. */
const project = paintAt(empty, [{ row: 0, column: 0 }], '#c0392b')
const anchor = { box: { left: 40, top: 160, width: 100, height: 60 }, viewport: { width: 1280, height: 640 } }
const area = { row: 0, column: 0, rows: 10, columns: 12 }
/** Every Axis on, so every count shows. */
const allOn: MirrorSetting = { ...MIRROR_OFF, axes: { leftRight: true, topBottom: true, radial: true }, place: { layer: 'canvas', area } }
const room = { position: 'relative', width: '1280px', height: '400px' }

/** The Mirror bar's controls, by test id: the Mode's segments, each chip with its counts, and Close mirror. */
export const MIRROR_CONTROLS = ['mode-mirror', 'mode-repeat', ...(['leftRight', 'topBottom', 'radial'] as const).flatMap((axis) => [`axis-${axis}`, `${axis}-fewer`, `${axis}-more`]), 'close'].map((id) => `mirror-bar-${id}`)

export const roomyMirrorBar = defineComponent({
  setup: () => () => h('div', { style: room }, [h(ContextBar, { project, pasteArmed: false, canRemoveLine: false, mirror: { setting: allOn, summary: '12×10', rect: area }, mirrorAnchor: anchor })]),
})

export const roomySelectionBar = defineComponent({
  setup: () => () => h('div', { style: room }, [h(ContextBar, { project, pasteArmed: false, canRemoveLine: false, selectionSummary: '2×2', selection: { top: 0, left: 0, rows: 2, columns: 2 }, anchor })]),
})

/** Waits out the Selection bar's arming delay (ticket 499), while its buttons show disabled. */
export async function selectionBarArmed(root: Element): Promise<void> {
  await vi.waitFor(() => expect(root.querySelector('[data-testid="context-bar-copy"]')?.getAttribute('aria-disabled')).toBeNull())
}

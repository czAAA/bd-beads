import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/createProject'
import { en } from '../../i18n/en'
import { mountAt } from '../../testUtils/browserFit'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import { withLayers } from '../../testUtils/layerFields'
import FramePanel from './FramePanel.vue'

// An edge whose name has no room in its cell keeps its glyph, and the name moves to the glyph's Tooltip, opened by a tap
// as by hover; given room again the name comes back (ticket 0864).
const project = withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } }), {
  frame: { row: 2, column: 3, rows: 6, columns: 5, technique: 'loom' as const, beads: {} },
})
const EDGES = ['top', 'bottom', 'left', 'right'] as const

/** The Frame panel in a box of the given width, which the test changes. */
const inBox = defineComponent({ setup: () => () => h('div', { class: 'box', style: { width: '90px' } }, [h(FramePanel, { project })]) })

const nameOf = (root: HTMLElement, edge: (typeof EDGES)[number]) => root.querySelector<HTMLElement>(`[data-testid="frame-panel-cell-${edge}"] [data-fit-label]`)!
const glyphOf = (root: HTMLElement, edge: (typeof EDGES)[number]) => root.querySelector<HTMLElement>(`[data-testid="frame-edge-${edge}-glyph"]`)!

describe('FramePanel edge names', () => {
  it('moves a name with no room into its glyph’s Tooltip, and back once there is room', async () => {
    const { root } = await mountAt(inBox, {}, { locale: 'en', width: 320 })
    await vi.waitFor(() => expect(EDGES.filter((edge) => getComputedStyle(nameOf(root, edge)).visibility === 'hidden')).toEqual([...EDGES]))
    for (const edge of EDGES) expect(glyphOf(root, edge).classList).toContain('app-tooltip')

    glyphOf(root, 'left').click()
    const bubble = glyphOf(root, 'left').querySelector<HTMLElement>('[data-testid="tooltip"]')!
    await vi.waitFor(() => expect(getComputedStyle(bubble).display).not.toBe('none'))
    expect(bubble.textContent?.trim()).toBe(en.frame.edgeName.left)

    root.querySelector<HTMLElement>('.box')!.style.width = '300px'
    await settleForMeasuring()
    await vi.waitFor(() => expect(EDGES.filter((edge) => getComputedStyle(nameOf(root, edge)).visibility === 'hidden')).toEqual([]))
    for (const edge of EDGES) expect(glyphOf(root, edge).classList).not.toContain('app-tooltip')
  })
})

// Each edge's − | + is one joined control with `radius-md` outer ends and a square shared seam. Each button sits in its
// own Tooltip wrapper, so neither is shaped by being the pair's first or last child (ticket 0878).
describe('FramePanel edge steppers', () => {
  it('rounds only the outer ends of each − | + pair', async () => {
    const { root } = await mountAt(inBox, {}, { locale: 'en', width: 320 })
    // The case that broke the old shaping: both buttons in Tooltip wrappers.
    expect(root.querySelectorAll('.frame-panel__pair > .app-button-wrap')).toHaveLength(EDGES.length * 2)
    const probe = root.appendChild(Object.assign(document.createElement('div'), { style: 'border-radius: var(--radius-md)' }))
    const radiusMd = getComputedStyle(probe).borderTopLeftRadius
    probe.remove()
    expect(radiusMd).not.toBe('0px')
    for (const edge of EDGES) {
      const minus = getComputedStyle(root.querySelector(`[data-testid="frame-edge-${edge}-in"]`)!)
      const plus = getComputedStyle(root.querySelector(`[data-testid="frame-edge-${edge}-out"]`)!)
      expect([minus.borderTopLeftRadius, minus.borderBottomLeftRadius, minus.borderTopRightRadius, minus.borderBottomRightRadius]).toEqual([radiusMd, radiusMd, '0px', '0px'])
      expect([plus.borderTopLeftRadius, plus.borderBottomLeftRadius, plus.borderTopRightRadius, plus.borderBottomRightRadius]).toEqual(['0px', '0px', radiusMd, radiusMd])
    }
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MarginSheet from './MarginSheet.vue'
import { createProject } from '../../domain/createProject'
import { moveToRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { useTitleBlockFold } from '../../composables/canvas/useTitleBlockFold'
import type { FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import { frameOutsetPx } from '../../rendering/rulerScale'
import { frameOf } from '../../domain/layerRecord'
import { MARGIN_PX } from '../../rendering/marginSizes'
import { withLayers } from '../../testUtils/layerFields'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  useCanvasBackground().margin.setTitleBlock(true)
  useTitleBlockFold().unfold()
})

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

/** Where a 40 × 11 loom Frame and its sheet are at a zoom: beads of 20px at 100%, its line out from them, its sheet 4
 * beads round them. */
function anchorAt(zoom: number): FrameAnchor {
  const band = 80 * zoom
  const outset = frameOutsetPx(zoom)
  const beads = { width: 800 * zoom, height: 220 * zoom }
  return {
    box: { left: band - outset, top: band - outset, width: beads.width + 2 * outset, height: beads.height + 2 * outset },
    sheet: { left: 0, top: 0, width: beads.width + 2 * band, height: beads.height + 2 * band },
    band,
    viewport: { width: 1000, height: 600 },
  }
}
const anchor = anchorAt(1)

function framed(): Project {
  return withLayers(createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), { frame: { technique: 'loom', row: 0, column: 0, rows: 11, columns: 40, beads: {} } })
}

function mountSheet(props: Partial<InstanceType<typeof MarginSheet>['$props']> = {}) {
  const wrapper = mount(MarginSheet, { props: { project: framed(), anchor, editing: false, pressing: false, ...props }, attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}
const control = (wrapper: ReturnType<typeof mountSheet>, testid: string) => wrapper.get(`[data-testid="${testid}"]`)

describe('the Frame\'s tools on its margin sheet (MarginSheet card, ticket 0657)', () => {
  it('lies over the sheet the canvas draws, its edge outlined while Edit Frame is on', async () => {
    const wrapper = mountSheet()
    const sheet = control(wrapper, 'margin-sheet')
    expect(sheet.attributes('style')).toContain('left: 0px')
    expect(sheet.attributes('style')).toContain('width: 960px')
    expect(sheet.classes()).not.toContain('margin-sheet--editing')
    await wrapper.setProps({ editing: true })
    expect(sheet.classes()).toContain('margin-sheet--editing')
  })

  it('leans with a Canvas twisted off a quarter turn, about the middle the canvas turns on (ticket 0672)', async () => {
    const wrapper = mountSheet({ anchor: { ...anchor, sheet: { ...anchor.sheet, left: 100, top: 50 }, tilt: 25 } })
    const { transform, transformOrigin } = (control(wrapper, 'margin-sheet').element as HTMLElement).style
    expect({ transform, transformOrigin }).toEqual({ transform: 'rotate(25deg)', transformOrigin: '400px 250px' })
    await wrapper.setProps({ anchor })
    expect((control(wrapper, 'margin-sheet').element as HTMLElement).style.transform).toBe('')
  })

  it('holds Row progress, the Move bar and the tools in its top band, in that order and with their names', () => {
    const wrapper = mountSheet()
    const names = control(wrapper, 'margin-band').findAll('button').map((button) => button.attributes('aria-label') ?? button.text())
    expect(names).toEqual([
      'Turn row direction',
      'Reset progress',
      'Row highlight',
      'Row not done',
      'Row done',
      'Move Frame',
      'Mirror the whole Frame',
      'Rotate Frame',
      'Edit Frame',
      'Export',
      'Margin color',
      'Remove Frame',
    ])
    // Row not done is its arrow alone on the paper, named by the label it has in the Progress bar.
    expect(control(wrapper, 'margin-progress-previous').text()).toBe('')
  })

  it('moves the row from its Row done and Row not done, as the Progress bar does', async () => {
    const wrapper = mountSheet({ project: moveToRow(framed(), 2) })
    expect(control(wrapper, 'margin-progress-compact-position').text()).toBe('3/11')
    await control(wrapper, 'margin-progress-next').trigger('click')
    await control(wrapper, 'margin-progress-previous').trigger('click')
    expect(wrapper.emitted('move-row')).toEqual([[1], [-1]])
  })

  it('hands the Move bar\'s press and keys to the canvas, and shows it dragged until the press ends', async () => {
    const wrapper = mountSheet({ pressing: true })
    const move = control(wrapper, 'frame-move-handle')
    await move.trigger('pointerdown', { button: 0 })
    await move.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('move-press')).toHaveLength(1)
    expect(wrapper.emitted('key')).toHaveLength(1)
    expect(move.classes()).toContain('margin-move--dragging')
    await wrapper.setProps({ pressing: false })
    expect(move.classes()).not.toContain('margin-move--dragging')
  })

  it('asks for each tool: Rotate Frame, Edit Frame (pressed while on), Export and Remove Frame', async () => {
    const wrapper = mountSheet({ editing: true })
    expect(control(wrapper, 'frame-edit-toggle').attributes('aria-pressed')).toBe('true')
    for (const testid of ['margin-rotate-frame', 'frame-edit-toggle', 'margin-export', 'frame-chrome-remove']) await control(wrapper, testid).trigger('click')
    expect(wrapper.emitted('rotate')).toHaveLength(1)
    expect(wrapper.emitted('toggle-edit')).toHaveLength(1)
    expect(wrapper.emitted('export')).toEqual([['margin-export']])
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('offers no Edit Frame once a row is done, the Frame then holding still', () => {
    const wrapper = mountSheet({ project: moveToRow(framed(), 1) })
    expect(wrapper.find('[data-testid="frame-edit-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(true)
  })

  it('opens the margin color\'s picker under Margin color, and closes it on Escape', async () => {
    const wrapper = mountSheet()
    const button = control(wrapper, 'margin-color')
    await button.trigger('click')
    await nextTick()
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(document.querySelector('[data-testid="margin-color-popover"] [role="radiogroup"]')?.getAttribute('aria-label')).toBe('Margin color')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(document.querySelector('[data-testid="margin-color-popover"]')).toBeNull()
  })

  it('places the margin color\'s picker again against its button when the canvas is panned (ticket 0736)', async () => {
    const wrapper = mountSheet()
    const button = control(wrapper, 'margin-color')
    await button.trigger('click')
    await nextTick()
    const rect = vi.spyOn(button.element, 'getBoundingClientRect')
    rect.mockClear()
    const panned = anchorAt(1)
    await wrapper.setProps({ anchor: { ...panned, sheet: { ...panned.sheet, left: 120, top: 40 } } })
    await nextTick()
    expect(rect).toHaveBeenCalled()
  })

  it('keeps the margin color\'s picker open while its button stays, and closes it where the zoom takes the button away (ticket 0698)', async () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.9) })
    await control(wrapper, 'margin-color').trigger('click')
    await nextTick()
    // Compact keeps Margin color in the row: the picker follows it.
    await wrapper.setProps({ anchor: anchorAt(0.4) })
    await nextTick()
    expect(document.querySelector('[data-testid="margin-color-popover"]')).not.toBeNull()
    // Bare has no row, so no button to hang from.
    await wrapper.setProps({ anchor: anchorAt(0.2) })
    await nextTick()
    expect(document.querySelector('[data-testid="margin-color-popover"]')).toBeNull()
  })

  it('shows the title block until the Frame panel\'s Switch hides it', async () => {
    const wrapper = mountSheet()
    expect(wrapper.find('[data-testid="margin-title-block"]').exists()).toBe(true)
    useCanvasBackground().margin.setTitleBlock(false)
    await nextTick()
    expect(wrapper.find('[data-testid="margin-title-block"]').exists()).toBe(false)
  })

  it('gives way to a Selection\'s handles where they lie under its top band (ticket 498)', () => {
    expect(control(mountSheet(), 'margin-band').classes()).not.toContain('margin-sheet__yielding')
    const selection = { left: 65, top: 60, width: 300, height: 100 }
    expect(control(mountSheet({ selection }), 'margin-band').classes()).toContain('margin-sheet__yielding')
  })
})

const names = (wrapper: ReturnType<typeof mountSheet>) =>
  wrapper.get('[data-testid="margin-band"]').findAll('button').map((button) => button.attributes('aria-label') ?? button.text())

const styleOf = (wrapper: ReturnType<typeof mountSheet>, testid: string) => control(wrapper, testid).attributes('style') ?? ''

// The band is 80px at 100% here; the drafting sheet's 72px is scale 1, held between 0.6 and 1.5 (ticket 0698), so the
// sheet is full down to 0.6 × 68px of band (51%), compact to 0.6 × 40px (30%), folded to 0.6 × 31px (23%).
describe('the margin sheet\'s forms as the zoom changes (MarginSheet card, Zoom forms, tickets 0658, 0698)', () => {
  it('is full at the drafting sheet\'s band, its tools 14px in and the title block in two rows 10px in', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.9) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--full')
    expect(styleOf(wrapper, 'margin-band')).toContain('top: 14px')
    expect(styleOf(wrapper, 'margin-band')).toContain('transform: scale(1)')
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('full')
    expect(styleOf(wrapper, 'margin-title')).toContain('bottom: 10px')
  })

  it('draws the band\'s row and the title block at the band\'s scale, held at 1.5, so they grow and shrink with the beads (ticket 0698)', () => {
    // At 135% the band is 108px: 1.5, the row 21px down, laid out 2 × 21px narrower than the sheet over the scale.
    const near = mountSheet({ anchor: anchorAt(1.35) })
    expect(styleOf(near, 'margin-band')).toContain('top: 21px')
    expect(styleOf(near, 'margin-band')).toContain('transform: scale(1.5)')
    expect(styleOf(near, 'margin-band')).toContain(`width: ${(anchorAt(1.35).sheet.width - 42) / 1.5}px`)
    expect(styleOf(near, 'margin-title')).toContain('bottom: 15px')
    // At 60% the band is 48px: still the full form, two thirds the size.
    const far = mountSheet({ anchor: anchorAt(0.6) })
    expect(control(far, 'margin-sheet').classes()).toContain('margin-sheet--full')
    expect(styleOf(far, 'margin-band')).toMatch(/transform: scale\(0\.666/)
  })

  it('is compact under 0.6 of 68px: Row highlight, the counter, the track and Row done, the tools, and the title block in one row with its legend', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.4), project: moveToRow(framed(), 2) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--compact')
    // Two rows done: the Frame holds still, so no Edit Frame.
    expect(names(wrapper)).toEqual(['Row highlight', 'Row done', 'Move Frame', 'Mirror the whole Frame', 'Rotate Frame', 'Export', 'Margin color', 'Remove Frame'])
    expect(control(wrapper, 'margin-progress-compact-position').text()).toBe('3/11')
    expect(wrapper.find('[data-testid="margin-progress-track"]').exists()).toBe(true)
    expect(styleOf(wrapper, 'margin-band')).toContain('top: 4.8px')
    expect(styleOf(wrapper, 'margin-band')).toContain('transform: scale(0.6)')
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('compact')
    expect(Number.parseFloat(styleOf(wrapper, 'margin-title').split('bottom: ')[1]!)).toBeCloseTo(3.6)
    expect(wrapper.find('[data-testid="margin-legend"]').exists()).toBe(true)
  })

  it('folds under 0.6 of 40px: Row highlight and the counter with Row done, the Move bar, Margin color and Frame tools, the title block a tab', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.25) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--folded')
    expect(names(wrapper)).toEqual(['Row highlight', 'Row done', 'Move Frame', 'Margin color', 'Frame tools'])
    expect(wrapper.find('[data-testid="margin-progress-track"]').exists()).toBe(false)
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('tab')
    // Folded by the zoom, the tab only names the Frame: there is no room to unfold it.
    expect(control(wrapper, 'margin-title-tab').element.tagName).toBe('SPAN')
    expect(control(wrapper, 'margin-title-tab').text()).toBe('Name this frame')
  })

  it('stands the folded row and tab in the middle of the room between the sheet\'s edge and the Frame\'s line', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.25) })
    const px = (testid: string, side: string) => Number.parseFloat(styleOf(wrapper, testid).split(`${side}: `)[1]!)
    // At 25% the band is 20px, the line its outset out from the beads; the 24px row is 14.4px at 0.6.
    const inset = (20 - frameOutsetPx(0.25) - 24 * 0.6) / 2
    expect(px('margin-band', 'top')).toBeCloseTo(inset, 2)
    expect(px('margin-title', 'bottom')).toBeCloseTo(inset, 2)
  })

  it('keeps only the Move bar where even the folded row has no room, under 0.6 of 31px (tickets 0682, 0698)', async () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.2), editing: true })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--bare')
    expect(wrapper.find('[data-testid="margin-band"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="margin-title"]').exists()).toBe(false)
    expect(wrapper.findAll('button').map((button) => button.attributes('aria-label'))).toEqual(['Move Frame'])
    // Nothing of the sheet is drawn, so not its Edit Frame outline either.
    expect(control(wrapper, 'margin-sheet').classes()).not.toContain('margin-sheet--editing')
    await control(wrapper, 'frame-move-handle').trigger('pointerdown')
    await control(wrapper, 'frame-move-handle').trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.emitted('move-press')).toHaveLength(1)
    expect(wrapper.emitted('key')).toHaveLength(1)
  })

  it('lets the bare Move bar give way to a Selection\'s handles (ticket 0682)', async () => {
    const at = anchorAt(0.2)
    const wrapper = mountSheet({ anchor: at })
    const handle = () => control(wrapper, 'margin-handle')
    expect(handle().classes()).not.toContain('margin-sheet__yielding')
    await wrapper.setProps({ selection: { left: at.box.left + at.box.width / 2 - 10, top: at.box.top + 4, width: 20, height: 20 } })
    expect(handle().classes()).toContain('margin-sheet__yielding')
  })

  it('offers the tools the folded band has no room for in its Frame tools menu, each asking as its button does', async () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.25) })
    const menu = () => control(wrapper, 'margin-frame-tools')
    const items = async () => {
      await menu().trigger('click')
      await nextTick()
      return wrapper.findAll('[role^="menuitem"]')
    }
    expect((await items()).map((item) => item.text())).toEqual(['Mirror the whole Frame', 'Rotate Frame', 'Edit Frame', 'Export', 'Remove Frame'])
    expect(control(wrapper, 'margin-frame-tools-mirror').attributes('role')).toBe('menuitemcheckbox')
    expect(control(wrapper, 'margin-frame-tools-mirror').attributes('aria-checked')).toBe('false')
    for (const id of ['mirror', 'rotate', 'edit', 'export', 'remove']) {
      if (!wrapper.find('[role^="menuitem"]').exists()) await items()
      await control(wrapper, `margin-frame-tools-${id}`).trigger('click')
    }
    expect(wrapper.emitted('mirror')).toHaveLength(1)
    expect(wrapper.emitted('rotate')).toHaveLength(1)
    expect(wrapper.emitted('toggle-edit')).toHaveLength(1)
    // Export hangs from the menu's button, the one it was asked from.
    expect(wrapper.emitted('export')).toEqual([['margin-frame-tools']])
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })
})

describe('folding the title block by hand (MarginSheet card, Title block, ticket 0658)', () => {
  it('folds to the name tab from its fold button, and the tab unfolds it', async () => {
    const wrapper = mountSheet({ project: withLayers(framed(), { frame: { ...frameOf(framed())!, name: 'Sun band' } }) })
    await control(wrapper, 'margin-title-fold').trigger('click')
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('tab')
    const tab = control(wrapper, 'margin-title-tab')
    expect(tab.text()).toBe('Sun band')
    expect(tab.attributes('aria-label')).toBe('Show the title block: Sun band')
    // The tools stay where they are.
    expect(names(wrapper)).toContain('Remove Frame')
    await tab.trigger('click')
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('full')
  })

  it('keeps the fold for the session, on the next sheet too, and folds from the compact title block', async () => {
    const compact = mountSheet({ anchor: anchorAt(0.4) })
    await control(compact, 'margin-title-fold').trigger('click')
    compact.unmount()
    mounted.splice(0)
    expect(control(mountSheet(), 'margin-title').attributes('data-form')).toBe('tab')
  })
})

describe('the title block on a turned Canvas (ticket 0728)', () => {
  const at = (titleCorner: { top: boolean; left: boolean }, zoom = 0.9) => styleOf(mountSheet({ anchor: { ...anchorAt(zoom), titleCorner } }), 'margin-title')

  it('sits inside the border at the Frame\'s own bottom-right corner, wherever the turn puts it, drawn from that corner', () => {
    expect(at({ top: false, left: false })).toMatch(/right: 10px; bottom: 10px;.*transform-origin: 100% 100%/)
    expect(at({ top: false, left: true })).toMatch(/left: 10px; bottom: 10px;.*transform-origin: 0 100%/)
    expect(at({ top: true, left: true })).toMatch(/left: 10px; top: 10px;.*transform-origin: 0 0/)
    expect(at({ top: true, left: false })).toMatch(/right: 10px; top: 10px;.*transform-origin: 100% 0/)
  })

  it('leaves the narrowest band row, the Move bar and the Frame tools button, its room beside it at a top corner', () => {
    const room = (style: string) => Number.parseFloat(style.split('max-width: ')[1]!)
    const { moveWidth, tab, gap, place } = MARGIN_PX
    const narrowestRow = moveWidth + 2 * tab + 2 * gap
    // In drafting px: at the top the row's inset stands on the far side in place of the border, and the row beside it.
    expect(room(at({ top: false, left: true }, 1)) - room(at({ top: true, left: true }, 1))).toBeCloseTo(place.full.side - place.full.border + narrowestRow + gap, 4)
  })

  it('stands the folded tab beside the folded row at a top corner, in the middle of the room above the Frame\'s line', () => {
    const wrapper = mountSheet({ anchor: { ...anchorAt(0.25), titleCorner: { top: true, left: false } } })
    const top = (testid: string) => Number.parseFloat(styleOf(wrapper, testid).split('top: ')[1]!)
    expect(top('margin-title')).toBeCloseTo(top('margin-band'), 4)
  })
})

describe('Mirror the whole Frame (MarginSheet card, ADR 0082)', () => {
  it('stands left of Rotate Frame, named for what it does, pressed in the accent and named Mirror off while the whole Frame is the Mirror', async () => {
    const wrapper = mountSheet()
    const ids = wrapper.findAll('.margin-sheet__tools button').map((button) => button.attributes('data-testid'))
    expect(ids.indexOf('margin-mirror-frame')).toBe(ids.indexOf('margin-rotate-frame') - 1)
    const button = control(wrapper, 'margin-mirror-frame')
    expect(button.attributes('aria-label')).toBe('Mirror the whole Frame')
    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')
    expect(wrapper.emitted('mirror')).toHaveLength(1)

    await wrapper.setProps({ mirrorOnFrame: true })
    expect(control(wrapper, 'margin-mirror-frame').attributes('aria-label')).toBe('Mirror off')
    expect(control(wrapper, 'margin-mirror-frame').attributes('aria-pressed')).toBe('true')
    expect(control(wrapper, 'margin-mirror-frame').classes()).toContain('margin-sheet__mirror--on')
  })
})

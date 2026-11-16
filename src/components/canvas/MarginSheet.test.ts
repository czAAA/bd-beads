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
import { rotateFrame } from '../../domain/rotate'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  useCanvasBackground().margin.setTitleBlock(true)
  useTitleBlockFold().unfold()
})

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
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
      'Back a row',
      'Row done',
      'Move Frame',
      'Mirror the whole Frame',
      'Rotate Frame',
      'Edit Frame',
      'Export',
      'Margin color',
      'Remove Frame',
    ])
    // Back a row is its arrow alone on the paper, named by the label it has in the Progress bar.
    expect(control(wrapper, 'margin-progress-previous').text()).toBe('')
  })

  it('is a Tab stop each for Row progress, the Move bar and the tools, ←/→ stepping along the tools, the title block\'s name next (ticket 0857)', async () => {
    const wrapper = mountSheet()
    const stops = () => wrapper.findAll('button').filter((button) => button.attributes('tabindex') !== '-1')
    const names = stops().map((button) => button.attributes('aria-label') ?? button.text())
    expect(names.slice(0, 4)).toEqual(['Turn row direction', 'Move Frame', 'Mirror the whole Frame', 'Name this Frame'])

    const mirror = control(wrapper, 'margin-mirror-frame')
    ;(mirror.element as HTMLElement).focus()
    await mirror.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(control(wrapper, 'margin-rotate-frame').element)
    await control(wrapper, 'margin-rotate-frame').trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(control(wrapper, 'frame-chrome-remove').element)
    expect(stops().map((button) => button.attributes('data-testid'))).toContain('frame-chrome-remove')
    expect(stops().map((button) => button.attributes('data-testid'))).not.toContain('margin-mirror-frame')
  })

  it('moves the row from its Row done and Back a row, as the Progress bar does', async () => {
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

  it('keeps Edit Frame in place once a row is done, disabled, a long press showing why (ticket 0975)', async () => {
    vi.useFakeTimers()
    const wrapper = mountSheet({ project: moveToRow(framed(), 1) })
    const pencil = control(wrapper, 'frame-edit-toggle')
    expect(pencil.attributes('aria-disabled')).toBe('true')
    await pencil.trigger('click')
    expect(wrapper.emitted('toggle-edit')).toBeUndefined()

    // On touch, a long press shows the reason.
    const tip = () => pencil.element.closest('.app-tooltip')!.querySelector('[role="tooltip"]') as HTMLElement
    await pencil.trigger('pointerdown', { pointerType: 'touch' })
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(tip().hidden).toBe(false)
    expect(tip().textContent).toContain('Rows are marked done. Reset progress to change the size.')
  })

  it('lets Edit Frame work again once progress is reset (ticket 0975)', async () => {
    const wrapper = mountSheet({ project: moveToRow(framed(), 1) })
    await wrapper.setProps({ project: framed() })
    const pencil = control(wrapper, 'frame-edit-toggle')
    expect(pencil.attributes('aria-disabled')).toBeUndefined()
    await pencil.trigger('click')
    expect(wrapper.emitted('toggle-edit')).toHaveLength(1)
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
    await wrapper.setProps({ anchor: anchorAt(0.6) })
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

// The band is 80px at 100% here; the drafting sheet's 72px is scale 1, held between 1 and 1.5 (tickets 0698, 0851), so
// the sheet is full down to 68px of band (85%), compact to 40px (50%), folded to 31px (39%).
describe('the margin sheet\'s forms as the zoom changes (MarginSheet card, Zoom forms, tickets 0658, 0698, 0851)', () => {
  it('is full at the drafting sheet\'s band, its tools 14px in and the title block in two rows 10px in', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.9) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--full')
    expect(styleOf(wrapper, 'margin-band')).toContain('top: 14px')
    expect(styleOf(wrapper, 'margin-band')).toContain('transform: scale(1)')
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('full')
    expect(styleOf(wrapper, 'margin-title')).toContain('bottom: 10px')
  })

  it('draws the band\'s row and the title block at the band\'s scale, held between 1 and 1.5, so they grow with the beads (tickets 0698, 0851)', () => {
    // At 135% the band is 108px: 1.5, the row 21px down, laid out 2 × 21px narrower than the sheet over the scale.
    const near = mountSheet({ anchor: anchorAt(1.35) })
    expect(styleOf(near, 'margin-band')).toContain('top: 21px')
    expect(styleOf(near, 'margin-band')).toContain('transform: scale(1.5)')
    expect(styleOf(near, 'margin-band')).toContain(`width: ${(anchorAt(1.35).sheet.width - 42) / 1.5}px`)
    expect(styleOf(near, 'margin-title')).toContain('bottom: 15px')
    // At 85% the band is 68px: still the full form, at 1 and no smaller, where its words and buttons are legible.
    const far = mountSheet({ anchor: anchorAt(0.85) })
    expect(control(far, 'margin-sheet').classes()).toContain('margin-sheet--full')
    expect(styleOf(far, 'margin-band')).toContain('transform: scale(1)')
  })

  it('is roomy from 104px of band on screen, drawn at 1 there, and the two-row block under it (ticket 1015)', async () => {
    // At 130% the band is 104px: the roomy block, the sheet's scale by 72 / 104, so 1; its inset is still the sheet's.
    const roomy = mountSheet({ anchor: anchorAt(1.3) })
    expect(control(roomy, 'margin-title').attributes('data-form')).toBe('roomy')
    expect(control(roomy, 'margin-title-block').attributes('data-form')).toBe('roomy')
    const drawn = Number.parseFloat(styleOf(roomy, 'margin-title').split('scale(')[1]!)
    expect(drawn).toBeCloseTo(1, 5)
    expect(Number.parseFloat(styleOf(roomy, 'margin-title').split('bottom: ')[1]!)).toBeCloseTo((10 * 104) / 72, 5)
    // The band's row keeps the sheet's own scale.
    expect(Number.parseFloat(styleOf(roomy, 'margin-band').split('scale(')[1]!)).toBeCloseTo(104 / 72, 5)
    // At 125% the band is 100px: the block would reach the Frame's line, so it stays in two rows.
    expect(control(mountSheet({ anchor: anchorAt(1.25) }), 'margin-title').attributes('data-form')).toBe('full')
  })

  it('passes on the roomy block\'s Replace Bead question (ticket 1015)', async () => {
    const wrapper = mountSheet({ anchor: anchorAt(1.5) })
    wrapper.getComponent({ name: 'MarginTitleBlock' }).vm.$emit('replace-bead', 'miyuki/delica/11-0')
    expect(wrapper.emitted('replace-bead')).toEqual([['miyuki/delica/11-0']])
  })

  it('is compact under 68px: Row highlight, the counter, the track and Row done, the tools, and the title block in one row with its legend', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.6), project: moveToRow(framed(), 2) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--compact')
    // Two rows done: the Frame holds still, its Edit Frame kept in place, disabled (ticket 0975).
    expect(names(wrapper)).toEqual(['Row highlight', 'Row done', 'Move Frame', 'Mirror the whole Frame', 'Rotate Frame', 'Edit Frame', 'Export', 'Margin color', 'Remove Frame'])
    expect(control(wrapper, 'margin-progress-compact-position').text()).toBe('3/11')
    expect(wrapper.find('[data-testid="margin-progress-track"]').exists()).toBe(true)
    expect(styleOf(wrapper, 'margin-band')).toContain('top: 8px')
    expect(styleOf(wrapper, 'margin-band')).toContain('transform: scale(1)')
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('compact')
    expect(Number.parseFloat(styleOf(wrapper, 'margin-title').split('bottom: ')[1]!)).toBeCloseTo(6)
    expect(wrapper.find('[data-testid="margin-legend"]').exists()).toBe(true)
  })

  it('folds under 40px: Row highlight and the counter with Row done, the Move bar, Margin color and Frame tools, the title block a tab', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.45) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--folded')
    expect(names(wrapper)).toEqual(['Row highlight', 'Row done', 'Move Frame', 'Margin color', 'Frame tools'])
    expect(wrapper.find('[data-testid="margin-progress-track"]').exists()).toBe(false)
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('tab')
    // Folded by the zoom, the tab only names the Frame: there is no room to unfold it.
    expect(control(wrapper, 'margin-title-tab').element.tagName).toBe('SPAN')
    expect(control(wrapper, 'margin-title-tab').text()).toBe('Name this Frame')
  })

  it('stands the folded row and tab in the middle of the room between the sheet\'s edge and the Frame\'s line', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.45) })
    const px = (testid: string, side: string) => Number.parseFloat(styleOf(wrapper, testid).split(`${side}: `)[1]!)
    // At 45% the band is 36px, the line its outset out from the beads; the 24px row is 24px at 1.
    const inset = (36 - frameOutsetPx(0.45) - 24) / 2
    expect(px('margin-band', 'top')).toBeCloseTo(inset, 2)
    expect(px('margin-title', 'bottom')).toBeCloseTo(inset, 2)
  })

  it('keeps only the Move bar where even the folded row has no room, under 31px (tickets 0682, 0698, 0851)', async () => {
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
    const wrapper = mountSheet({ anchor: anchorAt(0.45) })
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

  it('keeps Edit Frame in the Frame tools menu once a row is done, disabled with its reason (ticket 0975)', async () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.45), project: moveToRow(framed(), 1) })
    await control(wrapper, 'margin-frame-tools').trigger('click')
    await nextTick()
    const edit = control(wrapper, 'margin-frame-tools-edit').get('[role="menuitem"]')
    expect(edit.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Rows are marked done. Reset progress to change the size.')
    await edit.trigger('click')
    expect(wrapper.emitted('toggle-edit')).toBeUndefined()
  })
})

describe('the Frame\'s bar on a coarse pointer (ticket 0976)', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(pointer: coarse)': true }).matchMedia)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  const toolNames = (wrapper: ReturnType<typeof mountSheet>) =>
    control(wrapper, 'margin-band').findAll('.margin-sheet__tools button').map((button) => button.attributes('aria-label'))

  it('keeps Edit Frame and the Frame tools button on the band, full, compact and folded', () => {
    for (const zoom of [1, 0.6, 0.45]) expect(toolNames(mountSheet({ anchor: anchorAt(zoom) })), `${zoom}`).toEqual(['Edit Frame', 'Frame tools'])
  })

  it('lists Mirror, Rotate, Export, Margin color and Remove Frame in the Frame tools menu with their names, each running its own action', async () => {
    const wrapper = mountSheet()
    const items = async () => {
      await control(wrapper, 'margin-frame-tools').trigger('click')
      await nextTick()
      return wrapper.findAll('[role^="menuitem"]')
    }
    expect((await items()).map((item) => item.text())).toEqual(['Mirror the whole Frame', 'Rotate Frame', 'Export', 'Margin color', 'Remove Frame'])
    for (const id of ['mirror', 'rotate', 'export', 'remove']) {
      if (!wrapper.find('[role^="menuitem"]').exists()) await items()
      await control(wrapper, `margin-frame-tools-${id}`).trigger('click')
    }
    expect(wrapper.emitted('mirror')).toHaveLength(1)
    expect(wrapper.emitted('rotate')).toHaveLength(1)
    expect(wrapper.emitted('export')).toEqual([['margin-frame-tools']])
    expect(wrapper.emitted('remove')).toHaveLength(1)
    await items()
    await control(wrapper, 'margin-frame-tools-color').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-testid="margin-color-popover"]')).not.toBeNull()
  })

  it('keeps Edit Frame on the band once a row is done, disabled', () => {
    const wrapper = mountSheet({ project: moveToRow(framed(), 1) })
    expect(control(wrapper, 'frame-edit-toggle').attributes('aria-disabled')).toBe('true')
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

  // An unnamed Frame's tab invites a name: "Name this Frame" opens the name field, the chevron unfolds (ticket 0803).
  it('opens the name field from an unnamed Frame\'s tab, and its chevron unfolds the block', async () => {
    const wrapper = mountSheet()
    await control(wrapper, 'margin-title-fold').trigger('click')
    await control(wrapper, 'margin-frame-name').trigger('click')
    await control(wrapper, 'margin-frame-name-input').setValue('Sun band')
    await control(wrapper, 'margin-frame-name-form').trigger('submit')
    expect(wrapper.emitted('rename')).toEqual([['Sun band']])
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('tab')
    const unfold = control(wrapper, 'margin-title-unfold')
    expect(unfold.attributes('aria-label')).toBe('Show the title block: Name this Frame')
    await unfold.trigger('click')
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('full')
  })

  it('opens the name field from an unnamed Frame\'s tab folded by the zoom too, with no chevron', async () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.45) })
    await control(wrapper, 'margin-frame-name').trigger('click')
    expect(wrapper.find('[data-testid="margin-frame-name-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="margin-title-unfold"]').exists()).toBe(false)
  })

  it('keeps the fold for the session, on the next sheet too, and folds from the compact title block', async () => {
    const compact = mountSheet({ anchor: anchorAt(0.6) })
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
    const wrapper = mountSheet({ anchor: { ...anchorAt(0.45), titleCorner: { top: true, left: false } } })
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

describe('Rotate Frame waits under the pointer (ticket 1016)', () => {
  const copy = (wrapper: ReturnType<typeof mountSheet>) => wrapper.find('[data-testid="margin-rotate-copy"]')
  /** Rotate Frame pressed with a pointer of a kind, its button at (300, 20) on screen. */
  async function pressRotate(wrapper: ReturnType<typeof mountSheet>, pointerType = 'mouse') {
    const button = control(wrapper, 'margin-rotate-frame')
    button.element.getBoundingClientRect = () => new DOMRect(300, 20, 28, 28)
    await button.trigger('pointerdown', { pointerType, clientX: 310, clientY: 30 })
    await button.trigger('click')
  }
  const pressCopy = async (wrapper: ReturnType<typeof mountSheet>, pointerType = 'mouse') => {
    const button = copy(wrapper).get('button')
    await button.trigger('pointerdown', { pointerType })
    await button.trigger('click')
  }

  it('leaves a copy of the button where it was pressed, which stays there as the band moves and turns the Frame again', async () => {
    const wrapper = mountSheet()
    await pressRotate(wrapper)
    expect(wrapper.emitted('rotate')).toHaveLength(1)
    expect(copy(wrapper).attributes('style')).toContain('left: 300px')
    expect(copy(wrapper).attributes('style')).toContain('top: 20px')
    // The Frame turned: its sheet moved 100px left and 40px down, the copy stays on screen where it was.
    await wrapper.setProps({ anchor: { ...anchor, sheet: { ...anchor.sheet, left: -100, top: 40 } } })
    expect(copy(wrapper).attributes('style')).toContain('left: 400px')
    expect(copy(wrapper).attributes('style')).toContain('top: -20px')
    for (let press = 0; press < 3; press++) await pressCopy(wrapper)
    expect(wrapper.emitted('rotate')).toHaveLength(4)
    const button = copy(wrapper).get('button')
    expect([button.attributes('aria-label'), button.attributes('tabindex'), copy(wrapper).attributes('aria-hidden')]).toEqual(['Rotate Frame', '-1', 'true'])
  })

  it('fades out 200ms after the pointer leaves it, and stays if the pointer comes back in time', async () => {
    vi.useFakeTimers()
    const wrapper = mountSheet()
    await pressRotate(wrapper)
    await copy(wrapper).trigger('pointerleave', { pointerType: 'mouse' })
    vi.advanceTimersByTime(199)
    await copy(wrapper).trigger('pointerenter', { pointerType: 'mouse' })
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(copy(wrapper).classes()).not.toContain('margin-sheet__rotate-copy--leaving')
    await copy(wrapper).trigger('pointerleave', { pointerType: 'mouse' })
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(copy(wrapper).classes()).toContain('margin-sheet__rotate-copy--leaving')
    vi.advanceTimersByTime(150)
    await nextTick()
    expect(copy(wrapper).exists()).toBe(false)
  })

  it('on touch leaves 1.6s after the last tap', async () => {
    vi.useFakeTimers()
    const wrapper = mountSheet()
    await pressRotate(wrapper, 'touch')
    vi.advanceTimersByTime(1500)
    await pressCopy(wrapper, 'touch')
    // A finger's lift is no leaving.
    await copy(wrapper).trigger('pointerleave', { pointerType: 'touch' })
    vi.advanceTimersByTime(1599)
    await nextTick()
    expect(copy(wrapper).classes()).not.toContain('margin-sheet__rotate-copy--leaving')
    vi.advanceTimersByTime(1 + 150)
    await nextTick()
    expect(copy(wrapper).exists()).toBe(false)
  })

  it('gives way to the band\'s own button once the Frame has turned back under it, with no fade', async () => {
    vi.useFakeTimers()
    const wrapper = mountSheet()
    await pressRotate(wrapper)
    const button = control(wrapper, 'margin-rotate-frame')
    button.element.getBoundingClientRect = () => new DOMRect(200, 60, 28, 28)
    await wrapper.setProps({ anchor: { ...anchor, sheet: { ...anchor.sheet, left: -100 } } })
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(copy(wrapper).exists()).toBe(true)
    button.element.getBoundingClientRect = () => new DOMRect(300, 20, 28, 28)
    await wrapper.setProps({ anchor })
    await nextTick()
    vi.advanceTimersByTime(149)
    await nextTick()
    expect(copy(wrapper).exists()).toBe(true)
    vi.advanceTimersByTime(1)
    await nextTick()
    expect(copy(wrapper).exists()).toBe(false)
  })

  it('starts its wait on a move away though the pointer never entered it, and goes with the Frame', async () => {
    vi.useFakeTimers()
    const wrapper = mountSheet()
    await pressRotate(wrapper)
    copy(wrapper).element.getBoundingClientRect = () => new DOMRect(295, 15, 38, 38)
    window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 500, clientY: 300 }))
    vi.advanceTimersByTime(150)
    // More moves away keep the wait it began.
    window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 520, clientY: 300 }))
    vi.advanceTimersByTime(50)
    await nextTick()
    expect(copy(wrapper).classes()).toContain('margin-sheet__rotate-copy--leaving')
    await pressRotate(wrapper)
    await wrapper.setProps({ project: withLayers(framed(), { frame: undefined }) })
    expect(copy(wrapper).exists()).toBe(false)
  })

  it('leaves no copy for a press from the keyboard, whose focus goes with the band', async () => {
    const wrapper = mountSheet()
    await control(wrapper, 'margin-rotate-frame').trigger('click')
    expect(wrapper.emitted('rotate')).toHaveLength(1)
    expect(copy(wrapper).exists()).toBe(false)
  })

  it('pressed from the Frame tools menu, closes it and stands where the item was pressed', async () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.45) })
    await control(wrapper, 'margin-frame-tools').trigger('click')
    await nextTick()
    const item = control(wrapper, 'margin-frame-tools-rotate')
    await item.trigger('pointerdown', { pointerType: 'mouse', clientX: 200, clientY: 30 })
    await item.trigger('click')
    await nextTick()
    expect(wrapper.find('[role^="menuitem"]').exists()).toBe(false)
    expect(wrapper.emitted('rotate')).toHaveLength(1)
    // A full-size button centred where the item was pressed.
    expect(copy(wrapper).attributes('style')).toContain(`left: ${200 - MARGIN_PX.tool / 2}px`)
    expect(copy(wrapper).attributes('style')).toContain(`top: ${30 - MARGIN_PX.tool / 2}px`)
  })
})

describe('Edit Frame on a turned Frame (ticket 1016)', () => {
  it('keeps its place in the band, enabled, so no tool shifts as the Frame turns', () => {
    const ids = (project: Project) => mountSheet({ project }).findAll('.margin-sheet__tools [data-testid]').map((each) => each.attributes('data-testid'))
    let turned = framed()
    for (let turn = 1; turn <= 3; turn++) {
      turned = rotateFrame(turned)!
      expect(ids(turned), `${turn}`).toEqual(ids(framed()))
      expect(control(mountSheet({ project: turned }), 'frame-edit-toggle').attributes('aria-disabled')).not.toBe('true')
    }
  })
})

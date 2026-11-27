import { frameIdIn } from '../../testUtils/frameId'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MarginSheet from './MarginSheet.vue'
import { beadChoices, beadLabel, findBead } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import { projectPalette } from '../../domain/palette'
import { choosePanelOption } from '../../testUtils/choosePanelOption'
import { paintAt } from '../../testUtils/layers'
import { moveToRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { useTitleBlockFold } from '../../composables/canvas/useTitleBlockFold'
import type { FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import { frameOutsetPx } from '../../rendering/rulerScale'
import { frameOf, withLayer } from '../../domain/layerRecord'
import { withFrameSheet } from '../../domain/frameSheet'
import { MARGIN_PX } from '../../rendering/marginSizes'
import { withLayers } from '../../testUtils/layerFields'
import { rotateFrame } from '../../domain/rotate'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'
import { firstOf, SECOND, twoFrames } from '../../testUtils/twoFrames'

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
/** The folded form's sheet, the width given: the band holds as many tools as that width fits (ticket 1195). */
const foldedOfWidth = (width: number): FrameAnchor => {
  const at = anchorAt(0.45)
  return { ...at, sheet: { ...at.sheet, width } }
}

function framed(): Project {
  return withLayers(createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), { frame: { technique: 'loom', row: 0, column: 0, rows: 11, columns: 40, beads: {} } })
}

function mountSheet(props: Partial<InstanceType<typeof MarginSheet>['$props']> = {}) {
  const project = props.project ?? framed()
  const wrapper = mount(MarginSheet, { props: { project, frame: frameIdIn(project), anchor, editing: false, pressing: false, ...props }, attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}
const control = (wrapper: ReturnType<typeof mountSheet>, testid: string) => wrapper.get(`[data-testid="${testid}"]`)
/** Opens a folded row of the Frame popover; a row's state is kept, so an open one is left. */
const unfold = async (wrapper: ReturnType<typeof mountSheet>, testid: string) => {
  const header = control(wrapper, testid).get('[aria-expanded]')
  if (header.attributes('aria-expanded') === 'false') await header.trigger('click')
}

/** Every tool as the Frame tools menu lists it: the band's own among them, as second triggers (ticket 1220). */
const ALL_TOOLS = ['Mirror the whole Frame', 'Rotate Frame', 'Edit Frame', 'Export', 'Margin color', 'Remove Frame']
/** The popover's tiles by their accessible names, each its action's, over a short word (ticket 1257). */
const toolLabels = (wrapper: { findAll: (selector: string) => { attributes: (name: string) => string | undefined }[] }) =>
  wrapper.findAll('.frame-popover__tile').map((tile) => tile.attributes('aria-label'))

describe('each Frame\'s own sheet (ticket 1220)', () => {
  const named = () => withLayer(withLayer(twoFrames(), firstOf(twoFrames()), { name: 'Gerdan' }), SECOND, { name: 'Earring' })

  it('belongs to the Frame it is given: its name, its Row progress and its own id', () => {
    const second = mountSheet({ project: moveToRow(named(), 3, SECOND), frame: SECOND })
    expect(control(second, 'margin-sheet').attributes('data-frame')).toBe(SECOND)
    expect(control(second, 'margin-identity').text()).toContain('Earring')
    expect(control(second, 'margin-identity').text()).not.toContain('Gerdan')
    expect(control(second, 'margin-progress-compact-position').text()).toContain('4')
    const first = mountSheet({ project: moveToRow(named(), 3, SECOND), frame: firstOf(named()) })
    expect(control(first, 'margin-identity').text()).toContain('Gerdan')
    expect(control(first, 'margin-progress-compact-position').text()).not.toContain('4')
  })

  it('reasons from its own Frame: Edit Frame is held off by a pass done on that Frame alone', () => {
    const project = moveToRow(named(), 1, SECOND)
    expect(control(mountSheet({ project, frame: SECOND }), 'frame-edit-toggle').attributes('aria-disabled')).toBe('true')
    expect(control(mountSheet({ project, frame: firstOf(project) }), 'frame-edit-toggle').attributes('aria-disabled')).not.toBe('true')
  })

  it('always shows the Frame tools button, whichever Frame it is for', () => {
    expect(control(mountSheet({ project: named(), frame: SECOND }), 'margin-frame-tools').attributes('data-frame')).toBe(SECOND)
  })
})

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

  it('holds Expand the Frame, the Frame\'s chips, the Move bar and the tools in its top band, and Row progress in its foot, in that order and with their names (tickets 1176, 1258)', () => {
    const wrapper = mountSheet()
    const named = (testid: string) => control(wrapper, testid).findAll('button').map((button) => button.attributes('aria-label') ?? button.text())
    expect(named('margin-progress-strip')).toEqual(['Row progress settings', 'Back a row', 'Reset progress', 'Show row marks', 'Row done'])
    expect(named('margin-band')).toEqual([
      'Expand the Frame',
      'Name this Frame',
      'Change Technique: Loom',
      'Your name',
      'Fold the title block',
      'Move Frame',
      'Mirror the whole Frame',
      'Rotate Frame',
      'Edit Frame',
      'Export',
      'Margin color',
      'Remove Frame',
      'Frame tools',
    ])
    expect(control(wrapper, 'margin-progress-previous').text()).toBe('Back a row')
  })

  it('is a Tab stop each for Expand the Frame, the Move bar and the tools, ←/→ stepping along the tools, each of the Frame\'s chips between, and the foot\'s controls then Row progress (tickets 0857, 1169, 1176, 1258)', async () => {
    const wrapper = mountSheet()
    const stops = () => wrapper.findAll('button').filter((button) => button.attributes('tabindex') !== '-1')
    const names = stops().map((button) => button.attributes('aria-label') ?? button.text())
    expect(names.slice(0, 7)).toEqual(['Expand the Frame', 'Name this Frame', 'Change Technique: Loom', 'Your name', 'Fold the title block', 'Move Frame', 'Mirror the whole Frame'])
    expect(names.indexOf('Row progress settings')).toBeGreaterThan(names.indexOf('Letters'))

    const mirror = control(wrapper, 'margin-mirror-frame')
    ;(mirror.element as HTMLElement).focus()
    await mirror.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(control(wrapper, 'margin-rotate-frame').element)
    await control(wrapper, 'margin-rotate-frame').trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(control(wrapper, 'margin-frame-tools').element)
    expect(stops().map((button) => button.attributes('data-testid'))).toContain('margin-frame-tools')
    expect(stops().map((button) => button.attributes('data-testid'))).not.toContain('margin-mirror-frame')
  })

  it('moves the row from its Row done and Back a row, as the Progress bar does', async () => {
    const wrapper = mountSheet({ project: moveToRow(framed(), 2, frameIdIn(framed())) })
    expect(control(wrapper, 'margin-progress-compact-position').text()).toBe('Row 3 of 113/11')
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
    const wrapper = mountSheet({ project: moveToRow(framed(), 1, frameIdIn(framed())) })
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
    const wrapper = mountSheet({ project: moveToRow(framed(), 1, frameIdIn(framed())) })
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

  it('shows who the Frame is and its facts until Name and size on the margin hides them', async () => {
    const wrapper = mountSheet()
    const shown = () => ['margin-identity', 'margin-facts'].map((id) => wrapper.find(`[data-testid="${id}"]`).exists())
    expect(shown()).toEqual([true, true])
    useCanvasBackground().margin.setTitleBlock(false)
    await nextTick()
    expect(shown()).toEqual([false, false])
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

// The band is 80px at 100% here, the drafting sheet's own (ticket 1213; 72px until the legend took two lines): scale 1,
// held between 1 and 1.5 (tickets 0698, 0851), so the sheet is full down to 80px of band (100%), compact to 40px (50%),
// its legend kept to 52px (65%), folded to 31px (39%).
describe('the margin sheet\'s forms as the zoom changes (MarginSheet card, Zoom forms, tickets 0658, 0698, 0851)', () => {
  it('is full at the drafting sheet\'s band, its tools 14px in, the facts and Row progress 12px up', () => {
    const wrapper = mountSheet({ anchor: anchorAt(1) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--full')
    expect(styleOf(wrapper, 'margin-band')).toContain('top: 14px')
    expect(styleOf(wrapper, 'margin-band')).toContain('transform: scale(1)')
    expect(control(wrapper, 'margin-facts').attributes('data-form')).toBe('all')
    expect(wrapper.find('.margin-sheet__progress').attributes('data-form')).toBe('whole')
    expect(styleOf(wrapper, 'margin-foot')).toContain('bottom: 12px')
    expect(styleOf(wrapper, 'margin-foot')).toContain(`width: ${anchorAt(1).sheet.width - 28}px`)
  })

  it('draws the band\'s row and the foot at the band\'s scale, held between 1 and 1.5, so they grow with the beads (tickets 0698, 0851)', () => {
    // At 150% the band is 120px: 1.5, the row 21px down, laid out 2 × 21px narrower than the sheet over the scale.
    const near = mountSheet({ anchor: anchorAt(1.5) })
    expect(styleOf(near, 'margin-band')).toContain('top: 21px')
    expect(styleOf(near, 'margin-band')).toContain('transform: scale(1.5)')
    expect(styleOf(near, 'margin-band')).toContain(`width: ${(anchorAt(1.5).sheet.width - 42) / 1.5}px`)
    expect(styleOf(near, 'margin-foot')).toContain('bottom: 18px')
    expect(styleOf(near, 'margin-foot')).toContain('transform: scale(1.5)')
    // At 100% the band is 80px: still the full form, at 1 and no smaller, where its words and buttons are legible.
    const far = mountSheet({ anchor: anchorAt(1) })
    expect(control(far, 'margin-sheet').classes()).toContain('margin-sheet--full')
    expect(styleOf(far, 'margin-band')).toContain('transform: scale(1)')
  })

  it('is compact under 80px: the tools in the band, the legend and Row progress 10px in, as the band', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.7), project: moveToRow(framed(), 2, frameIdIn(framed())) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--compact')
    // Two rows done: the Frame holds still, its Edit Frame kept in place, disabled (ticket 0975).
    expect(names(wrapper).filter((name) => !name!.startsWith('Edit Frame name') && name !== 'Name this Frame')).toEqual(['Expand the Frame', 'Move Frame', 'Mirror the whole Frame', 'Rotate Frame', 'Edit Frame', 'Export', 'Margin color', 'Remove Frame', 'Frame tools'])
    expect(control(wrapper, 'margin-progress-strip').findAll('button').map((button) => button.attributes('data-testid'))).toEqual(['margin-progress-settings', 'margin-progress-previous', 'margin-progress-strip-reset', 'margin-progress-strip-marks', 'margin-progress-next'])
    // No rules between the strip's parts on the sheet.
    expect(wrapper.find('.row-progress__divider').exists()).toBe(false)
    expect(control(wrapper, 'margin-progress-compact-position').text()).toContain('3 of 11')
    expect(wrapper.find('[data-testid="margin-progress-track"]').exists()).toBe(true)
    expect(styleOf(wrapper, 'margin-band')).toContain('top: 8px')
    expect(styleOf(wrapper, 'margin-band')).toContain('transform: scale(1)')
    expect(styleOf(wrapper, 'margin-foot')).toContain('left: 10px')
    expect(styleOf(wrapper, 'margin-foot')).toContain('bottom: 10px')
  })

  it('folds under 40px: the name, the Move bar and every tool that fits in the band, Row progress alone in the foot', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.45) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--folded')
    // The Frame tools button stands at its end, so the least used tool, Remove Frame, is under it here (ticket 1220).
    expect(names(wrapper)).toEqual(['Expand the Frame', 'Name this Frame', 'Move Frame', 'Mirror the whole Frame', 'Rotate Frame', 'Edit Frame', 'Export', 'Margin color', 'Frame tools'])
    // Back a row and Row done are never dropped.
    expect(wrapper.find('[data-testid="margin-progress-previous"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="margin-progress-next"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="margin-facts"]').exists()).toBe(false)
  })

  it('stands the folded row and strip in the middle of the room between the sheet\'s edge and the Frame\'s line', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.45) })
    const px = (testid: string, side: string) => Number.parseFloat(styleOf(wrapper, testid).split(`${side}: `)[1]!)
    // At 45% the band is 36px, the line its outset out from the beads; the 24px row is 24px at 1.
    const inset = (36 - frameOutsetPx(0.45) - 24) / 2
    expect(px('margin-band', 'top')).toBeCloseTo(inset, 2)
    expect(px('margin-foot', 'bottom')).toBeCloseTo(inset, 2)
  })

  it('keeps only the Move bar and the Frame tools button where even the folded row has no room, under 31px (tickets 0682, 0698, 0851, 1164)', async () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.2), editing: true })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--bare')
    expect(wrapper.find('[data-testid="margin-band"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="margin-facts"]').exists()).toBe(false)
    expect(wrapper.findAll('button').map((button) => button.attributes('aria-label'))).toEqual(['Expand the Frame', 'Move Frame', 'Frame tools'])
    // Row progress is not drawn either, as nothing of the sheet is (ticket 1245).
    expect(wrapper.find('[data-testid="margin-foot"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="margin-progress-strip"]').exists()).toBe(false)
    // Nothing of the sheet is drawn, so not its Edit Frame outline either.
    expect(control(wrapper, 'margin-sheet').classes()).not.toContain('margin-sheet--editing')
    await control(wrapper, 'frame-move-handle').trigger('pointerdown')
    await control(wrapper, 'frame-move-handle').trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.emitted('move-press')).toHaveLength(1)
    expect(wrapper.emitted('key')).toHaveLength(1)
  })

  it('offers every Frame tool in the bare Frame tools menu, Margin color hung from its button (ticket 1164)', async () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.2) })
    const items = async () => {
      await control(wrapper, 'margin-frame-tools').trigger('click')
      await nextTick()
      return wrapper.findAll('.frame-popover__tile')
    }
    await items()
    expect(toolLabels(wrapper)).toEqual(ALL_TOOLS)
    await control(wrapper, 'margin-frame-tools-color').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-testid="margin-color-popover"]')).not.toBeNull()
  })

  it('lets the bare Move bar give way to a Selection\'s handles (ticket 0682)', async () => {
    const at = anchorAt(0.2)
    const wrapper = mountSheet({ anchor: at })
    const handle = () => control(wrapper, 'margin-handle')
    expect(handle().classes()).not.toContain('margin-sheet__yielding')
    await wrapper.setProps({ selection: { left: at.box.left + at.box.width / 2 - 10, top: at.box.top + 4, width: 20, height: 20 } })
    expect(handle().classes()).toContain('margin-sheet__yielding')
    // So does the Frame tools button beside it (ticket 1164): a Selection 50px right of the bar, its handles' 35px reach
    // ending over the button and short of the bar.
    await wrapper.setProps({ selection: { left: at.box.left + at.box.width / 2 + MARGIN_PX.moveWidth / 2 + 50, top: at.box.top + 4, width: 20, height: 20 } })
    expect(handle().classes()).toContain('margin-sheet__yielding')
  })

  it('keeps every tool on the folded band, the Frame tools button always at its end, where the sheet has the room (tickets 1195, 1220)', () => {
    const wrapper = mountSheet({ anchor: foldedOfWidth(1000) })
    expect(wrapper.find('[data-testid="margin-frame-tools"]').exists()).toBe(true)
    expect(control(wrapper, 'margin-band').findAll('.margin-sheet__tools button').map((button) => button.attributes('aria-label'))).toEqual([
      'Mirror the whole Frame',
      'Rotate Frame',
      'Edit Frame',
      'Export',
      'Margin color',
      'Remove Frame',
      'Frame tools',
    ])
  })

  it('puts the tools a narrow band has no room for in its Frame tools menu, the least used first, each asking as its button does', async () => {
    const wrapper = mountSheet({ anchor: foldedOfWidth(250) })
    const menu = () => control(wrapper, 'margin-frame-tools')
    const items = async () => {
      await menu().trigger('click')
      await nextTick()
      return wrapper.findAll('.frame-popover__tile')
    }
    expect(control(wrapper, 'margin-band').findAll('.margin-sheet__tools button').map((button) => button.attributes('aria-label'))).toEqual(['Rotate Frame', 'Edit Frame', 'Frame tools'])
    await items()
    expect(toolLabels(wrapper)).toEqual(ALL_TOOLS)
    expect(control(wrapper, 'margin-frame-tools-mirror').attributes('aria-pressed')).toBe('false')
    for (const id of ['mirror', 'export', 'remove']) {
      if (!wrapper.find('.frame-popover__tile').exists()) await items()
      await control(wrapper, `margin-frame-tools-${id}`).trigger('click')
    }
    expect(wrapper.emitted('mirror')).toHaveLength(1)
    // Export hangs from the menu's button, the one it was asked from.
    expect(wrapper.emitted('export')).toEqual([['margin-frame-tools']])
    expect(wrapper.emitted('remove')).toHaveLength(1)
    await items()
    await control(wrapper, 'margin-frame-tools-color').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-testid="margin-color-popover"]')).not.toBeNull()
  })

  it('takes a tool to the menu and brings it back as the sheet narrows and widens', async () => {
    const wrapper = mountSheet({ anchor: foldedOfWidth(250) })
    const onBand = () => control(wrapper, 'margin-band').findAll('.margin-sheet__tools button').map((button) => button.attributes('data-testid'))
    expect(onBand()).toEqual(['margin-rotate-frame', 'frame-edit-toggle', 'margin-frame-tools'])
    await wrapper.setProps({ anchor: foldedOfWidth(1000) })
    expect(onBand()).toContain('margin-frame-tools')
    expect(onBand()).toContain('margin-mirror-frame')
    await wrapper.setProps({ anchor: foldedOfWidth(250) })
    await control(wrapper, 'margin-frame-tools').trigger('click')
    await nextTick()
    expect(toolLabels(wrapper)).toEqual(ALL_TOOLS)
  })

  it('keeps Edit Frame on the band once a row is done, disabled with its reason, and in the menu with the same reason where there is no room (ticket 0975)', async () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.45), project: moveToRow(framed(), 1, frameIdIn(framed())) })
    expect(control(wrapper, 'frame-edit-toggle').attributes('aria-disabled')).toBe('true')
    await wrapper.setProps({ anchor: foldedOfWidth(140) })
    await control(wrapper, 'margin-frame-tools').trigger('click')
    await nextTick()
    const edit = control(wrapper, 'margin-frame-tools-edit')
    expect(edit.attributes('aria-disabled')).toBe('true')
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

  it('keeps every tool on the band where it has the room, full and compact, with the Frame tools button at its end', () => {
    for (const zoom of [1, 0.9]) expect(toolNames(mountSheet({ anchor: anchorAt(zoom) })), `${zoom}`).toEqual([...ALL_TOOLS, 'Frame tools'])
  })

  it('lists the tools the wider spacing leaves no room for in the Frame tools menu with their names, each running its own action', async () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.45) })
    expect(toolNames(wrapper)).toEqual(['Mirror the whole Frame', 'Rotate Frame', 'Edit Frame', 'Frame tools'])
    const items = async () => {
      await control(wrapper, 'margin-frame-tools').trigger('click')
      await nextTick()
      return wrapper.findAll('.frame-popover__tile')
    }
    await items()
    expect(toolLabels(wrapper)).toEqual(ALL_TOOLS)
    for (const id of ['export', 'remove']) {
      if (!wrapper.find('.frame-popover__tile').exists()) await items()
      await control(wrapper, `margin-frame-tools-${id}`).trigger('click')
    }
    expect(wrapper.emitted('export')).toEqual([['margin-frame-tools']])
    expect(wrapper.emitted('remove')).toHaveLength(1)
    await items()
    await control(wrapper, 'margin-frame-tools-color').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-testid="margin-color-popover"]')).not.toBeNull()
  })

  it('keeps Edit Frame on the band once a row is done, disabled', () => {
    const wrapper = mountSheet({ project: moveToRow(framed(), 1, frameIdIn(framed())) })
    expect(control(wrapper, 'frame-edit-toggle').attributes('aria-disabled')).toBe('true')
  })
})

const named = (project: Project = framed()) => withLayers(project, { frame: { ...frameOf(project)!, name: 'Sun band' } })

describe('who the Frame is, in the top band (MarginSheet card, Calmer sheet; ticket 1258)', () => {
  const chips = (wrapper: ReturnType<typeof mountSheet>) => control(wrapper, 'margin-identity').findAll('button')

  it('holds the name, the Technique, its Drop and the maker after Expand, each a chip with a pencil, then the fold', () => {
    const woven = withLayers({ ...framed(), makerName: 'Ada' }, { frame: { ...frameOf(framed())!, name: 'Sun band', technique: 'brick', techniqueSettings: { brickDrop: 2 } } })
    const wrapper = mountSheet({ project: woven })
    expect(control(wrapper, 'margin-band').find('[data-testid="margin-identity"]').exists()).toBe(true)
    expect(chips(wrapper).map((chip) => chip.text())).toEqual(['Sun band', 'Brick stitch', '2-drop', 'byAda', ''])
    expect(chips(wrapper).slice(0, 4).map((chip) => chip.classes().includes('margin-chip') && chip.find('svg').exists())).toEqual([true, true, true, true])
    expect(chips(wrapper).map((chip) => chip.attributes('aria-label'))).toEqual(['Rename Frame: Sun band', 'Change Technique: Brick stitch', 'Change Drop: 2-drop', 'Change the maker\'s name: Ada', 'Fold the title block'])
  })

  it('asks each chip\'s own edit: the name, the Technique, a setting and the maker\'s name', async () => {
    const wrapper = mountSheet({ project: withLayers(framed(), { frame: { ...frameOf(framed())!, technique: 'brick', techniqueSettings: { brickDrop: 2 } } }) })
    const save = async (testid: string, value: string) => {
      await control(wrapper, `${testid}-edit`).trigger('click')
      await control(wrapper, `${testid}-input`).setValue(value)
      await control(wrapper, `${testid}-form`).trigger('submit')
    }
    await save('margin-frame-name', '  Sun band ')
    await save('margin-maker', 'Ada')
    await choosePanelOption(wrapper, 'margin-technique-picker', 'peyote')
    await control(wrapper, 'margin-brick-drop-edit').trigger('click')
    await control(wrapper, 'margin-brick-drop-stepper-more').trigger('click')
    expect(wrapper.emitted('rename')).toEqual([['Sun band']])
    expect(wrapper.emitted('save-maker-name')).toEqual([['Ada']])
    expect(wrapper.emitted('set-technique')).toEqual([['peyote']])
    expect(wrapper.emitted('set-setting')).toEqual([['brickDrop', 3]])
    await control(wrapper, 'margin-brick-drop-popover').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[data-testid="margin-brick-drop-popover"]').exists()).toBe(false)
    // Loom's Technique describes no setting, so it has no chip for one.
    expect(mountSheet().find('.margin-setting').exists()).toBe(false)
  })

  it('keeps the Technique on once a row is done, as a change asks first (ticket 1184), and locks its settings with the reason', async () => {
    const woven = withLayers(framed(), { frame: { ...frameOf(framed())!, technique: 'peyote' } })
    const wrapper = mountSheet({ project: moveToRow(woven, 1, frameIdIn(woven)) })
    expect(control(wrapper, 'margin-technique-picker').get('button').attributes('aria-disabled')).toBeUndefined()
    const drop = control(wrapper, 'margin-peyote-drop-edit')
    expect(drop.attributes('aria-disabled')).toBe('true')
    await drop.trigger('click')
    expect(wrapper.find('[data-testid="margin-peyote-drop-popover"]').exists()).toBe(false)
  })

  // Safari lays out a top-layer popup that sits inside the sheet's scale where it first showed (the top-left corner),
  // and a field there drops what is typed: every popup a chip opens sits in the app shell, outside the scale.
  it.each([
    ['name field', '[data-testid="margin-frame-name-edit"]', '[data-testid="margin-frame-name-form"]'],
    ['maker field', '[data-testid="margin-maker-edit"]', '[data-testid="margin-maker-form"]'],
    ['Technique list', '[data-testid="margin-technique-picker"] button', '.panel-picker__list'],
    ['Drop stepper', '[data-testid="margin-brick-drop-edit"]', '[data-testid="margin-brick-drop-popover"]'],
    ['Bead pickers', '[data-testid="margin-bead-change"]', '[data-testid="margin-bead-popover"]'],
  ] as const)('opens its %s in the app shell, outside the sheet\'s scale', async (_, chip, popup) => {
    const shell = document.body.appendChild(document.createElement('div'))
    shell.className = 'app-shell'
    onTestFinished(() => shell.remove())
    const project = withLayers(framed(), { frame: { ...frameOf(framed())!, technique: 'brick', techniqueSettings: { brickDrop: 2 } } })
    const wrapper = mount(MarginSheet, { props: { project, frame: frameIdIn(project), anchor, editing: false, pressing: false }, attachTo: shell, global: { stubs: { teleport: false } } })
    mounted.push(wrapper)
    await wrapper.get(chip).trigger('click')
    await nextTick()
    expect(document.querySelector(popup)?.parentElement).toBe(shell)
  })

  it('keeps the name alone compact and folded, still a chip that opens its field', async () => {
    for (const zoom of [0.7, 0.45]) {
      const wrapper = mountSheet({ anchor: anchorAt(zoom) })
      expect(chips(wrapper).map((chip) => chip.text()), `${zoom}`).toEqual(['Name this Frame'])
      await control(wrapper, 'margin-frame-name').trigger('click')
      expect(wrapper.find('[data-testid="margin-frame-name-form"]').exists(), `${zoom}`).toBe(true)
    }
  })

  it('folds the details and the foot\'s facts away from its fold button, the name and Row progress staying, and unfolds them', async () => {
    const wrapper = mountSheet({ project: named() })
    await control(wrapper, 'margin-title-fold').trigger('click')
    expect(chips(wrapper).map((chip) => chip.text())).toEqual(['Sun band', ''])
    expect(wrapper.find('[data-testid="margin-facts"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="margin-progress-next"]').exists()).toBe(true)
    // The tools stay where they are.
    expect(names(wrapper)).toContain('Remove Frame')
    const unfold = control(wrapper, 'margin-title-unfold')
    expect(unfold.attributes('aria-label')).toBe('Show the title block: Sun band')
    await unfold.trigger('click')
    expect(wrapper.find('[data-testid="margin-facts"]').exists()).toBe(true)
  })

  it('keeps the fold for the session, on the next sheet too, and unfolds from the compact band', async () => {
    const first = mountSheet()
    await control(first, 'margin-title-fold').trigger('click')
    first.unmount()
    mounted.splice(0)
    const compact = mountSheet({ anchor: anchorAt(0.7) })
    expect(compact.find('[data-testid="margin-facts"]').exists()).toBe(false)
    await control(compact, 'margin-title-unfold').trigger('click')
    expect(compact.find('[data-testid="margin-facts"]').exists()).toBe(true)
  })
})

describe('the sheet\'s one-line foot (MarginSheet card, Calmer sheet; ticket 1258)', () => {
  const facts = (wrapper: ReturnType<typeof mountSheet>) => control(wrapper, 'margin-facts')
  /** The Frame with its first `count` beads painted each in the next Palette color. */
  const painted = (count: number) =>
    projectPalette(framed()).colors.slice(0, count).reduce((project, color, column) => paintAt(project, [{ row: 0, column }], color.hex), framed())

  it('reads the size in beads then in cm as plain facts, the Bead\'s chip, the legend, Letters, then Row progress', () => {
    const wrapper = mountSheet({ project: painted(3) })
    const parts = [...facts(wrapper).element.children].map((part) => part.className.split(' ')[0])
    expect(parts).toEqual(['margin-facts__size', 'margin-bead', 'margin-facts__legend', 'margin-facts__letters'])
    expect(control(wrapper, 'margin-size').text()).toBe('40 × 11')
    expect(control(wrapper, 'margin-estimate').text()).toBe('≈ 6.0 × 1.7 cm')
    expect(facts(wrapper).find('.margin-facts__size button').exists()).toBe(false)
    expect(control(wrapper, 'margin-foot').element.lastElementChild?.className).toContain('margin-sheet__progress')
  })

  it('letters its legend with each color\'s Swatch letter, at most 8, then "+n"', () => {
    expect(mountSheet({ project: painted(3) }).findAll('.margin-facts__disc').map((disc) => disc.text())).toEqual(['A', 'B', 'C'])
    const many = mountSheet({ project: painted(10) })
    expect(many.findAll('.margin-facts__disc')).toHaveLength(8)
    expect(control(many, 'margin-legend-more').text()).toBe('+2')
  })

  it('opens the Bead\'s pickers from its chip, a pick asking to Replace Bead, and turns Letters on', async () => {
    const wrapper = mountSheet()
    const own = findBead('toho/cube/1.5mm')!
    const chip = control(wrapper, 'margin-bead-change')
    expect(chip.text()).toBe(beadLabel(own))
    expect(chip.attributes('aria-label')).toBe(`Change: ${beadLabel(own)}`)
    await chip.trigger('click')
    expect(control(wrapper, 'margin-bead-popover').text()).toContain('Sets size, weight and colors.')
    const other = beadChoices(own).candidates.find((bead) => bead.brand.id !== own.brand.id)!
    await choosePanelOption(wrapper, 'bead-brand', other.brand.id)
    expect(wrapper.emitted('replace-bead')).toHaveLength(1)
    expect(wrapper.find('[data-testid="margin-bead-popover"]').exists()).toBe(false)
    await control(wrapper, 'margin-letters').trigger('click')
    expect(wrapper.emitted('set-letters')).toEqual([[true]])
  })

  it('closes the Bead\'s pickers on Escape, asking nothing', async () => {
    const wrapper = mountSheet()
    await control(wrapper, 'margin-bead-change').trigger('click')
    await control(wrapper, 'margin-bead-popover').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[data-testid="margin-bead-popover"]').exists()).toBe(false)
    expect(wrapper.emitted('replace-bead')).toBeUndefined()
  })

  it('keeps the legend alone compact, and no facts folded', () => {
    const compact = mountSheet({ anchor: anchorAt(0.7), project: painted(3) })
    expect(facts(compact).attributes('data-form')).toBe('legend')
    expect([...facts(compact).element.children].map((part) => part.className.split(' ')[0])).toEqual(['margin-facts__legend'])
    expect(mountSheet({ anchor: anchorAt(0.45), project: painted(3) }).find('[data-testid="margin-facts"]').exists()).toBe(false)
  })
})

describe('the foot\'s place (tickets 1170, 1258)', () => {
  it('stands at the sheet\'s bottom-left corner as seen, inside the border, drawn from that corner', () => {
    expect(styleOf(mountSheet({ anchor: anchorAt(1) }), 'margin-foot')).toMatch(/left: 14px; bottom: 12px;.*transform-origin: 0 100%/)
  })

  it('leaves the band\'s row the sheet\'s whole width, and the folded strip in the middle of the room below the Frame\'s line', () => {
    const full = mountSheet({ anchor: anchorAt(1) })
    expect(styleOf(full, 'margin-band')).toMatch(new RegExp(`left: ${MARGIN_PX.place.full.side}px;`))
    const folded = mountSheet({ anchor: anchorAt(0.45) })
    const bottom = Number.parseFloat(styleOf(folded, 'margin-foot').split('bottom: ')[1]!)
    const top = Number.parseFloat(styleOf(folded, 'margin-band').split('top: ')[1]!)
    expect(bottom).toBeCloseTo(top, 4)
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

})

describe('Edit Frame on a turned Frame (ticket 1016)', () => {
  it('keeps its place in the band, enabled, so no tool shifts as the Frame turns', () => {
    const ids = (project: Project) => mountSheet({ project }).findAll('.margin-sheet__tools [data-testid]').map((each) => each.attributes('data-testid'))
    let turned = framed()
    for (let turn = 1; turn <= 3; turn++) {
      turned = rotateFrame(turned, undefined, frameIdIn(turned))!
      expect(ids(turned), `${turn}`).toEqual(ids(framed()))
      expect(control(mountSheet({ project: turned }), 'frame-edit-toggle').attributes('aria-disabled')).not.toBe('true')
    }
  })
})

describe('Expand the Frame (MarginSheet card, ticket 1169)', () => {
  /** The slim sheet at 300%: 20px beads times 3, a few px of sheet round the line. */
  const expandedAnchor: FrameAnchor = { box: { left: 30, top: 60, width: 2414, height: 674 }, sheet: { left: 0, top: 0, width: 2450, height: 800 }, band: 240, viewport: { width: 2500, height: 900 } }

  it('asks to expand, its name and Tooltip Back to the Canvas while expanded, with no aria-pressed', async () => {
    const wrapper = mountSheet()
    const button = control(wrapper, 'margin-expand-frame')
    expect(button.attributes('aria-label')).toBe('Expand the Frame')
    expect(button.attributes('aria-pressed')).toBeUndefined()
    await button.trigger('click')
    expect(wrapper.emitted('toggle-expand')).toHaveLength(1)
    await wrapper.setProps({ expanded: true, anchor: expandedAnchor })
    expect(control(wrapper, 'margin-expand-frame').attributes('aria-label')).toBe('Back to the Canvas')
    expect(control(wrapper, 'margin-expand-frame').attributes('aria-pressed')).toBeUndefined()
  })

  it('draws no Move bar while expanded, which is then no Tab stop, and its row and foot 6px in at scale 1', async () => {
    const wrapper = mountSheet({ expanded: true, anchor: expandedAnchor })
    await nextTick()
    expect(wrapper.find('[data-testid="frame-move-handle"]').exists()).toBe(false)
    expect(names(wrapper)).not.toContain('Move Frame')
    expect(styleOf(wrapper, 'margin-band')).toContain('top: 6px')
    expect(styleOf(wrapper, 'margin-band')).toContain('scale(1)')
    expect(styleOf(wrapper, 'margin-foot')).toContain('left: 6px')
    expect(styleOf(wrapper, 'margin-foot')).toContain('bottom: 6px')
  })

  it('holds Row progress in the foot, its Row done the one filled button (tickets 1176, 1223)', async () => {
    const wrapper = mountSheet()
    expect(control(wrapper, 'margin-progress-next').classes()).toContain('app-button--primary')
    await wrapper.setProps({ expanded: true, anchor: expandedAnchor })
    expect(control(wrapper, 'margin-progress-next').classes()).toContain('app-button--primary')
  })

  it('holds every chip and fact, however large the band', async () => {
    const wrapper = mountSheet({ expanded: true, anchor: expandedAnchor })
    await nextTick()
    expect(control(wrapper, 'margin-identity').attributes('data-form')).toBe('all')
    expect(control(wrapper, 'margin-facts').attributes('data-form')).toBe('all')
  })

  it('tells the canvas what its row and its foot measure, so it lays the slim sheet round them', async () => {
    const wrapper = mountSheet({ expanded: true, anchor: expandedAnchor })
    await nextTick()
    const last = () => (wrapper.emitted('slim')!.at(-1)! as [{ row: number; foot: number; rowWidth: number }])[0]
    const foot = () => control(wrapper, 'margin-foot').element.getBoundingClientRect().height
    // The narrowest row holds Expand, the name at its least and the Frame tools button.
    const bare = 2 * MARGIN_PX.tab + 2 * MARGIN_PX.gap
    expect(last()).toEqual({ row: MARGIN_PX.tool, foot: foot(), rowWidth: bare + MARGIN_PX.nameGap.mouse + MARGIN_PX.nameLeast })
    useCanvasBackground().margin.setTitleBlock(false)
    await nextTick()
    expect(last()).toMatchObject({ foot: foot(), rowWidth: 2 * MARGIN_PX.tab + 2 * MARGIN_PX.gap })
    // The strip stays: Row progress is on the sheet alone while expanded.
    expect(wrapper.find('[data-testid="margin-progress-strip"]').exists()).toBe(true)
    await wrapper.setProps({ expanded: false })
    const count = wrapper.emitted('slim')!.length
    await wrapper.setProps({ anchor })
    expect(wrapper.emitted('slim')).toHaveLength(count)
  })
})

describe('the Frame settings popover and the Margin color popover\'s Background (MarginSheet card, ticket 1222)', () => {
  const named = () => withLayer(twoFrames(), SECOND, { name: 'Earring' })
  const open = async (wrapper: ReturnType<typeof mountSheet>) => {
    await control(wrapper, 'margin-frame-tools').trigger('click')
    await nextTick()
  }

  it('opens from the ··· button with its head, every tool, the size and Beads needed, of its own Frame', async () => {
    const wrapper = mountSheet({ project: named(), frame: SECOND })
    await open(wrapper)
    const popover = control(wrapper, 'frame-popover')
    expect(popover.attributes('data-frame')).toBe(SECOND)
    expect(control(wrapper, 'frame-popover-name').text()).toBe('Earring')
    expect(control(wrapper, 'frame-popover-meta').text()).toBe('Loom · 4 × 6')
    expect(toolLabels(wrapper)).toEqual(ALL_TOOLS)
    await unfold(wrapper, 'frame-popover-size')
    expect(control(wrapper, 'frame-size-width').element).toHaveProperty('value', '4')
    expect(wrapper.find('[data-testid="bead-quantities"]').exists()).toBe(true)
  })

  it('hands a typed size and an edge step to its own Frame, and a stepper settles once it closes', async () => {
    const wrapper = mountSheet({ project: named(), frame: SECOND })
    await open(wrapper)
    await unfold(wrapper, 'frame-popover-size')
    await control(wrapper, 'frame-size-width').setValue('8')
    await control(wrapper, 'frame-size-width').trigger('keydown', { key: 'Enter' })
    await control(wrapper, 'frame-edge-top-out').trigger('click')
    expect(wrapper.emitted('resize')).toEqual([[8, 6]])
    expect(wrapper.emitted('step')).toEqual([['top', 1]])
    await control(wrapper, 'margin-frame-tools').trigger('click')
    await nextTick()
    expect(wrapper.emitted('settle-settings')).toHaveLength(1)
  })

  it('names its edges as the Frame lies on screen: a turned Frame\'s Top is the top as seen', async () => {
    const turned = rotateFrame(named(), undefined, SECOND)!
    const wrapper = mountSheet({ project: turned, frame: SECOND })
    await open(wrapper)
    await unfold(wrapper, 'frame-popover-size')
    expect((control(wrapper, 'frame-size-width').element as HTMLInputElement).value).toBe('6')
    await control(wrapper, 'frame-edge-top-out').trigger('click')
    expect(wrapper.emitted('step')).toEqual([['top', 1]])
  })

  it('opens where asked and says so once', async () => {
    const wrapper = mountSheet({ project: named(), frame: SECOND })
    await wrapper.setProps({ popoverAsked: true })
    await nextTick()
    await nextTick()
    expect(wrapper.find('[data-testid="frame-popover"]').exists()).toBe(true)
    expect(wrapper.emitted('popover-opened')).toHaveLength(1)
  })

  it('sets the Frame\'s Background as the second row of the Margin color popover, and shows or hides the title block', async () => {
    const wrapper = mountSheet({ project: named(), frame: SECOND })
    await control(wrapper, 'margin-color').trigger('click')
    await nextTick()
    const popover = document.querySelector('[data-testid="margin-color-popover"]')!
    expect(popover.querySelector('[data-testid="frame-background-section"]')).not.toBeNull()
    popover.querySelector<HTMLElement>('[data-testid="frame-background-section"] [data-testid="background-color-pebble"]')!.click()
    expect(wrapper.emitted('set-background')).toEqual([[3]])
    popover.querySelector<HTMLElement>('[data-testid="margin-title-block-switch"]')!.click()
    await nextTick()
    expect(wrapper.find('[data-testid="margin-identity"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="margin-facts"]').exists()).toBe(false)
  })
})

describe('the calmer Frame popover (MarginSheet card, Calmer sheet; ticket 1257)', () => {
  const woven = () => moveToRow(framed(), 1, frameIdIn(framed()))
  const open = async (project: Project = framed(), props: Record<string, unknown> = {}) => {
    const wrapper = mountSheet({ project, ...props })
    await control(wrapper, 'margin-frame-tools').trigger('click')
    await nextTick()
    return wrapper
  }
  const header = (wrapper: ReturnType<typeof mountSheet>, testid: string) => control(wrapper, testid).get('[aria-expanded]')
  const SECTIONS = ['frame-popover-names', 'frame-popover-bead', 'frame-popover-size', 'frame-popover-row-progress', 'bead-quantities']
  const isOpen = (wrapper: ReturnType<typeof mountSheet>) => wrapper.find('[data-testid="frame-popover"]').exists()

  it('draws each tool as a tile with a short word, and every other part folded with its summary', async () => {
    const named = withLayer({ ...framed(), makerName: 'Olga' }, frameIdIn(framed()), { name: 'Gerdan' })
    const wrapper = await open(named)
    expect(wrapper.findAll('.frame-popover__tile').map((tile) => tile.text())).toEqual(['Mirror', 'Rotate', 'Edit', 'Export', 'Color', 'Remove'])
    for (const section of SECTIONS) expect(header(wrapper, section).attributes('aria-expanded'), section).toBe('false')
    expect(control(wrapper, 'frame-popover-names').text()).toContain('Gerdan · by Olga')
    expect(control(wrapper, 'frame-popover-bead').text()).toContain('TOHO Cube 1.5mm · Loom')
    expect(control(wrapper, 'frame-popover-size').text()).toContain('40 × 11 · ≈')
    expect(control(wrapper, 'frame-popover-row-progress').text()).toContain('Row 1 of 11')
    // Reset progress is on the folded row, off until a row is done.
    expect(control(wrapper, 'frame-popover-reset-icon').attributes('aria-disabled')).toBe('true')
  })

  it('saves the Frame\'s and the maker\'s name as the title block does, on Enter, leaving or closing; Escape puts it back', async () => {
    const wrapper = await open()
    await unfold(wrapper, 'frame-popover-names')
    await control(wrapper, 'frame-popover-frame-name').setValue('  Moth  ')
    await control(wrapper, 'frame-popover-frame-name').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('rename')).toEqual([['Moth']])
    const maker = control(wrapper, 'frame-popover-maker-name')
    await maker.setValue('Ada')
    ;(maker.element as HTMLInputElement).focus()
    await maker.trigger('keydown', { key: 'Escape' })
    expect((maker.element as HTMLInputElement).value).toBe('')
    expect(wrapper.emitted('save-maker-name')).toBeUndefined()
    await maker.setValue('Ada')
    await control(wrapper, 'margin-frame-tools').trigger('click')
    await nextTick()
    expect(wrapper.emitted('save-maker-name')).toEqual([['Ada']])
  })

  it('asks the Bead and Technique through the sheet\'s own events', async () => {
    const wrapper = await open()
    await unfold(wrapper, 'frame-popover-bead')
    await control(wrapper, 'frame-popover-technique-peyote').trigger('click')
    expect(wrapper.emitted('set-technique')).toEqual([['peyote']])
    expect(wrapper.find('[data-testid="frame-popover-technique-locked"]').exists()).toBe(false)
    // A Bead pick closes the popover, so nothing is over Replace bead?.
    await control(wrapper, 'bead-brand').get('button').trigger('click')
    await nextTick()
    await wrapper.get('[data-value="miyuki"]').trigger('click')
    await nextTick()
    expect(wrapper.emitted('replace-bead')).toHaveLength(1)
    expect(isOpen(wrapper)).toBe(false)
  })

  it('steps a setting of the Technique through the sheet\'s own event', async () => {
    const wrapper = await open(withFrameSheet(framed(), { ...frameOf(framed())!, technique: 'peyote' }, { frame: frameIdIn(framed()) }))
    await unfold(wrapper, 'frame-popover-bead')
    await wrapper.get('[data-testid$="drop-more"]').trigger('click')
    expect(wrapper.emitted('set-setting')).toHaveLength(1)
  })

  it('refuses a name over the limit with a line saying so, saving nothing', async () => {
    const wrapper = await open(withLayer(framed(), frameIdIn(framed()), { name: 'x'.repeat(80) }))
    await unfold(wrapper, 'frame-popover-names')
    await control(wrapper, 'frame-popover-frame-name').setValue('y'.repeat(70))
    await control(wrapper, 'frame-popover-frame-name').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('rename')).toBeUndefined()
    expect(control(wrapper, 'frame-popover-names').text()).toContain('40')
  })

  it('locks the Technique and its settings while a row is marked done, saying why and offering Reset progress', async () => {
    const wrapper = await open(withFrameSheet(woven(), { ...frameOf(woven())!, technique: 'peyote' }, { frame: frameIdIn(woven()) }))
    await unfold(wrapper, 'frame-popover-bead')
    const radio = control(wrapper, 'frame-popover-technique-loom')
    expect(radio.attributes('aria-disabled')).toBe('true')
    await radio.trigger('click')
    expect(wrapper.emitted('set-technique')).toBeUndefined()
    expect(wrapper.get('[data-testid$="drop-more"]').attributes('aria-disabled')).toBe('true')
    expect(control(wrapper, 'frame-popover-technique-locked').text()).toBe('Rows are marked done. Reset progress to change the Technique.')
    await control(wrapper, 'frame-popover-technique-locked-reset').trigger('click')
    expect(wrapper.emitted('reset-progress')).toHaveLength(1)
    expect(isOpen(wrapper)).toBe(false)
  })

  it('runs Row progress from its row: Row done, Back a row, the way from a dropdown and Show row marks', async () => {
    const wrapper = await open(woven(), { rowHighlight: true })
    await unfold(wrapper, 'frame-popover-row-progress')
    expect(control(wrapper, 'frame-popover-position').text()).toBe('Row 2 of 11')
    await control(wrapper, 'frame-popover-next').trigger('click')
    await control(wrapper, 'frame-popover-previous').trigger('click')
    expect(wrapper.emitted('move-row')).toEqual([[1], [-1]])
    await control(wrapper, 'frame-popover-direction').get('button').trigger('click')
    await nextTick()
    await wrapper.get('[data-value="up"]').trigger('click')
    expect(wrapper.emitted('set-row-direction')).toEqual([['up']])
    await control(wrapper, 'frame-popover-row-marks').trigger('click')
    expect(wrapper.emitted('toggle-row-highlight')).toHaveLength(1)
    expect(isOpen(wrapper)).toBe(true)
  })

  it('stays open, where it is, through Rotate Frame, and closes for the other tools', async () => {
    const wrapper = await open()
    const place = () => wrapper.get('.menu-button__list').attributes('style')
    const before = place()
    await control(wrapper, 'margin-frame-tools-rotate').trigger('pointerdown', { pointerType: 'mouse', clientX: 200, clientY: 30 })
    await control(wrapper, 'margin-frame-tools-rotate').trigger('click')
    await wrapper.setProps({ anchor: anchorAt(1.2) })
    expect(wrapper.emitted('rotate')).toHaveLength(1)
    expect(isOpen(wrapper)).toBe(true)
    expect(place()).toBe(before)
    expect(wrapper.find('[data-testid="margin-rotate-copy"]').exists()).toBe(false)
    await control(wrapper, 'margin-frame-tools-mirror').trigger('click')
    expect(isOpen(wrapper)).toBe(false)
  })

  it('opens again where it was when a turn leaves the sheet bare, its button drawn anew', async () => {
    const wrapper = await open()
    const place = () => wrapper.get('.menu-button__list').attributes('style')
    const before = place()
    await control(wrapper, 'margin-frame-tools-rotate').trigger('click')
    await wrapper.setProps({ anchor: anchorAt(0.2) })
    await nextTick()
    await nextTick()
    expect(wrapper.find('[data-testid="margin-band"]').exists()).toBe(false)
    expect(isOpen(wrapper)).toBe(true)
    expect(place()).toBe(before)
    // A second turn from the button drawn anew leaves it there too.
    await control(wrapper, 'margin-frame-tools-rotate').trigger('click')
    expect(place()).toBe(before)
  })

  it('closes for a Rotate Frame that asks about the rows done first, so nothing is over the question', async () => {
    const wrapper = await open(woven())
    await control(wrapper, 'margin-frame-tools-rotate').trigger('click')
    expect(wrapper.emitted('rotate')).toHaveLength(1)
    expect(isOpen(wrapper)).toBe(false)
  })
})

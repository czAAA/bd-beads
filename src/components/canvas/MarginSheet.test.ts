import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
    expect(move.classes()).toContain('margin-sheet__move--dragging')
    await wrapper.setProps({ pressing: false })
    expect(move.classes()).not.toContain('margin-sheet__move--dragging')
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

describe('the margin sheet\'s forms as the zoom changes (MarginSheet card, Zoom forms, ticket 0658)', () => {
  it('is full where the band is 68px or more, its tools 28px in and the title block in two rows', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.85) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--full')
    expect(control(wrapper, 'margin-band').attributes('style')).toContain('top: 14px')
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('full')
    expect(control(wrapper, 'margin-title').attributes('style')).toContain('bottom: 10px')
  })

  it('is compact under 68px: the counter, the track and Row done, the tools, and the title block in one row', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.6), project: moveToRow(framed(), 2) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--compact')
    // Two rows done: the Frame holds still, so no Edit Frame.
    expect(names(wrapper)).toEqual(['Row done', 'Move Frame', 'Rotate Frame', 'Export', 'Margin color', 'Remove Frame'])
    expect(control(wrapper, 'margin-progress-compact-position').text()).toBe('3/11')
    expect(wrapper.find('[data-testid="margin-progress-track"]').exists()).toBe(true)
    expect(control(wrapper, 'margin-band').attributes('style')).toContain('top: 8px')
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('compact')
    expect(control(wrapper, 'margin-title').attributes('style')).toContain('bottom: 6px')
    expect(wrapper.find('[data-testid="margin-legend"]').exists()).toBe(false)
  })

  it('folds under 40px: the counter with Row done, the Move bar, Margin color and Frame tools, the title block a tab', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.4) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--folded')
    expect(names(wrapper)).toEqual(['Row done', 'Move Frame', 'Margin color', 'Frame tools'])
    expect(wrapper.find('[data-testid="margin-progress-track"]').exists()).toBe(false)
    expect(control(wrapper, 'margin-title').attributes('data-form')).toBe('tab')
    // Folded by the zoom, the tab only names the Frame: there is no room to unfold it.
    expect(control(wrapper, 'margin-title-tab').element.tagName).toBe('SPAN')
    expect(control(wrapper, 'margin-title-tab').text()).toBe('Name this frame')
  })

  it('stands the folded row and tab in the middle of the room between the sheet\'s edge and the Frame\'s line', () => {
    const at40 = anchorAt(0.4)
    const wrapper = mountSheet({ anchor: at40 })
    const px = (testid: string, side: string) => Number.parseFloat(control(wrapper, testid).attributes('style')!.split(`${side}: `)[1])
    // At 40% the band is 32px and the line 5.3px out from the beads: 26.7px of room, the 24px row 1.35px in.
    expect(px('margin-band', 'top')).toBeCloseTo(1.35, 1)
    expect(px('margin-title', 'bottom')).toBeCloseTo(1.35, 1)
  })

  it('is the paper alone where even the folded row has no room, under 31px', () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.3) })
    expect(control(wrapper, 'margin-sheet').classes()).toContain('margin-sheet--bare')
    expect(wrapper.find('[data-testid="margin-band"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="margin-title"]').exists()).toBe(false)
  })

  it('offers the tools the folded band has no room for in its Frame tools menu, each asking as its button does', async () => {
    const wrapper = mountSheet({ anchor: anchorAt(0.4) })
    const menu = () => control(wrapper, 'margin-frame-tools')
    const items = async () => {
      await menu().trigger('click')
      await nextTick()
      return wrapper.findAll('[role="menuitem"]')
    }
    expect((await items()).map((item) => item.text())).toEqual(['Rotate Frame', 'Edit Frame', 'Export', 'Remove Frame'])
    for (const id of ['rotate', 'edit', 'export', 'remove']) {
      if (!wrapper.find('[role="menuitem"]').exists()) await items()
      await control(wrapper, `margin-frame-tools-${id}`).trigger('click')
    }
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
    const compact = mountSheet({ anchor: anchorAt(0.6) })
    await control(compact, 'margin-title-fold').trigger('click')
    compact.unmount()
    mounted.splice(0)
    expect(control(mountSheet(), 'margin-title').attributes('data-form')).toBe('tab')
  })
})

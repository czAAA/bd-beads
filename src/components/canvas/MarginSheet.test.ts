import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MarginSheet from './MarginSheet.vue'
import { createProject } from '../../domain/createProject'
import { moveToRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { useCanvasBackground } from '../../theme/useCanvasBackground'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  useCanvasBackground().margin.setTitleBlock(true)
})

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

/** A 40 × 11 Frame at 100%: its line 7px out from its beads, its sheet 72px (4 beads of 18px) round them. */
const anchor = {
  box: { left: 65, top: 65, width: 734, height: 212 },
  sheet: { left: 0, top: 0, width: 864, height: 342 },
  band: 72,
  viewport: { width: 1000, height: 600 },
}

function framed(): Project {
  return { ...createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), frame: { technique: 'loom', row: 0, column: 0, rows: 11, columns: 40, beads: {} } }
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
    expect(sheet.attributes('style')).toContain('width: 864px')
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
    expect(wrapper.emitted('export')).toHaveLength(1)
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

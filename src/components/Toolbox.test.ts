import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Toolbox from './Toolbox.vue'
import { BEAD_CATALOG } from '../domain/beads'
import { createPattern, type Pattern } from '../domain/pattern'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makePattern(): Pattern {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 30, unit: 'mm' },
  })
}

function mountToolbox(overrides: Partial<InstanceType<typeof Toolbox>['$props']> = {}) {
  return mount(Toolbox, {
    props: {
      pattern: makePattern(),
      activeTool: 'paint',
      canUndo: false,
      canRedo: false,
      canCopy: false,
      mirrorAxes: { horizontal: false, vertical: false },
      richMirror: false,
      mirrorAxisCounts: { columns: 0, rows: 0 },
      mirrorCopyMode: false,
      ...overrides,
    },
  })
}

describe('Toolbox', () => {
  it('renders five Tool groups in order: Tools, Colors, Edit, Mirror, Row progress', () => {
    const wrapper = mountToolbox()

    const groups = wrapper.findAll('.tool-group')
    expect(groups.map((group) => group.find('.tool-group__title').text())).toEqual([
      ru.toolbox.groups.tools,
      ru.toolbox.groups.colors,
      ru.toolbox.groups.edit,
      ru.toolbox.groups.mirror,
      ru.toolbox.groups.rowProgress,
    ])
  })

  it('puts Paint, Fill, Select and Delete all inside the Tools group', () => {
    const wrapper = mountToolbox()

    const toolsGroup = wrapper.findAll('.tool-group')[0]!
    for (const testId of ['tool-paint', 'tool-fill', 'tool-select', 'delete-all-button']) {
      expect(toolsGroup.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
  })

  it('emits delete-all when its button is clicked', async () => {
    const wrapper = mountToolbox()

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')

    expect(wrapper.emitted('delete-all')).toHaveLength(1)
  })

  it('puts the Palette picker inside the Colors group', () => {
    const wrapper = mountToolbox()

    const colorsGroup = wrapper.findAll('.tool-group')[1]!
    expect(colorsGroup.find('[data-testid="palette-picker"]').exists()).toBe(true)
  })

  it('puts the Custom color picker inside the Colors group, after the Palette picker', () => {
    const wrapper = mountToolbox()

    const colorsGroup = wrapper.findAll('.tool-group')[1]!
    const inDocumentOrder = [
      ...colorsGroup.element.querySelectorAll('[data-color-id], [data-testid="custom-color-input"]'),
    ]
    const lastPaletteIndex = inDocumentOrder.map((el) => el.hasAttribute('data-color-id')).lastIndexOf(true)
    const customColorIndex = inDocumentOrder.findIndex(
      (el) => el.getAttribute('data-testid') === 'custom-color-input',
    )

    expect(customColorIndex).toBeGreaterThan(-1)
    expect(customColorIndex).toBeGreaterThan(lastPaletteIndex)
  })

  it('puts Undo, Rotate, Copy and Redo inside the Edit group', () => {
    const wrapper = mountToolbox()

    const editGroup = wrapper.findAll('.tool-group')[2]!
    for (const testId of ['undo-button', 'rotate-button', 'copy-button', 'redo-button']) {
      expect(editGroup.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
  })

  it('puts the mirror axis and mirror-current controls inside the Mirror group', () => {
    const wrapper = mountToolbox()

    const mirrorGroup = wrapper.findAll('.tool-group')[3]!
    for (const testId of ['mirror-horizontal', 'mirror-vertical', 'mirror-current-horizontal', 'mirror-current-vertical']) {
      expect(mirrorGroup.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
  })

  it('puts the row progress controls and readout inside the Row progress group', () => {
    const wrapper = mountToolbox()

    const rowProgressGroup = wrapper.findAll('.tool-group')[4]!
    for (const testId of [
      'row-progress-enabled',
      'row-progress-direction',
      'row-progress-position',
      'row-progress-previous',
      'row-progress-next',
    ]) {
      expect(rowProgressGroup.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
  })

  it('gives the row progress readout its own full row, not counted among the icon controls', () => {
    const wrapper = mountToolbox()

    expect(wrapper.find('[data-testid="row-progress-position"]').classes()).toContain('tool-group__full-row')
  })

  it('emits select-tool when a tool button is clicked', async () => {
    const wrapper = mountToolbox()

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    expect(wrapper.emitted('select-tool')).toEqual([['fill']])
  })

  it('emits select-color when a palette swatch is clicked', async () => {
    const wrapper = mountToolbox()

    await wrapper.find('[data-color-id="blue"]').trigger('click')

    expect(wrapper.emitted('select-color')).toEqual([['blue']])
  })

  it('emits select-custom-color with the hex the native color input reports', async () => {
    const wrapper = mountToolbox()

    const input = wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]')
    input.element.value = '#abcdef'
    await input.trigger('input')

    expect(wrapper.emitted('select-custom-color')).toEqual([['#abcdef']])
  })

  it('marks the Custom color slot selected only when selectedColorId is unset, mirroring PalettePicker', () => {
    const withCustomActive = mountToolbox({ selectedColorId: undefined, customColor: '#abcdef' })
    const withPaletteActive = mountToolbox({ selectedColorId: 'blue', customColor: '#abcdef' })

    expect(
      withCustomActive.find('[data-testid="custom-color-input"]').attributes('aria-pressed'),
    ).toBe('true')
    expect(
      withPaletteActive.find('[data-testid="custom-color-input"]').attributes('aria-pressed'),
    ).toBe('false')
    expect(withPaletteActive.find('[data-color-id="blue"]').attributes('aria-pressed')).toBe('true')
  })

  it('emits undo, toggle-rotate, copy and redo from the Edit group', async () => {
    const wrapper = mountToolbox({ canUndo: true, canRedo: true, canCopy: true })

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    await wrapper.find('[data-testid="redo-button"]').trigger('click')

    expect(wrapper.emitted('undo')).toHaveLength(1)
    expect(wrapper.emitted('toggle-rotate')).toHaveLength(1)
    expect(wrapper.emitted('copy')).toHaveLength(1)
    expect(wrapper.emitted('redo')).toHaveLength(1)
  })

  it('disables Undo, Copy and Redo purely from its own props, not internal state', () => {
    const wrapper = mountToolbox({ canUndo: false, canRedo: false, canCopy: false })

    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(true)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(true)
  })

  it('emits toggle-mirror-axis with the axis that was clicked', async () => {
    const wrapper = mountToolbox()

    await wrapper.find('[data-testid="mirror-horizontal"]').trigger('click')
    await wrapper.find('[data-testid="mirror-vertical"]').trigger('click')

    expect(wrapper.emitted('toggle-mirror-axis')).toEqual([['horizontal'], ['vertical']])
  })

  it('emits mirror-current with the axis that was clicked', async () => {
    const wrapper = mountToolbox()

    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('click')

    expect(wrapper.emitted('mirror-current')).toEqual([['horizontal']])
  })

  it('emits toggle-row-progress with the next enabled state', async () => {
    const wrapper = mountToolbox()

    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')

    expect(wrapper.emitted('toggle-row-progress')).toEqual([[true]])
  })

  it('emits move-row with the step direction', async () => {
    const pattern = makePattern()
    pattern.rowProgress.enabled = true
    const wrapper = mountToolbox({ pattern })

    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

    expect(wrapper.emitted('move-row')).toEqual([[1]])
  })

  it('reflects rotated/row-progress state from the pattern prop', () => {
    const pattern = makePattern()
    pattern.rotated = true
    pattern.rowProgress.enabled = true

    const wrapper = mountToolbox({ pattern })

    expect(wrapper.find('[data-testid="rotate-button"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="row-progress-enabled"]').attributes('aria-pressed')).toBe('true')
  })

  it('names every group for screen readers via its own title', () => {
    const wrapper = mountToolbox()

    const groups = wrapper.findAll('.tool-group')
    for (const group of groups) {
      const labelledBy = group.attributes('aria-labelledby')
      expect(labelledBy).toBeTruthy()
    }
  })

  it('reads group titles from the shared i18n dictionary, distinct per locale', () => {
    // Mounted standalone (no provideI18n ancestor) it falls back to the default locale, Russian.
    const wrapper = mountToolbox()

    expect(en.toolbox.groups.tools).not.toBe(ru.toolbox.groups.tools)
    expect(wrapper.text()).toContain(ru.toolbox.groups.tools)
    expect(wrapper.text()).not.toContain(en.toolbox.groups.tools)
  })

  it('exposes collapseExpandedGroup, reporting nothing to collapse when no group is expanded (ticket 41)', () => {
    // No group here holds more than 14 controls (see ToolGroup.test.ts for the expand/collapse mechanics with a
    // synthetic one that does), so none can be hover-expanded — this is a regression guard for App.vue's onKeyDown
    // wiring (see App.vue), which relies on this method existing and returning false in exactly this situation.
    const wrapper = mountToolbox()

    expect(wrapper.vm.collapseExpandedGroup()).toBe(false)
  })
})

describe('Toolbox with the rich Mirror flag on (ticket 44)', () => {
  it('shows the Left–right/Top–bottom counters instead of the on/off toggles', () => {
    const wrapper = mountToolbox({ richMirror: true })

    expect(wrapper.find('[data-testid="mirror-left-right"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mirror-top-bottom"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mirror-horizontal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mirror-vertical"]').exists()).toBe(false)
  })

  it('still shows the Mirror current buttons, unchanged (ticket 44 leaves them for ticket 46)', () => {
    const wrapper = mountToolbox({ richMirror: true })

    expect(wrapper.find('[data-testid="mirror-current-horizontal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mirror-current-vertical"]').exists()).toBe(true)
  })

  it('shows the copy-mode switch, its on/off state, and emits toggle-mirror-copy-mode when clicked (ticket 45)', async () => {
    const wrapper = mountToolbox({ richMirror: true, mirrorCopyMode: false })

    const button = wrapper.find('[data-testid="mirror-copy-mode"]')
    expect(button.exists()).toBe(true)
    expect(button.attributes('aria-pressed')).toBe('false')

    await button.trigger('click')

    expect(wrapper.emitted('toggle-mirror-copy-mode')).toHaveLength(1)
  })

  it('reflects an on copy-mode state from its prop', () => {
    const wrapper = mountToolbox({ richMirror: true, mirrorCopyMode: true })

    expect(wrapper.find('[data-testid="mirror-copy-mode"]').attributes('aria-pressed')).toBe('true')
  })

  it('does not render the copy-mode switch with the flag off', () => {
    const wrapper = mountToolbox({ richMirror: false })

    expect(wrapper.find('[data-testid="mirror-copy-mode"]').exists()).toBe(false)
  })

  it('gives each counter its own full row, not counted among the icon controls', () => {
    const wrapper = mountToolbox({ richMirror: true })

    expect(wrapper.find('[data-testid="mirror-left-right"]').classes()).toContain('tool-group__full-row')
    expect(wrapper.find('[data-testid="mirror-top-bottom"]').classes()).toContain('tool-group__full-row')
  })

  it('shows each counter its current value', () => {
    const wrapper = mountToolbox({
      richMirror: true,
      mirrorAxisCounts: { columns: 2, rows: 1 },
    })

    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="mirror-top-bottom-value"]').text()).toContain('1')
  })

  it('not rotated: Left–right drives columns, Top–bottom drives rows', async () => {
    const wrapper = mountToolbox({ richMirror: true, mirrorAxisCounts: { columns: 1, rows: 0 } })

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    await wrapper.find('[data-testid="mirror-top-bottom-increase"]').trigger('click')

    expect(wrapper.emitted('set-mirror-axis-count')).toEqual([
      ['columns', 2],
      ['rows', 1],
    ])
  })

  it('rotated: swaps which grid axis Left–right/Top–bottom each drive, view-only (never a data transpose)', async () => {
    const pattern = makePattern()
    pattern.rotated = true
    const wrapper = mountToolbox({ pattern, richMirror: true, mirrorAxisCounts: { columns: 3, rows: 1 } })

    // Left–right now reads/writes rows; Top–bottom now reads/writes columns.
    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="mirror-top-bottom-value"]').text()).toContain('3')

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    expect(wrapper.emitted('set-mirror-axis-count')).toEqual([['rows', 2]])
  })

  it('disables decrease at 0 and increase at cells - 1', () => {
    const pattern = makePattern() // 15mm/1.5mm cube -> 10 columns, 30mm/1.5mm -> 20 rows
    expect(pattern.columns).toBe(10)

    const wrapper = mountToolbox({
      pattern,
      richMirror: true,
      mirrorAxisCounts: { columns: 0, rows: pattern.rows - 1 },
    })

    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="mirror-left-right-decrease"]').element.disabled,
    ).toBe(true)
    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="mirror-top-bottom-increase"]').element.disabled,
    ).toBe(true)
  })
})

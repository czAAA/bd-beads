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
      canRemoveSelectedLine: false,
      mirrorAxisCounts: { columns: 0, rows: 0 },
      mirrorCopyMode: false,
      ...overrides,
    },
  })
}

describe('Toolbox', () => {
  it('renders Tools, Colors and Edit as groups, then Mirror and Size as disclosure rows (tickets 75, 144)', () => {
    const wrapper = mountToolbox()

    const groups = wrapper.findAll('.tool-group')
    expect(groups.map((group) => group.find('.tool-group__title').text())).toEqual([
      ru.toolbox.groups.tools,
      ru.toolbox.groups.colors,
      ru.toolbox.groups.edit,
    ])
    // Mirror and Size are disclosure rows (ticket 75), closed until pressed.
    const rows = wrapper.findAll('.disclosure-row')
    expect(rows.map((row) => row.find('.disclosure-row__label').text())).toEqual([ru.toolbox.groups.mirror, ru.toolbox.groups.size])
    expect(rows.map((row) => row.find('button').attributes('aria-expanded'))).toEqual(['false', 'false'])
  })

  it('puts Paint, Fill, Select, Erase, remove-line and Delete all inside the Tools group', () => {
    const wrapper = mountToolbox()

    const toolsGroup = wrapper.findAll('.tool-group')[0]!
    for (const testId of ['tool-paint', 'tool-fill', 'tool-select', 'tool-erase', 'tool-remove-line', 'delete-all-button']) {
      expect(toolsGroup.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
  })

  it('disables "remove selected row/column" unless canRemoveSelectedLine is true, and emits when clicked (ticket 123)', async () => {
    const wrapper = mountToolbox()
    expect(wrapper.find<HTMLButtonElement>('[data-testid="tool-remove-line"]').element.disabled).toBe(true)

    await wrapper.setProps({ canRemoveSelectedLine: true })
    expect(wrapper.find<HTMLButtonElement>('[data-testid="tool-remove-line"]').element.disabled).toBe(false)

    await wrapper.find('[data-testid="tool-remove-line"]').trigger('click')
    expect(wrapper.emitted('remove-selected-line')).toHaveLength(1)
  })

  it('emits select-tool with erase when the Erase button is clicked, and marks it pressed once active (ticket 89)', async () => {
    const wrapper = mountToolbox()

    await wrapper.find('[data-testid="tool-erase"]').trigger('click')
    expect(wrapper.emitted('select-tool')).toEqual([['erase']])

    await wrapper.setProps({ activeTool: 'erase' })
    expect(wrapper.find('[data-testid="tool-erase"]').attributes('aria-pressed')).toBe('true')
  })

  it("shows each numbered tool's shortcut in its tooltip (ticket 87)", () => {
    const wrapper = mountToolbox()

    expect(wrapper.find('[data-testid="tool-paint"]').attributes('title')).toContain('(1)')
    expect(wrapper.find('[data-testid="tool-fill"]').attributes('title')).toContain('(2)')
    expect(wrapper.find('[data-testid="tool-select"]').attributes('title')).toContain('(3)')
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

  it("shows Rotate's and Copy's shortcuts in their tooltips (ticket 91)", () => {
    const wrapper = mountToolbox()

    expect(wrapper.find('[data-testid="rotate-button"]').attributes('title')).toContain('(R)')
    expect(wrapper.find('[data-testid="copy-button"]').attributes('title')).toContain('Ctrl/Cmd+C')
  })

  it('puts the mirror axis counters and mirror-current controls inside the Mirror group', () => {
    const wrapper = mountToolbox()

    const mirrorGroup = wrapper.find('[data-testid="tool-group-mirror"]')
    for (const testId of ['mirror-left-right', 'mirror-top-bottom', 'mirror-current-horizontal', 'mirror-current-vertical']) {
      expect(mirrorGroup.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
  })

  it("shows every Mirror control's shortcut in its tooltip (ticket 93)", () => {
    const wrapper = mountToolbox()

    expect(wrapper.find('[data-testid="mirror-left-right-decrease"]').attributes('title')).toContain('(-)')
    expect(wrapper.find('[data-testid="mirror-left-right-increase"]').attributes('title')).toContain('(=)')
    expect(wrapper.find('[data-testid="mirror-top-bottom-decrease"]').attributes('title')).toContain('([)')
    expect(wrapper.find('[data-testid="mirror-top-bottom-increase"]').attributes('title')).toContain('(])')
    expect(wrapper.find('[data-testid="mirror-copy-mode"]').attributes('title')).toContain('(M)')
    expect(wrapper.find('[data-testid="mirror-current-horizontal"]').attributes('title')).toContain('(H)')
    expect(wrapper.find('[data-testid="mirror-current-vertical"]').attributes('title')).toContain('(V)')
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

  it('emits mirror-current with the axis that was clicked', async () => {
    const wrapper = mountToolbox()

    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('click')

    expect(wrapper.emitted('mirror-current')).toEqual([['horizontal']])
  })

  it('emits mirror-current-hover with the axis on mouseenter and null on mouseleave (ticket 47)', async () => {
    const wrapper = mountToolbox()

    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('mouseenter')
    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('mouseleave')
    await wrapper.find('[data-testid="mirror-current-vertical"]').trigger('mouseenter')

    expect(wrapper.emitted('mirror-current-hover')).toEqual([['horizontal'], [null], ['vertical']])
  })

  it('reflects the rotated state from the pattern prop', () => {
    const pattern = makePattern()
    pattern.rotated = true

    const wrapper = mountToolbox({ pattern })

    expect(wrapper.find('[data-testid="rotate-button"]').attributes('aria-pressed')).toBe('true')
  })

  it('has no Row progress controls of its own (ticket 144)', () => {
    const wrapper = mountToolbox()

    expect(wrapper.find('[data-testid="progress-bar-switch"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-direction"]').exists()).toBe(false)
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

  it('shows the copy-mode switch, its on/off state, and emits toggle-mirror-copy-mode when clicked (ticket 45)', async () => {
    const wrapper = mountToolbox({ mirrorCopyMode: false })

    const button = wrapper.find('[data-testid="mirror-copy-mode"]')
    expect(button.exists()).toBe(true)
    expect(button.attributes('aria-pressed')).toBe('false')

    await button.trigger('click')

    expect(wrapper.emitted('toggle-mirror-copy-mode')).toHaveLength(1)
  })

  it('reflects an on copy-mode state from its prop', () => {
    const wrapper = mountToolbox({ mirrorCopyMode: true })

    expect(wrapper.find('[data-testid="mirror-copy-mode"]').attributes('aria-pressed')).toBe('true')
  })

  it('shows each counter its current value', () => {
    const wrapper = mountToolbox({
      mirrorAxisCounts: { columns: 2, rows: 1 },
    })

    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="mirror-top-bottom-value"]').text()).toContain('1')
  })

  it('not rotated: Left–right drives columns, Top–bottom drives rows', async () => {
    const wrapper = mountToolbox({ mirrorAxisCounts: { columns: 1, rows: 0 } })

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
    const wrapper = mountToolbox({ pattern, mirrorAxisCounts: { columns: 3, rows: 1 } })

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

describe('Toolbox Image colors (ticket 58)', () => {
  function convertedPattern(): Pattern {
    return { ...makePattern(), imageColors: ['#ff0000', '#00ff00'] }
  }

  it('shows the open Pattern Image colors in the Colors group, alongside the Palette', () => {
    const wrapper = mountToolbox({ pattern: convertedPattern() })

    const colorsGroup = wrapper.findAll('.tool-group')[1]!
    expect(colorsGroup.find('[data-testid="palette-picker"]').exists()).toBe(true)
    expect(colorsGroup.find('[data-testid="image-colors-picker"]').exists()).toBe(true)
    expect(colorsGroup.findAll('[data-testid="image-color-swatch"]')).toHaveLength(2)
  })

  it('shows nothing for a Pattern created any other way', () => {
    const wrapper = mountToolbox()

    expect(wrapper.find('[data-testid="image-colors-picker"]').exists()).toBe(false)
  })

  it('shows nothing for a conversion that found no colors at all', () => {
    const wrapper = mountToolbox({ pattern: { ...makePattern(), imageColors: [] } })

    expect(wrapper.find('[data-testid="image-colors-picker"]').exists()).toBe(false)
  })

  it('emits select-image-color with the clicked hex', async () => {
    const wrapper = mountToolbox({ pattern: convertedPattern() })

    await wrapper.find('[data-color-hex="#00ff00"]').trigger('click')

    expect(wrapper.emitted('select-image-color')).toEqual([['#00ff00']])
  })

  it('shows which Image color is being painted with', () => {
    const wrapper = mountToolbox({ pattern: convertedPattern(), selectedImageColor: '#ff0000' })

    expect(wrapper.find('[data-color-hex="#ff0000"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-color-hex="#00ff00"]').attributes('aria-pressed')).toBe('false')
  })

  it('leaves the Custom color slot unselected while an Image color is the paint color', () => {
    const wrapper = mountToolbox({
      pattern: convertedPattern(),
      customColor: '#abcdef',
      selectedColorId: undefined,
      selectedImageColor: '#ff0000',
    })

    expect(wrapper.find('[data-testid="custom-color-input"]').attributes('aria-pressed')).toBe('false')
  })

  it('takes its own line rather than counting toward the group control cap', () => {
    const wrapper = mountToolbox({ pattern: convertedPattern() })

    expect(wrapper.find('[data-testid="tool-group-colors"] [data-testid="image-colors-picker"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tool-group-overflow"]').exists()).toBe(false)
  })
})

describe('Toolbox without Save or Export (ticket 148)', () => {
  it('leaves Save and the exports to the save box: the Edit row is Undo, Redo, Rotate and Copy', () => {
    const wrapper = mountToolbox()

    for (const testId of ['save-button', 'export-qr', 'export-png', 'export-pdf']) {
      expect(wrapper.find(`[data-testid="${testId}"]`).exists()).toBe(false)
    }
    const edit = wrapper.findAll('[data-testid="tool-group-edit"] button').map((button) => button.attributes('data-testid'))
    expect(edit).toEqual(['undo-button', 'redo-button', 'rotate-button', 'copy-button'])
  })
})

describe('Toolbox rail (ticket 114)', () => {
  it('shows every control of every Tool group without any group expanding, even with Image colors', () => {
    const wrapper = mountToolbox({
      pattern: { ...makePattern(), imageColors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'] },
    })

    expect(wrapper.findAll('[data-testid="tool-group-chevron"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="tool-group-overflow"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="palette-swatch"]').length).toBeGreaterThan(0)
    expect(wrapper.find('[data-testid="custom-color-input"]').exists()).toBe(true)
  })
})

describe('Toolbox disclosure rows (ticket 75)', () => {
  it('opens Mirror in place below its row, the chevron turning up, and sums it up as ↔ · ↕', async () => {
    const wrapper = mountToolbox({ mirrorAxisCounts: { columns: 1, rows: 0 } })
    const row = wrapper.find('[data-testid="tool-group-mirror"]')

    expect(row.find('.disclosure-row__summary').text()).toBe('↔ 1 · ↕ 0')
    expect(row.find('.disclosure-row__panel').isVisible()).toBe(false)

    await row.find('button').trigger('click')

    expect(row.find('button').attributes('aria-expanded')).toBe('true')
    expect(row.find('.disclosure-row__chevron').attributes('data-icon')).toBe('chevron-up')
  })

  it('closes an open row on Escape before anything else', async () => {
    const wrapper = mountToolbox()
    await wrapper.find('[data-testid="tool-group-size"] button').trigger('click')

    expect((wrapper.vm as unknown as { collapseExpandedGroup: () => boolean }).collapseExpandedGroup()).toBe(true)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="tool-group-size"] button').attributes('aria-expanded')).toBe('false')
    expect((wrapper.vm as unknown as { collapseExpandedGroup: () => boolean }).collapseExpandedGroup()).toBe(false)
  })

  it('sums Size up with the Estimated size', () => {
    const wrapper = mountToolbox()
    expect(wrapper.find('[data-testid="tool-group-size"] .disclosure-row__summary').text()).toMatch(/\d/)
  })
})

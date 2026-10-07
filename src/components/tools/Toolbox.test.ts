import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Toolbox from './Toolbox.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject, setRowProgressEnabled, withFrame, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'

beforeEach(() => {
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
})

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makeProject(): Project {
  return createProject({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 30, unit: 'mm' },
  })
}

function mountToolbox(overrides: Partial<InstanceType<typeof Toolbox>['$props']> = {}) {
  return mount(Toolbox, {
    props: {
      project: makeProject(),
      activeTool: 'paint',
      canUndo: false,
      canRedo: false,
      canCopy: false,
      canRemoveSelectedLine: false,
      ...overrides,
    },
  })
}

describe('Toolbox', () => {
  it('shows the input mode toggle right after the Frame tool, only when it has a mode (ticket 325)', async () => {
    expect(mountToolbox().find('[data-testid="input-mode-toggle"]').exists()).toBe(false)

    const wrapper = mountToolbox({ inputMode: 'pen' })
    const ids = wrapper.findAll('.tool-buttons button').map((button) => button.attributes('data-testid'))
    expect(ids.slice(-2)).toEqual(['tool-frame', 'input-mode-toggle'])
    const toggle = wrapper.get('[data-testid="input-mode-toggle"]')
    expect(toggle.attributes('aria-label')).toBe(ru.inputMode.penLabel)
    expect(toggle.attributes('aria-pressed')).toBe('true')

    await toggle.trigger('click')
    expect(wrapper.emitted('toggle-input-mode')).toHaveLength(1)

    await wrapper.setProps({ inputMode: 'mouse' })
    expect(wrapper.get('[data-testid="input-mode-toggle"]').attributes('aria-label')).toBe(ru.inputMode.mouseLabel)
    expect(wrapper.get('[data-testid="input-mode-toggle"]').attributes('aria-pressed')).toBe('false')
  })

  it('renders Tools, Colors and Edit as groups, then Frame as a disclosure row (tickets 75, 144, 174, 233)', () => {
    const wrapper = mountToolbox()

    const groups = wrapper.findAll('.tool-group')
    expect(groups.map((group) => group.find('.tool-group__title').text())).toEqual([
      ru.toolbox.groups.tools,
      ru.toolbox.groups.colors,
      ru.toolbox.groups.edit,
    ])
    // Frame is a disclosure row (ticket 75), closed until pressed; ticket 174 hid Mirror's pending its own redesign.
    const rows = wrapper.findAll('.disclosure-row')
    expect(rows.map((row) => row.find('.disclosure-row__label').text())).toEqual([ru.frame.title])
    expect(rows.map((row) => row.find('button').attributes('aria-expanded'))).toEqual(['false'])
  })

  it('has no Mirror group left in the UI (ticket 174, pending its own redesign)', () => {
    const wrapper = mountToolbox()

    expect(wrapper.find('[data-testid="tool-group-mirror"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(ru.toolbox.groups.mirror)
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
    expect(wrapper.find<HTMLButtonElement>('[data-testid="tool-remove-line"]').attributes('aria-disabled')).toBe('true')

    await wrapper.setProps({ canRemoveSelectedLine: true })
    expect(wrapper.find<HTMLButtonElement>('[data-testid="tool-remove-line"]').attributes('aria-disabled')).toBeUndefined()

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

  it('lights only the Frame tool while the Frame is being set (ticket 294)', () => {
    const wrapper = mountToolbox({ settingFrame: true })
    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-testid="tool-frame"]').attributes('aria-pressed')).toBe('true')
  })

  it("shows each tool's Tooltip: name, shortcut chip and, where needed, a description (ticket 251)", () => {
    const wrapper = mountToolbox()
    const tip = (tool: string) => wrapper.get(`[data-testid="tool-${tool}"]`).element.closest('.app-tooltip')!
    const chip = (tool: string) => tip(tool).querySelector('.app-tooltip__key')?.textContent
    const description = (tool: string) => tip(tool).querySelector('.app-tooltip__body')?.textContent

    expect([chip('paint'), chip('fill'), chip('select'), chip('erase'), chip('hand')]).toEqual(['1', '2', '3', '4', '5'])
    expect(description('paint')).toBe(ru.tooltips.paint)
    expect(description('fill')).toBe(ru.tooltips.fill)
    expect(description('select')).toBe(ru.tooltips.select)
    expect(description('hand')).toBe(ru.tooltips.hand)
    expect(description('erase')).toBe(ru.tooltips.erase)
    expect(tip('erase').querySelector('.app-tooltip__name')?.textContent).toBe(ru.tools.eraseLabel)
  })

  it('leaves no Toolbox button on a native title', () => {
    const wrapper = mountToolbox()
    const names = ['paint', 'fill', 'select', 'erase', 'hand']
    for (const id of [...names.map((n) => `tool-${n}`), 'undo-button', 'redo-button', 'rotate-button', 'copy-button']) {
      expect(wrapper.get(`[data-testid="${id}"]`).attributes('title')).toBeUndefined()
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

  it("shows the Edit buttons' shortcuts as chips; Shift+R rotates (tickets 91, 251)", () => {
    const wrapper = mountToolbox({ canUndo: true, canRedo: true, canCopy: true })
    const chip = (id: string) =>
      wrapper.get(`[data-testid="${id}"]`).element.closest('.app-tooltip')!.querySelector('.app-tooltip__key')?.textContent

    expect(chip('rotate-button')).toBe('Shift+R')
    expect(chip('copy-button')).toBe('Ctrl/Cmd+C')
    expect(chip('undo-button')).toBe('Ctrl/Cmd+Z')
    expect(chip('redo-button')).toBe('Ctrl/Cmd+Shift+Z')
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

  it('emits undo, rotate, copy and redo from the Edit group', async () => {
    const wrapper = mountToolbox({ canUndo: true, canRedo: true, canCopy: true })

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    await wrapper.find('[data-testid="redo-button"]').trigger('click')

    expect(wrapper.emitted('undo')).toHaveLength(1)
    expect(wrapper.emitted('rotate')).toHaveLength(1)
    expect(wrapper.emitted('copy')).toHaveLength(1)
    expect(wrapper.emitted('redo')).toHaveLength(1)
  })

  it('disables Undo, Copy and Redo purely from its own props, not internal state', () => {
    const wrapper = mountToolbox({ canUndo: false, canRedo: false, canCopy: false })

    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').attributes('aria-disabled') === 'true').toBe(true)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').attributes('aria-disabled') === 'true').toBe(true)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').attributes('aria-disabled') === 'true').toBe(true)
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
    // Mounted standalone (no provideI18n ancestor) it reads the device's saved locale, which this file sets to Russian.
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

describe('Toolbox Image colors (ticket 58)', () => {
  function convertedProject(): Project {
    return { ...makeProject(), imageColors: ['#ff0000', '#00ff00'] }
  }

  it('shows the open Project Image colors in the Colors group, alongside the Palette', async () => {
    const wrapper = mountToolbox({ project: convertedProject() })
    await wrapper.find('[data-testid="image-colors-button"]').trigger('click')

    const colorsGroup = wrapper.findAll('.tool-group')[1]!
    expect(colorsGroup.find('[data-testid="palette-picker"]').exists()).toBe(true)
    expect(colorsGroup.find('[data-testid="image-colors-picker"]').exists()).toBe(true)
    expect(colorsGroup.findAll('[data-testid="image-color-swatch"]')).toHaveLength(2)
  })

  it('shows nothing for a Project created any other way', () => {
    const wrapper = mountToolbox()

    expect(wrapper.find('[data-testid="image-colors-picker"]').exists()).toBe(false)
  })

  it('shows nothing for a conversion that found no colors at all', () => {
    const wrapper = mountToolbox({ project: { ...makeProject(), imageColors: [] } })

    expect(wrapper.find('[data-testid="image-colors-picker"]').exists()).toBe(false)
  })

  it('emits select-image-color with the clicked hex', async () => {
    const wrapper = mountToolbox({ project: convertedProject() })

    await wrapper.find('[data-testid="image-colors-button"]').trigger('click')
    await wrapper.find('[data-color-hex="#00ff00"]').trigger('click')

    expect(wrapper.emitted('select-image-color')).toEqual([['#00ff00']])
  })

  it('shows which Image color is being painted with', async () => {
    const wrapper = mountToolbox({ project: convertedProject(), selectedImageColor: '#ff0000' })
    await wrapper.find('[data-testid="image-colors-button"]').trigger('click')

    expect(wrapper.find('[data-color-hex="#ff0000"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-color-hex="#00ff00"]').attributes('aria-pressed')).toBe('false')
  })

  it('leaves the Custom color slot unselected while an Image color is the paint color', () => {
    const wrapper = mountToolbox({
      project: convertedProject(),
      customColor: '#abcdef',
      selectedColorId: undefined,
      selectedImageColor: '#ff0000',
    })

    expect(wrapper.find('[data-testid="custom-color-input"]').attributes('aria-pressed')).toBe('false')
  })

  it('takes its own line rather than counting toward the group control cap', async () => {
    const wrapper = mountToolbox({ project: convertedProject() })
    await wrapper.find('[data-testid="image-colors-button"]').trigger('click')

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
      project: { ...makeProject(), imageColors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'] },
    })

    expect(wrapper.findAll('[data-testid="tool-group-chevron"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="tool-group-overflow"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="palette-swatch"]').length).toBeGreaterThan(0)
    expect(wrapper.find('[data-testid="custom-color-input"]').exists()).toBe(true)
  })
})

describe('Toolbox disclosure rows (ticket 75)', () => {
  it('opens Frame in place below its row, the chevron turning up', async () => {
    const wrapper = mountToolbox()
    const row = wrapper.find('[data-testid="tool-group-frame"]')

    expect(row.find('.disclosure-row__panel').isVisible()).toBe(false)

    await row.find('button').trigger('click')

    expect(row.find('button').attributes('aria-expanded')).toBe('true')
    expect(row.find('.disclosure-row__chevron').attributes('data-icon')).toBe('chevron-up')
  })

  it('closes an open row on Escape before anything else', async () => {
    const wrapper = mountToolbox()
    await wrapper.find('[data-testid="tool-group-frame"] button').trigger('click')

    expect((wrapper.vm as unknown as { collapseExpandedGroup: () => boolean }).collapseExpandedGroup()).toBe(true)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="tool-group-frame"] button').attributes('aria-expanded')).toBe('false')
    expect((wrapper.vm as unknown as { collapseExpandedGroup: () => boolean }).collapseExpandedGroup()).toBe(false)
  })

  it('sums the Frame up with its number and measured size', () => {
    const wrapper = mountToolbox()
    expect(wrapper.find('[data-testid="tool-group-frame"] .disclosure-row__summary').text()).toMatch(/\d/)
    expect(wrapper.find('[data-testid="tool-group-frame"] .disclosure-row__chip').text()).toBe('1')
  })
})

describe('Toolbox Rotate (ticket 233)', () => {
  const rotate = (wrapper: ReturnType<typeof mountToolbox>) => wrapper.find('[data-testid="rotate-button"]')
  /** The disabled reason its Tooltip gives (ADR 0035). */
  const reason = (wrapper: ReturnType<typeof mountToolbox>) => rotate(wrapper).element.closest('.app-tooltip')!.querySelector('.app-tooltip__body')?.textContent

  it('is disabled and named "Rotate, Set Frame first" with no Frame', async () => {
    const { frame: _frame, ...open } = makeProject()
    const wrapper = mountToolbox({ project: open })
    expect(rotate(wrapper).attributes('aria-disabled')).toBeDefined()
    expect(rotate(wrapper).attributes('aria-label')).toBe(ru.palette.rotateButton)
    expect(reason(wrapper)).toBe(ru.tooltips.setFrameFirst)
    await rotate(wrapper).trigger('click')
    expect(wrapper.emitted('rotate')).toBeUndefined()
  })

  it('waits while Row progress is on, saying why', () => {
    const wrapper = mountToolbox({ project: setRowProgressEnabled(makeProject(), true) })
    expect(rotate(wrapper).attributes('aria-disabled')).toBeDefined()
    expect(rotate(wrapper).attributes('aria-label')).toBe(ru.palette.rotateButton)
    expect(reason(wrapper)).toBe(ru.tooltips.rowProgressLockedRotate)
  })

  it('is named "Rotate" and works with a Frame', () => {
    const wrapper = mountToolbox()
    expect(rotate(wrapper).attributes('aria-label')).toBe(ru.palette.rotateButton)
    expect(rotate(wrapper).attributes('aria-disabled')).toBeUndefined()
  })
})

describe('Toolbox Frame row (ticket 233)', () => {
  const frameRow = (wrapper: ReturnType<typeof mountToolbox>) => wrapper.find('[data-testid="tool-group-frame"]')
  const withoutFrame = (): Project => {
    const { frame: _frame, ...rest } = makeProject()
    return rest
  }

  it('reads "not set" with no Frame, and has no number to press', () => {
    const wrapper = mountToolbox({ project: withoutFrame() })
    expect(frameRow(wrapper).find('.disclosure-row__summary').text()).toBe(ru.frame.notSet)
    expect(frameRow(wrapper).find('.disclosure-row__chip').exists()).toBe(false)
  })

  it('starts Set Frame when opened with no Frame, and says what a Frame is', async () => {
    const wrapper = mountToolbox({ project: withoutFrame() })
    await frameRow(wrapper).find('button').trigger('click')
    expect(wrapper.emitted('start-frame')).toHaveLength(1)
    expect(frameRow(wrapper).find('[data-testid="frame-explainer"]').text()).toBe(ru.frame.explainer)
    expect(frameRow(wrapper).find('[data-testid="frame-remove"]').exists()).toBe(false)
  })

  it('does not start Set Frame when opened with a Frame', async () => {
    const wrapper = mountToolbox()
    await frameRow(wrapper).find('button').trigger('click')
    expect(wrapper.emitted('start-frame')).toBeUndefined()
  })

  it('names the number chip and asks to bring the Frame into view when it is pressed', async () => {
    const wrapper = mountToolbox()
    const chip = frameRow(wrapper).find('.disclosure-row__chip')
    expect(chip.attributes('aria-label')).toBe(ru.frame.numberLabel.replace('{number}', '1'))
    await chip.trigger('click')
    expect(wrapper.emitted('bring-frame')).toHaveLength(1)
    expect(wrapper.emitted('start-frame')).toBeUndefined()
  })

  it('steps the Columns and Rows, Fits to drawing and Removes the Frame', async () => {
    const wrapper = mountToolbox({ project: { ...makeProject(), beads: { 0: { 0: '#ff0000' } } } })
    const frame = makeProject().frame!
    await frameRow(wrapper).find('button').trigger('click')

    expect(frameRow(wrapper).find('[data-testid="frame-columns"]').text()).toBe(String(frame.columns))
    await frameRow(wrapper).find('[data-testid="frame-columns-increase"]').trigger('click')
    await frameRow(wrapper).find('[data-testid="frame-rows-decrease"]').trigger('click')
    await frameRow(wrapper).find('[data-testid="frame-fit"]').trigger('click')
    await frameRow(wrapper).find('[data-testid="frame-remove"]').trigger('click')

    expect(wrapper.emitted('set-frame-size')).toEqual([[frame.columns + 1, frame.rows], [frame.columns, frame.rows - 1]])
    expect(wrapper.emitted('fit-frame')).toHaveLength(1)
    expect(wrapper.emitted('remove-frame')).toHaveLength(1)
  })

  it('has a Frame tool that starts Set Frame and lights up while it is on, with Remove Frame beside it (ticket 258)', async () => {
    const wrapper = mountToolbox()
    expect(wrapper.get('[data-testid="tool-frame"]').attributes('tabindex')).toBe('-1')
    await wrapper.get('[data-testid="tool-frame"]').trigger('click')
    expect(wrapper.emitted('start-frame')).toHaveLength(1)

    await wrapper.get('[data-testid="tool-remove-frame"]').trigger('click')
    expect(wrapper.emitted('remove-frame')).toHaveLength(1)

    await wrapper.setProps({ settingFrame: true })
    expect(wrapper.get('[data-testid="tool-frame"]').attributes('tabindex')).toBe('0')
    expect(wrapper.get('[data-testid="tool-paint"]').attributes('tabindex')).toBe('-1')

    await wrapper.setProps({ project: withFrame(makeProject(), undefined) })
    expect(wrapper.get('[data-testid="tool-remove-frame"]').attributes('aria-disabled')).toBe('true')
  })

  it('keeps Remove Frame under the tiles, enabled only while there is a Frame (ticket 274)', async () => {
    const wrapper = mountToolbox({ project: withFrame(makeProject(), undefined) })
    const remove = () => wrapper.get<HTMLButtonElement>('[data-testid="tool-remove-frame"]')
    expect(remove().attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="tool-group-tools"]').element.contains(remove().element)).toBe(true)

    await wrapper.setProps({ project: makeProject() })
    expect(remove().attributes('aria-disabled')).toBeUndefined()

    await wrapper.setProps({ project: setRowProgressEnabled(makeProject(), true) })
    expect(remove().attributes('aria-disabled')).toBe('true')
  })

  it('locks the size while Row progress is on, and writes why', async () => {
    const project = setRowProgressEnabled(makeProject(), true)
    const wrapper = mountToolbox({ project })
    await frameRow(wrapper).find('button').trigger('click')

    for (const id of ['frame-columns-increase', 'frame-rows-decrease', 'frame-fit', 'frame-remove']) {
      const control = frameRow(wrapper).find(`[data-testid="${id}"]`)
      expect(control.attributes('disabled') !== undefined || control.attributes('aria-disabled') === 'true').toBe(true)
    }
    expect(frameRow(wrapper).find('[data-testid="frame-locked"]').text()).toBe(ru.size.lockedReason)
  })

  it('shows icon-only tool buttons named by their label, with key badges for single-key tools', () => {
    const wrapper = mountToolbox()
    const paint = wrapper.find('[data-testid="tool-paint"]')
    expect(paint.text()).toBe('1')
    expect(paint.attributes('aria-label')).toBeTruthy()
    const badges = wrapper.findAll('[data-testid^="tool-"] .icon-btn__key').map((badge) => badge.text())
    expect(badges).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('draws the six tools as 34px tabs with their digit in aria-keyshortcuts (tickets 274, 292)', () => {
    const wrapper = mountToolbox()
    const tiles = wrapper.findAll('.tool-buttons .icon-btn--tool')
    expect(tiles).toHaveLength(6)
    expect(tiles.map((tile) => tile.attributes('aria-keyshortcuts'))).toEqual(['1', '2', '3', '4', '5', '6'])
    // Each tab holds its 34px icon and, apart from it, only the aria-hidden key.
    for (const tile of tiles) {
      expect(tile.find('svg').attributes('style')).toContain('width: 2.125rem')
      expect(tile.find('.icon-btn__key').attributes('aria-hidden')).toBe('true')
    }
  })
})

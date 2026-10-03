import { frameGrid } from './domain/pattern'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { drawnPattern, pressBead } from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

async function createPatternViaForm(wrapper: ReturnType<typeof mount>, width: string, height: string) {
  await wrapper.find('[data-testid="bead-select"]').setValue(cubeBead.id)
  await wrapper.find('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
  await wrapper.find('[data-testid="width-input"]').setValue(width)
  await wrapper.find('[data-testid="height-input"]').setValue(height)
  await wrapper.find('form').trigger('submit')
}

/**
 * The phone New Pattern sheet's own form: with it open, the wider tiers' own (hidden but still mounted, ticket 79's
 * own note on AppDrawer) NewPatternForm is a second, earlier `form` in the DOM, so this scopes to the sheet's.
 */
async function createPatternViaPhoneSheet(wrapper: ReturnType<typeof mount>, width: string, height: string) {
  const sheet = wrapper.findAll('[data-testid="bottom-sheet"]').find((s) => s.find('[data-testid="bead-select"]').exists())!
  await sheet.get('[data-testid="bead-select"]').setValue(cubeBead.id)
  await sheet.get('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
  await sheet.get('[data-testid="width-input"]').setValue(width)
  await sheet.get('[data-testid="height-input"]').setValue(height)
  await sheet.get('form').trigger('submit')
}

describe('App at the phone tier (ticket 79)', () => {
  it('shows the pattern-management bar (not the Dock) when no Pattern is open', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="phone-pattern-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="phone-bar-new-pattern"]').exists()).toBe(true)
  })

  it('creates a Pattern from the phone pattern-management bar', async () => {
    const wrapper = mount(App)
    await wrapper.find('[data-testid="phone-bar-new-pattern"]').trigger('click')

    await createPatternViaPhoneSheet(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
    expect(drawnPattern(wrapper).frame!.columns).toBe(10)
    // After creation the Dock replaces the pattern-management bar.
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="phone-pattern-bar"]').exists()).toBe(false)
  })

  it('toggles each ToolSheet from the Dock, closing on a second press of the same button', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    for (const [dockId, expectFound] of [
      ['dock-tool', () => wrapper.find('[data-testid="sheet-tool-paint"]').exists()],
      ['dock-color', () => wrapper.find('[data-testid="bottom-sheet"] [data-testid="palette-picker"]').exists()],
      ['dock-edit', () => wrapper.find('[data-testid="sheet-paste"]').exists()],
      ['dock-frame', () => wrapper.find('[data-testid="frame-set"]').exists()],
    ] as const) {
      await wrapper.find(`[data-testid="${dockId}"]`).trigger('click')
      expect(expectFound()).toBe(true)
      await wrapper.find(`[data-testid="${dockId}"]`).trigger('click')
      expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
    }
  })

  it('sets the Frame from the Dock\'s Frame sheet, with the ContextBar holding its size, Fit to drawing and Done', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-testid="dock-frame"]').trigger('click')
    expect(wrapper.find('[data-testid="frame-columns"]').text()).toBe('10')
    await wrapper.find('[data-testid="frame-set"]').trigger('click')

    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dock-frame"]').classes()).toContain('dock__item--open')
    expect(wrapper.find('[data-testid="context-bar-frame-size"]').text()).toMatch(/^10×20/)

    await wrapper.find('[data-testid="context-bar-done-frame"]').trigger('click')
    expect(wrapper.find('[data-testid="context-bar-frame-size"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dock-frame"]').classes()).not.toContain('dock__item--open')
  })

  it('has the five tools in the Tool sheet, Hand among them', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="dock-tool"]').trigger('click')

    for (const tool of ['paint', 'fill', 'select', 'erase', 'hand']) {
      expect(wrapper.find(`[data-testid="sheet-tool-${tool}"]`).exists()).toBe(true)
    }
  })

  it('picks a tool from the Tool sheet, without auto-closing it (the active tile stays outlined, ToolSheet card)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="dock-tool"]').trigger('click')

    await wrapper.find('[data-testid="sheet-tool-erase"]').trigger('click')

    expect(wrapper.find('[data-testid="tool-erase"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="sheet-tool-erase"]').classes()).toContain('phone-sheet__tile--active')

    await wrapper.get('[data-testid="sheet-close"]').trigger('click')
    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
  })

  it('draws the Edit sheet\'s Paste button with the paste icon, not the unrelated import icon (ticket 188)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="dock-edit"]').trigger('click')

    expect(wrapper.get('[data-testid="sheet-paste"] svg').attributes('data-icon')).toBe('paste')
  })

  it('picks a Palette color from the Colour sheet and paints with it', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="dock-color"]').trigger('click')

    await wrapper.get('[data-testid="bottom-sheet"] [data-color-id="red"]').trigger('click')

    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(frameGrid(drawnPattern(wrapper))[0]![0]!.color).toBe('#e63746')
  })

  it('undoes and redoes from the phone header', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(frameGrid(drawnPattern(wrapper))[0]![0]!.color).not.toBeNull()

    await wrapper.find('[data-testid="phone-undo-button"]').trigger('click')
    expect(frameGrid(drawnPattern(wrapper))[0]![0]!.color).toBeNull()

    await wrapper.find('[data-testid="phone-redo-button"]').trigger('click')
    expect(frameGrid(drawnPattern(wrapper))[0]![0]!.color).not.toBeNull()
  })

  it('shows the Pattern sheet\'s Save box for the open Pattern', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="dock-pattern"]').trigger('click')

    const sheet = wrapper.find('[data-testid="bottom-sheet"]')
    expect(sheet.find('[data-testid="save-button"]').exists()).toBe(true)
    expect(sheet.find('[data-testid="phone-sheet-bead"]').exists()).toBe(true)
  })

  it('shows import buttons in the pattern-management bar when no Pattern is open', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="phone-bar-import-file"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="phone-bar-import-qr"]').exists()).toBe(true)
  })

  it('enables the Saved Patterns icon and opens a drawer when patterns exist', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="dock-pattern"]').trigger('click')

    const btn = wrapper.find('[data-testid="phone-saved-patterns-button"]')
    expect(btn.attributes('disabled')).toBeUndefined()
    // Its own library icon (ticket 188), not the unrelated Save Pattern icon it used to reuse.
    expect(btn.find('svg').attributes('data-icon')).toBe('library')

    await btn.trigger('click')
    // A second bottom sheet opens with the pattern list.
    const sheets = wrapper.findAll('[data-testid="bottom-sheet"]')
    expect(sheets.length).toBeGreaterThan(1)
    expect(sheets[sheets.length - 1]!.find('[data-testid="pattern-list"]').exists()).toBe(true)
  })

  it('closes both the Saved Patterns drawer and Pattern sheet on pattern select', async () => {
    const wrapper = mount(App)
    // Create two patterns so a second one can be selected.
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="dock-pattern"]').trigger('click')
    await wrapper.find('[data-testid="phone-new-pattern-button"]').trigger('click')
    await createPatternViaPhoneSheet(wrapper, '10', '10')
    // Now two patterns saved; open the pattern sheet and the saved-patterns drawer.
    await wrapper.find('[data-testid="dock-pattern"]').trigger('click')
    await wrapper.find('[data-testid="phone-saved-patterns-button"]').trigger('click')

    // The saved-patterns sheet is the last bottom-sheet rendered; scope the click to it so
    // we avoid the always-mounted (but hidden) AppDrawer PatternList in the DOM.
    const sheets = wrapper.findAll('[data-testid="bottom-sheet"]')
    const savedPatternsSheet = sheets[sheets.length - 1]!
    await savedPatternsSheet.findAll('[data-testid^="select-pattern-"]')[1]!.trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    // Both sheets should be gone.
    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
  })

  it('shows the compact import control in the Pattern sheet actions', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="dock-pattern"]').trigger('click')

    // The compact import file input should be present in the pattern sheet.
    expect(wrapper.find('[data-testid="bottom-sheet"] [data-testid="pattern-sheet-import-file"]').exists()).toBe(true)
  })
})

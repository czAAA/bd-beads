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
  it('shows the Dock even with no Pattern open, and its Pattern button reaches New Pattern', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(true)

    await wrapper.find('[data-testid="dock-pattern"]').trigger('click')
    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="phone-new-pattern-button"]').exists()).toBe(true)
  })

  it('creates a Pattern through the phone New Pattern sheet, from the Pattern sheet', async () => {
    const wrapper = mount(App)
    await wrapper.find('[data-testid="dock-pattern"]').trigger('click')
    await wrapper.find('[data-testid="phone-new-pattern-button"]').trigger('click')

    await createPatternViaPhoneSheet(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false) // both sheets closed
    expect(drawnPattern(wrapper).columns).toBe(10)
  })

  it('toggles each ToolSheet from the Dock, closing on a second press of the same button', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    for (const [dockId, expectFound] of [
      ['dock-tool', () => wrapper.find('[data-testid="sheet-tool-paint"]').exists()],
      ['dock-color', () => wrapper.find('[data-testid="bottom-sheet"] [data-testid="palette-picker"]').exists()],
      ['dock-edit', () => wrapper.find('[data-testid="sheet-paste"]').exists()],
      ['dock-mirror', () => wrapper.find('[data-testid="mirror-left-right"]').exists()],
      ['dock-size', () => wrapper.find('[data-testid="size-columns-value"]').exists()],
    ] as const) {
      await wrapper.find(`[data-testid="${dockId}"]`).trigger('click')
      expect(expectFound()).toBe(true)
      await wrapper.find(`[data-testid="${dockId}"]`).trigger('click')
      expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
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

  it('picks a Palette color from the Colour sheet and paints with it', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="dock-color"]').trigger('click')

    await wrapper.get('[data-testid="bottom-sheet"] [data-color-id="red"]').trigger('click')

    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(drawnPattern(wrapper).grid[0]![0]!.color).toBe('#e63746')
  })

  it('undoes and redoes from the phone header', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(drawnPattern(wrapper).grid[0]![0]!.color).not.toBeNull()

    await wrapper.find('[data-testid="phone-undo-button"]').trigger('click')
    expect(drawnPattern(wrapper).grid[0]![0]!.color).toBeNull()

    await wrapper.find('[data-testid="phone-redo-button"]').trigger('click')
    expect(drawnPattern(wrapper).grid[0]![0]!.color).not.toBeNull()
  })

  it('shows the Pattern sheet\'s Save box and Saved Patterns for the open Pattern', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="dock-pattern"]').trigger('click')

    const sheet = wrapper.find('[data-testid="bottom-sheet"]')
    expect(sheet.find('[data-testid="save-button"]').exists()).toBe(true)
    expect(sheet.find('[data-testid="phone-sheet-bead"]').exists()).toBe(true)
  })
})

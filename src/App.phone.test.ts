import { frameGrid } from './domain/project'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { mountWithProject, createProjectViaForm } from './testUtils/seedProject'
import { drawnProject, pressBead } from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

/**
 * The phone New Project sheet's own form: with it open, the wider tiers' own (hidden but still mounted, ticket 79's
 * own note on AppDrawer) NewProjectForm is a second, earlier `form` in the DOM, so this scopes to the sheet's.
 */
async function createProjectViaPhoneSheet(wrapper: ReturnType<typeof mount>, width: string, height: string) {
  const sheet = wrapper.findAll('[data-testid="bottom-sheet"]').find((s) => s.find('[data-testid="bead-select"]').exists())!
  await sheet.get('[data-testid="bead-select"]').setValue(cubeBead.id)
  await sheet.get('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
  await sheet.get('[data-testid="width-input"]').setValue(width)
  await sheet.get('[data-testid="height-input"]').setValue(height)
  await sheet.get('form').trigger('submit')
}

describe('App at the phone tier (ticket 79)', () => {
  it('shows the project-management bar (not the Dock) when no Project is open', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="phone-project-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="phone-bar-new-project"]').exists()).toBe(true)
  })

  it('creates a Project from the phone project-management bar', async () => {
    const wrapper = mount(App)
    await wrapper.find('[data-testid="phone-bar-new-project"]').trigger('click')

    await createProjectViaPhoneSheet(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
    expect(drawnProject(wrapper).frame!.columns).toBe(10)
    // After creation the Dock replaces the project-management bar.
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="phone-project-bar"]').exists()).toBe(false)
  })

  it('toggles each ToolSheet from the Dock, closing on a second press of the same button', async () => {
    const wrapper = await mountWithProject(15, 30)

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
    const wrapper = await mountWithProject(15, 30)

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

  it('has the five tools in the Tool sheet, Hand among them, each with its hotkey corner (ticket 275)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-tool"]').trigger('click')

    const expectedKeys: Record<string, string> = { paint: '1', fill: '2', select: '3', erase: '4', hand: '5' }
    for (const [tool, key] of Object.entries(expectedKeys)) {
      const tile = wrapper.find(`[data-testid="sheet-tool-${tool}"]`)
      expect(tile.exists()).toBe(true)
      expect(tile.get('.tool-button__key').text()).toBe(key)
    }
  })

  it('picks a tool from the Tool sheet, without auto-closing it (the active tile stays outlined, ToolSheet card)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-tool"]').trigger('click')

    await wrapper.find('[data-testid="sheet-tool-erase"]').trigger('click')

    expect(wrapper.find('[data-testid="tool-erase"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="sheet-tool-erase"]').classes()).toContain('tool-button--active')

    await wrapper.get('[data-testid="sheet-close"]').trigger('click')
    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
  })

  it('draws the Edit sheet\'s Paste button with the paste icon, not the unrelated import icon (ticket 188)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-edit"]').trigger('click')

    expect(wrapper.get('[data-testid="sheet-paste"] svg').attributes('data-icon')).toBe('paste')
  })

  it('picks a Palette color from the Colour sheet and paints with it', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-color"]').trigger('click')

    await wrapper.get('[data-testid="bottom-sheet"] [data-color-id="red"]').trigger('click')

    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).toBe('#e63746')
  })

  it('undoes and redoes from the phone header', async () => {
    const wrapper = await mountWithProject(15, 30)
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).not.toBeNull()

    await wrapper.find('[data-testid="phone-undo-button"]').trigger('click')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).toBeNull()

    await wrapper.find('[data-testid="phone-redo-button"]').trigger('click')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).not.toBeNull()
  })

  it('shows the Project sheet\'s Save box for the open Project', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-project"]').trigger('click')

    const sheet = wrapper.find('[data-testid="bottom-sheet"]')
    expect(sheet.find('[data-testid="save-button"]').exists()).toBe(true)
    expect(sheet.find('[data-testid="phone-sheet-bead"]').exists()).toBe(true)
  })

  it('shows import buttons in the project-management bar when no Project is open', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="phone-bar-import-file"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="phone-bar-import-qr"]').exists()).toBe(true)
  })

  it('enables the Saved Projects icon and opens a drawer when projects exist', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-project"]').trigger('click')

    const btn = wrapper.find('[data-testid="phone-saved-projects-button"]')
    expect(btn.attributes('disabled')).toBeUndefined()
    // Its own library icon (ticket 188), not the unrelated Save Project icon it used to reuse.
    expect(btn.find('svg').attributes('data-icon')).toBe('library')

    await btn.trigger('click')
    // A second bottom sheet opens with the project list.
    const sheets = wrapper.findAll('[data-testid="bottom-sheet"]')
    expect(sheets.length).toBeGreaterThan(1)
    expect(sheets[sheets.length - 1]!.find('[data-testid="project-list"]').exists()).toBe(true)
  })

  it('closes both the Saved Projects drawer and Project sheet on project select', async () => {
    const wrapper = mount(App)
    // Create two projects so a second one can be selected.
    await createProjectViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="dock-project"]').trigger('click')
    await wrapper.find('[data-testid="phone-new-project-button"]').trigger('click')
    await createProjectViaPhoneSheet(wrapper, '10', '10')
    // Now two projects saved; open the project sheet and the saved-projects drawer.
    await wrapper.find('[data-testid="dock-project"]').trigger('click')
    await wrapper.find('[data-testid="phone-saved-projects-button"]').trigger('click')

    // The saved-projects sheet is the last bottom-sheet rendered; scope the click to it so
    // we avoid the always-mounted (but hidden) AppDrawer ProjectList in the DOM.
    const sheets = wrapper.findAll('[data-testid="bottom-sheet"]')
    const savedProjectsSheet = sheets[sheets.length - 1]!
    await savedProjectsSheet.findAll('[data-testid^="select-project-"]')[1]!.trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    // Both sheets should be gone.
    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
  })

  it('shows the compact import control in the Project sheet actions', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-project"]').trigger('click')

    // The compact import file input should be present in the project sheet.
    expect(wrapper.find('[data-testid="bottom-sheet"] [data-testid="project-sheet-import-file"]').exists()).toBe(true)
  })

  it('changes the Canvas color from the Project sheet header and remembers it (ticket 281)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-project"]').trigger('click')

    const sheet = wrapper.get('[data-testid="bottom-sheet"]')
    const button = sheet.get('[data-testid="canvas-color-button"]')
    expect(button.attributes('aria-label')).toBe('Canvas color')
    await button.trigger('click')
    expect(sheet.findAll('[role="radio"]')).toHaveLength(5)
    await sheet.get('[data-testid="canvas-color-sage"]').trigger('click')

    expect(localStorage.getItem('bd-beads:canvas-background')).toBe('3')
  })
})

import { frameGrid } from './domain/project'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { mountWithProject, createProjectViaForm } from './testUtils/seedProject'
import { drawnProject, pressBead } from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'
import { downloadFile } from './services/fileDownload'

vi.mock('./services/fileDownload', () => ({ downloadFile: vi.fn(), sharesFromTap: () => false }))

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
  vi.mocked(downloadFile).mockClear()
})

/**
 * The phone New Project sheet's own form: with it open, the wider tiers' own (hidden but still mounted, ticket 79's
 * own note on AppDrawer) NewProjectForm is a second, earlier `form` in the DOM, so this scopes to the sheet's.
 */
async function createProjectViaPhoneSheet(wrapper: ReturnType<typeof mount>) {
  const sheet = wrapper.findAll('[data-testid="bottom-sheet"]').find((s) => s.find('[data-testid="bead-select"]').exists())!
  await sheet.get('[data-testid="bead-select"]').setValue(cubeBead.id)
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

    await createProjectViaPhoneSheet(wrapper)

    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
    expect(drawnProject(wrapper).frame).toBeUndefined() // an open canvas: its size is set in the Frame section (ticket 342)
    // After creation the Dock replaces the project-management bar.
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="phone-project-bar"]').exists()).toBe(false)
  })

  it('toggles each ToolSheet from the Dock, closing on a second press of the same button', async () => {
    const wrapper = await mountWithProject(15, 30)

    for (const [dockId, expectFound] of [
      ['dock-tool', () => wrapper.find('[data-testid="sheet-tool-paint"]').exists()],
      ['dock-color', () => wrapper.find('[data-testid="bottom-sheet"] [data-testid="palette-picker"]').exists()],
      ['dock-frame', () => wrapper.find('[data-testid="frame-set"]').exists()],
      ['dock-project', () => wrapper.find('[data-testid="phone-project-info"]').exists()],
      ['dock-menu', () => wrapper.find('[data-testid="menu-item-overview"]').exists()],
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
    expect(wrapper.find('[data-testid="dock-frame"]').classes()).toContain('icon-btn--selected')
    expect(wrapper.find('[data-testid="context-bar-frame-size"]').text()).toMatch(/^10×20/)

    await wrapper.find('[data-testid="context-bar-done-frame"]').trigger('click')
    expect(wrapper.find('[data-testid="context-bar-frame-size"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dock-frame"]').classes()).not.toContain('icon-btn--selected')
  })

  it('picks a tool from the Tool sheet and closes the sheet (ticket 397)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-tool"]').trigger('click')

    await wrapper.find('[data-testid="sheet-tool-erase"]').trigger('click')

    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
    await wrapper.find('[data-testid="dock-tool"]').trigger('click')
    expect(wrapper.find('[data-testid="sheet-tool-erase"]').classes()).toContain('icon-btn--selected')
  })

  it('closes the Colour sheet on a Palette color and on the first Custom color picked, and leaves Fill active (ticket 397)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-tool"]').trigger('click')
    await wrapper.find('[data-testid="sheet-tool-fill"]').trigger('click')

    await wrapper.find('[data-testid="dock-color"]').trigger('click')
    await wrapper.get('[data-testid="bottom-sheet"] [data-color-id="blue"]').trigger('click')
    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)

    await wrapper.find('[data-testid="dock-color"]').trigger('click')
    const input = wrapper.get('[data-testid="bottom-sheet"] [data-testid="custom-color-input"]')
    ;(input.element as HTMLInputElement).value = '#123456'
    await input.trigger('input')
    // The first pick is the answer (ticket 398): it selects, joins the Palette and closes the sheet.
    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)

    await wrapper.find('[data-testid="dock-tool"]').trigger('click')
    expect(wrapper.find('[data-testid="sheet-tool-fill"]').classes()).toContain('icon-btn--selected')
  })

  it('draws the Frame sheet\'s Paste button with the paste icon, not the unrelated import icon (ticket 188)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-frame"]').trigger('click')

    expect(wrapper.get('[data-testid="sheet-paste"] svg').attributes('data-icon')).toBe('paste')
  })

  it('changes the Technique from the Frame sheet as one Undo step (ticket 351)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-frame"]').trigger('click')
    expect(wrapper.get('[data-testid="frame-technique"] [data-value="loom"]').attributes('aria-checked')).toBe('true')

    await wrapper.get('[data-testid="frame-technique"] [data-value="peyote"]').trigger('click')

    expect(drawnProject(wrapper).technique).toBe('peyote')
    expect(wrapper.get('[data-testid="frame-technique"] [data-value="peyote"]').attributes('aria-checked')).toBe('true')
    await wrapper.get('[data-testid="zoom-pill-undo"]').trigger('click')
    expect(drawnProject(wrapper).technique).toBe('loom')
  })

  it('applies the Frame sheet\'s size once, when the sheet closes, as one Undo step (ticket 410)', async () => {
    const wrapper = await mountWithProject(15, 30)
    const original = { ...drawnProject(wrapper).frame! }
    await wrapper.find('[data-testid="dock-frame"]').trigger('click')

    await wrapper.get('[data-testid="frame-width-side"] [data-value="left"]').trigger('click')
    await wrapper.get('[data-testid="frame-columns-increase"]').trigger('click')
    await wrapper.get('[data-testid="frame-columns-increase"]').trigger('click')
    await wrapper.get('[data-testid="frame-rows-decrease"]').trigger('click')

    // The canvas and the fields follow the presses, but nothing is committed and there is nothing to undo.
    expect(drawnProject(wrapper).frame).toEqual({ ...original, column: original.column - 2, columns: original.columns + 2, rows: original.rows - 1 })
    expect(wrapper.get('[data-testid="frame-columns"]').text()).toBe(String(original.columns + 2))
    expect(wrapper.get('[data-testid="zoom-pill-undo"]').attributes('aria-disabled')).toBeDefined()

    await wrapper.find('[data-testid="dock-frame"]').trigger('click')
    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
    expect(drawnProject(wrapper).frame).toEqual({ ...original, column: original.column - 2, columns: original.columns + 2, rows: original.rows - 1 })
    expect(wrapper.get('[data-testid="zoom-pill-undo"]').attributes('aria-disabled')).toBeUndefined()

    await wrapper.get('[data-testid="zoom-pill-undo"]').trigger('click')
    expect(drawnProject(wrapper).frame).toEqual(original)
    expect(wrapper.get('[data-testid="zoom-pill-undo"]').attributes('aria-disabled')).toBeDefined()
  })

  it('applies the Frame sheet\'s size too when another sheet is opened over it (ticket 410)', async () => {
    const wrapper = await mountWithProject(15, 30)
    const original = { ...drawnProject(wrapper).frame! }
    await wrapper.find('[data-testid="dock-frame"]').trigger('click')
    await wrapper.get('[data-testid="frame-columns-increase"]').trigger('click')

    await wrapper.find('[data-testid="dock-project"]').trigger('click')

    expect(drawnProject(wrapper).frame).toEqual({ ...original, columns: original.columns + 1 })
    expect(wrapper.get('[data-testid="zoom-pill-undo"]').attributes('aria-disabled')).toBeUndefined()
  })

  it('picks a Palette color from the Colour sheet and paints with it', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-color"]').trigger('click')

    await wrapper.get('[data-testid="bottom-sheet"] [data-color-id="red"]').trigger('click')

    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).toBe('#e63746')
  })

  it('undoes and redoes from the Zoom pill, and the Frame sheet no longer holds them (tickets 295, 296)', async () => {
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.get('[data-testid="zoom-pill-undo"]').attributes('aria-disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="zoom-pill-redo"]').attributes('aria-disabled')).toBeDefined()

    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).not.toBeNull()

    await wrapper.get('[data-testid="zoom-pill-undo"]').trigger('click')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).toBeNull()
    expect(wrapper.get('[data-testid="zoom-pill-undo"]').attributes('aria-disabled')).toBeDefined()

    await wrapper.get('[data-testid="zoom-pill-redo"]').trigger('click')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).not.toBeNull()

    await wrapper.find('[data-testid="dock-frame"]').trigger('click')
    expect(wrapper.find('[data-testid="bottom-sheet"] [aria-label="Undo"]').exists()).toBe(false)
  })

  it('turns Row progress on from the Zoom pill and shows the Progress bar with it, off hides both (ticket 338)', async () => {
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.get('[data-testid="progress-bar"]').classes()).toContain('app-shell__progress--hidden')
    expect(wrapper.get('[data-testid="zoom-pill-progress"]').attributes('aria-pressed')).toBe('false')

    await wrapper.get('[data-testid="zoom-pill-progress"]').trigger('click')
    expect(wrapper.get('[data-testid="progress-bar"]').classes()).not.toContain('app-shell__progress--hidden')
    expect(wrapper.get('[data-testid="zoom-pill-progress"]').attributes('aria-pressed')).toBe('true')

    await wrapper.get('[data-testid="zoom-pill-progress"]').trigger('click')
    expect(wrapper.get('[data-testid="progress-bar"]').classes()).toContain('app-shell__progress--hidden')
    expect(wrapper.get('[data-testid="zoom-pill-progress"]').attributes('aria-pressed')).toBe('false')
  })

  it('shows the Project sheet\'s Save box for the open Project', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-project"]').trigger('click')

    const sheet = wrapper.find('[data-testid="bottom-sheet"]')
    expect(sheet.find('[data-testid="save-button"]').exists()).toBe(true)
    expect(sheet.find('[data-testid="phone-sheet-bead"]').exists()).toBe(true)
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

  it('exports a Project file and the whole library from the Saved Projects sheet (ticket 385)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-project"]').trigger('click')
    await wrapper.find('[data-testid="phone-saved-projects-button"]').trigger('click')

    // Scoped to the Saved Projects sheet, the last one rendered: the always-mounted (but hidden) AppSidebar
    // ProjectList has its own panel-expand too.
    const sheets = wrapper.findAll('[data-testid="bottom-sheet"]')
    const savedProjectsSheet = sheets[sheets.length - 1]!
    await savedProjectsSheet.find('[data-testid="panel-expand"]').trigger('click')

    await savedProjectsSheet.find('[data-testid="export-project"]').trigger('click')
    expect(downloadFile).toHaveBeenCalledWith(expect.stringMatching(/\.json$/), expect.any(String))

    vi.mocked(downloadFile).mockClear()
    await savedProjectsSheet.find('[data-testid="export-library"]').trigger('click')
    expect(downloadFile).toHaveBeenCalledWith(expect.stringMatching(/\.json$/), expect.any(String))
  })

  it('closes both the Saved Projects drawer and Project sheet on project select', async () => {
    const wrapper = mount(App)
    // Create two projects so a second one can be selected.
    await createProjectViaForm(wrapper)
    await wrapper.find('[data-testid="dock-project"]').trigger('click')
    await wrapper.find('[data-testid="phone-new-project-button"]').trigger('click')
    await createProjectViaPhoneSheet(wrapper)
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

  it('changes the Canvas color from the Project sheet header and remembers it (ticket 281)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-project"]').trigger('click')

    const sheet = wrapper.get('[data-testid="bottom-sheet"]')
    const button = sheet.get('[data-testid="canvas-color-button"]')
    expect(button.attributes('aria-label')).toBe('Canvas color')
    await button.trigger('click')
    expect(sheet.findAll('.canvas-color__swatches [role="radio"]')).toHaveLength(5)
    await sheet.get('[data-testid="canvas-color-sage"]').trigger('click')

    expect(localStorage.getItem('bd-beads:canvas-background')).toBe('3')
  })

  it('shows the open Project\'s name, size and save state in the Project sheet (ticket 295)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-project"]').trigger('click')

    const sheet = wrapper.get('[data-testid="bottom-sheet"]')
    expect(sheet.get('[data-testid="phone-project-summary"]').text()).not.toBe('')
    expect(sheet.find('[data-testid="phone-project-info"] svg').exists()).toBe(true)
    expect(sheet.find('[data-testid="phone-sheet-bead"]').exists()).toBe(true)
  })

  it('opens the Menu from the Dock with language, theme, Name on exports, Overview and the source link, and nothing about the Project (ticket 295)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="dock-menu"]').trigger('click')

    const sheet = wrapper.get('[data-testid="bottom-sheet"]')
    expect(sheet.find('[data-testid="language-switcher"]').exists()).toBe(true)
    expect(sheet.find('[data-testid="menu-item-name-on-exports-change"]').exists()).toBe(true)
    expect(sheet.get('[data-testid="menu-item-overview"]').attributes('href')).toMatch(/overview\/$/)
    expect(sheet.get('[data-testid="menu-item-source"]').attributes('href')).toContain('github.com')
    expect(sheet.find('[data-testid="menu-item-shortcuts"]').exists()).toBe(true)
    expect(sheet.find('[data-testid="save-button"]').exists()).toBe(false)
    expect(sheet.find('[data-testid="phone-project-info"]').exists()).toBe(false)
  })

})

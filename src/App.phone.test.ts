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
  localStorage.setItem('openbeads:locale', 'en')
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
  it('shows the project-management bar (not the Tool pill) when no Project is open', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="phone-project-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tool-pill"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="phone-bar-new-project"]').exists()).toBe(true)
  })

  it('has Menu alone in the strip, and none on the project-management bar, with no Project open (ticket 431)', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="phone-bar-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="strip-project"]').exists()).toBe(false)

    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-item-overview"]').exists()).toBe(true)
  })

  it('creates a Project from the phone project-management bar', async () => {
    const wrapper = mount(App)
    await wrapper.find('[data-testid="phone-bar-new-project"]').trigger('click')

    await createProjectViaPhoneSheet(wrapper)

    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
    expect(drawnProject(wrapper).frame).toBeUndefined() // a Canvas: its size is set in the Frame section (ticket 342)
    // After creation the Tool pill appears and the project-management bar goes.
    expect(wrapper.find('[data-testid="tool-pill"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="phone-project-bar"]').exists()).toBe(false)
  })

  it('toggles each ToolSheet from the Canvas strip, closing on a second press of the same button', async () => {
    const wrapper = await mountWithProject(15, 30)

    for (const [dockId, expectFound] of [
      ['strip-project', () => wrapper.find('[data-testid="phone-project-info"]').exists()],
      ['strip-menu', () => wrapper.find('[data-testid="menu-item-overview"]').exists()],
    ] as const) {
      await wrapper.find(`[data-testid="${dockId}"]`).trigger('click')
      expect(expectFound()).toBe(true)
      await wrapper.find(`[data-testid="${dockId}"]`).trigger('click')
      expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
    }
  })

  it('has no Frame slot in the Tool pill; Edit Frame starts from the Project sheet, with the ContextBar holding its size, Fit to drawing and Done (ticket 417)', async () => {
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.find('[data-testid="pill-frame"]').exists()).toBe(false)

    await wrapper.find('[data-testid="strip-project"]').trigger('click')
    await wrapper.find('[data-testid="frame-edit"]').trigger('click')

    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="edit-frame-steppers"]').exists()).toBe(true)

    await wrapper.find('[data-testid="project-surface"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[data-testid="edit-frame-steppers"]').exists()).toBe(false)
  })

  it('picks a tool straight from the Tool pill, with no sheet in between (tickets 397, 431)', async () => {
    const wrapper = await mountWithProject(15, 30)

    await wrapper.find('[data-testid="pill-tool-erase"]').trigger('click')

    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pill-tool-erase"]').classes()).toContain('icon-btn--selected')
    expect(wrapper.find('[data-testid="pill-tool"]').exists()).toBe(false)
  })

  it('closes the colour popover on a Palette color and on the first Custom color picked, and leaves Fill active (tickets 397, 439)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="pill-tool-fill"]').trigger('click')

    await wrapper.find('[data-testid="pill-color"]').trigger('click')
    await wrapper.get('[data-testid="color-popover"] [data-color-id="blue"]').trigger('click')
    expect(wrapper.find('[data-testid="color-popover"]').exists()).toBe(false)

    await wrapper.find('[data-testid="pill-color"]').trigger('click')
    const input = wrapper.get('[data-testid="color-popover"] [data-testid="custom-color-input"]')
    ;(input.element as HTMLInputElement).value = '#123456'
    await input.trigger('change')
    // The committed pick is the answer (tickets 398, 444): it selects, joins the Palette and closes the popover.
    expect(wrapper.find('[data-testid="color-popover"]').exists()).toBe(false)

    expect(wrapper.find('[data-testid="pill-tool-fill"]').classes()).toContain('icon-btn--selected')
  })

  it('keeps Rotate, Copy and Paste off the Project sheet: they are on the Selection bar (tickets 415, 416)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-project"]').trigger('click')

    expect(wrapper.find('[data-testid="sheet-paste"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sheet-copy"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sheet-rotate"]').exists()).toBe(false)
  })

  it('changes the Technique from the Project sheet as one Undo step (ticket 351)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-project"]').trigger('click')
    expect(wrapper.get('[data-testid="frame-technique"] [data-value="loom"]').attributes('aria-checked')).toBe('true')

    await wrapper.get('[data-testid="frame-technique"] [data-value="peyote"]').trigger('click')

    expect(drawnProject(wrapper).technique).toBe('peyote')
    expect(wrapper.get('[data-testid="frame-technique"] [data-value="peyote"]').attributes('aria-checked')).toBe('true')
    await wrapper.get('[data-testid="strip-undo"]').trigger('click')
    expect(drawnProject(wrapper).technique).toBe('loom')
  })

  it('picks a Palette color from the colour popover and paints with it', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="pill-color"]').trigger('click')

    await wrapper.get('[data-testid="color-popover"] [data-color-id="red"]').trigger('click')

    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).toBe('#e63746')
  })

  it('undoes and redoes from the Zoom pill, and the Project sheet does not hold them (tickets 295, 296)', async () => {
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.get('[data-testid="strip-undo"]').attributes('aria-disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="strip-redo"]').attributes('aria-disabled')).toBeDefined()

    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).not.toBeNull()

    await wrapper.get('[data-testid="strip-undo"]').trigger('click')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).toBeNull()
    expect(wrapper.get('[data-testid="strip-undo"]').attributes('aria-disabled')).toBeDefined()

    await wrapper.get('[data-testid="strip-redo"]').trigger('click')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).not.toBeNull()

    await wrapper.find('[data-testid="strip-project"]').trigger('click')
    expect(wrapper.find('[data-testid="bottom-sheet"] [aria-label="Undo"]').exists()).toBe(false)
  })

  it('always shows the Progress bar, whose Remove frame replaces the Row progress switch (tickets 411, 426)', async () => {
    const wrapper = await mountWithProject(15, 30)
    const bar = () => wrapper.get('[data-testid="progress-bar"]')
    expect(bar().classes()).not.toContain('app-shell__progress--hidden')
    expect(wrapper.find('[data-testid="progress-bar-switch"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-next"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="progress-bar-remove-frame"]').attributes('aria-disabled')).toBeUndefined()

    await wrapper.get('[data-testid="progress-bar-remove-frame"]').trigger('click')
    expect(wrapper.find('[data-testid="progress-bar-next"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="progress-bar-remove-frame"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('[data-testid="progress-bar"]').exists()).toBe(true)
  })

  it('shows the Project sheet\'s Save box for the open Project', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-project"]').trigger('click')

    const sheet = wrapper.find('[data-testid="bottom-sheet"]')
    expect(sheet.find('[data-testid="save-button"]').exists()).toBe(true)
    expect(sheet.find('[data-testid="phone-sheet-bead"]').exists()).toBe(true)
  })

  it('enables the Saved Projects icon and opens a drawer when projects exist', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-project"]').trigger('click')

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
    await wrapper.find('[data-testid="strip-project"]').trigger('click')
    await wrapper.find('[data-testid="phone-saved-projects-button"]').trigger('click')

    // Scoped to the Saved Projects sheet, the last one rendered: another ProjectList has its own panel-expand too.
    const sheets = wrapper.findAll('[data-testid="bottom-sheet"]')
    const savedProjectsSheet = sheets[sheets.length - 1]!
    await savedProjectsSheet.find('[data-testid="panel-expand"]').trigger('click')

    await savedProjectsSheet.find('[data-testid="export-project"]').trigger('click')
    await vi.waitFor(() => expect(downloadFile).toHaveBeenCalledWith(expect.stringMatching(/\.openbeads$/), expect.any(Uint8Array), 'application/json'))

    vi.mocked(downloadFile).mockClear()
    await savedProjectsSheet.find('[data-testid="export-library"]').trigger('click')
    await vi.waitFor(() => expect(downloadFile).toHaveBeenCalledWith(expect.stringMatching(/\.openbeads$/), expect.any(Uint8Array), 'application/json'))
  })

  it('closes both the Saved Projects drawer and Project sheet on project select', async () => {
    const wrapper = mount(App)
    // Create two projects so a second one can be selected.
    await createProjectViaForm(wrapper)
    await wrapper.find('[data-testid="strip-project"]').trigger('click')
    await wrapper.find('[data-testid="phone-new-project-button"]').trigger('click')
    await createProjectViaPhoneSheet(wrapper)
    // Now two projects saved; open the project sheet and the saved-projects drawer.
    await wrapper.find('[data-testid="strip-project"]').trigger('click')
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

  it('shows the open Project\'s name, size and save state in the Project sheet (ticket 295)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-project"]').trigger('click')

    const sheet = wrapper.get('[data-testid="bottom-sheet"]')
    expect(sheet.get('[data-testid="phone-project-summary"]').text()).not.toBe('')
    expect(sheet.find('[data-testid="phone-project-info"] svg').exists()).toBe(true)
    expect(sheet.find('[data-testid="phone-sheet-bead"]').exists()).toBe(true)
  })

  it('opens the Menu from the Canvas strip with language, theme, Overview and the source link, and nothing about the Project (ticket 295)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-menu"]').trigger('click')

    const sheet = wrapper.get('[data-testid="bottom-sheet"]')
    expect(sheet.find('[data-testid="language-switcher"]').exists()).toBe(true)
    expect(sheet.find('[data-testid="menu-item-name-on-exports-change"]').exists()).toBe(false)
    expect(sheet.get('[data-testid="menu-item-overview"]').attributes('href')).toMatch(/overview\/$/)
    expect(sheet.get('[data-testid="menu-item-source"]').attributes('href')).toContain('github.com')
    expect(sheet.find('[data-testid="menu-item-shortcuts"]').exists()).toBe(true)
    expect(sheet.find('[data-testid="save-button"]').exists()).toBe(false)
    expect(sheet.find('[data-testid="phone-project-info"]').exists()).toBe(false)
  })
})

import { frameGrid } from './domain/project'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { mountWithProject, createProjectViaForm } from './testUtils/seedProject'
import { drawnProject, pressBead } from './testUtils/beads'
import { chooseCustomColor } from './testUtils/pill'
import { BEAD_CATALOG } from './domain/beads'
import { downloadFile } from './services/fileDownload'
import { en } from './i18n/en'
import { chooseBead } from './testUtils/beadPicker'

vi.mock('./services/fileDownload', () => ({ downloadFile: vi.fn() }))

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  vi.mocked(downloadFile).mockClear()
})

/** The phone New Project panel's form: the wider tiers' hidden but mounted NewProjectForm (ticket 79) is an earlier
 * `form`, so scope to the panel's. */
async function createProjectViaPanel(wrapper: ReturnType<typeof mount>) {
  const panel = wrapper.get('[data-testid="panel-body"]')
  await chooseBead(panel, cubeBead.id)
  await panel.get('form').trigger('submit')
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

    await wrapper.get('[data-testid="panel-back"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-item-overview"]').exists()).toBe(true)
  })

  it('creates a Project from the phone project-management bar', async () => {
    const wrapper = mount(App)
    await wrapper.find('[data-testid="phone-bar-new-project"]').trigger('click')

    await createProjectViaPanel(wrapper)

    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    expect(drawnProject(wrapper).frame).toBeUndefined() // a Canvas: its size is set in the Frame section (ticket 342)
    // After creation the Tool pill appears and the project-management bar goes.
    expect(wrapper.find('[data-testid="tool-pill"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="phone-project-bar"]').exists()).toBe(false)
  })

  it('toggles Menu and Project from the Canvas strip, closing on a second press of the same button, and swaps them (ticket 443)', async () => {
    const wrapper = await mountWithProject(15, 30)

    for (const [dockId, expectFound] of [
      ['strip-project', () => wrapper.find('[data-testid="project-panel"]').exists()],
      ['strip-menu', () => wrapper.find('[data-testid="menu-item-overview"]').exists()],
    ] as const) {
      await wrapper.find(`[data-testid="${dockId}"]`).trigger('click')
      expect(expectFound()).toBe(true)
      await wrapper.find(`[data-testid="${dockId}"]`).trigger('click')
      expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    }

    await wrapper.find('[data-testid="strip-menu"]').trigger('click')
    await wrapper.find('[data-testid="strip-project"]').trigger('click')
    expect(wrapper.findAll('[data-testid="panel-body"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="project-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(false)
  })

  it('has no Frame slot in the Tool pill; the edit pencil sits on the Frame, with the Frame panel closed and no panel or ContextBar (tickets 417, 473)', async () => {
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.find('[data-testid="pill-frame"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-edit-frame"]').exists()).toBe(false)

    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-edit-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="frame-panel"]').exists()).toBe(false)

    await wrapper.find('[data-testid="frame-edit-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="frame-panel"]').exists()).toBe(false)
    await wrapper.find('[data-testid="strip-frame"]').trigger('click')
    expect(wrapper.find('[data-testid="frame-panel"]').exists()).toBe(true)
  })

  it('picks a tool straight from the Tool pill, with no panel in between (tickets 397, 431)', async () => {
    const wrapper = await mountWithProject(15, 30)

    await wrapper.find('[data-testid="pill-tool-erase"]').trigger('click')

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
    await chooseCustomColor(wrapper, '#123456')
    // The committed pick is the answer (tickets 398, 444): it selects, joins the Palette and closes the popover.
    expect(wrapper.find('[data-testid="color-popover"]').exists()).toBe(false)

    expect(wrapper.find('[data-testid="pill-tool-fill"]').classes()).toContain('icon-btn--selected')
  })

  it('keeps Rotate, Copy and Paste off the Project panel: they are on the Selection bar (tickets 415, 416)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-project"]').trigger('click')

    expect(wrapper.find('[data-testid="sheet-paste"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sheet-copy"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sheet-rotate"]').exists()).toBe(false)
  })

  it('changes the Technique from the one control in the Project panel as one Undo step (tickets 351, 492, 554)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-project"]').trigger('click')
    const picker = wrapper.get('[data-testid="project-technique"] button')
    expect(picker.attributes('aria-label')).toBe('Technique: Loom')
    expect(wrapper.find('[data-testid="canvas-technique-row"]').exists()).toBe(false)

    await picker.trigger('click')
    await wrapper.get('[data-testid="project-technique"] [data-value="peyote"]').trigger('click')

    expect(drawnProject(wrapper).frame?.technique).toBe('peyote')
    expect(drawnProject(wrapper).technique).toBe('loom')
    expect(wrapper.get('[data-testid="project-technique"] button').attributes('aria-label')).toBe('Technique: Peyote')
    await wrapper.get('[data-testid="strip-undo"]').trigger('click')
    expect(drawnProject(wrapper).frame?.technique).toBe('loom')
  })

  it('picks a Palette color from the colour popover and paints with it', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="pill-color"]').trigger('click')

    await wrapper.get('[data-testid="color-popover"] [data-color-id="red"]').trigger('click')

    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(frameGrid(drawnProject(wrapper))[0]![0]!.color).toBe('#e63746')
  })

  it('undoes and redoes from the Zoom pill, and the Project panel does not hold them (tickets 295, 296)', async () => {
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
    expect(wrapper.find('[data-testid="panel-body"] [aria-label="Undo"]').exists()).toBe(false)
  })

  it('always shows the Progress bar, and Remove frame on the Frame replaces the Row progress switch (tickets 411, 426, 455)', async () => {
    const wrapper = await mountWithProject(15, 30)
    const bar = () => wrapper.get('[data-testid="progress-bar"]')
    expect(bar().classes()).not.toContain('app-shell__progress--hidden')
    expect(wrapper.find('[data-testid="progress-bar-switch"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-next"]').exists()).toBe(true)
    await wrapper.get('[data-testid="frame-edit-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="frame-chrome-remove"]').attributes('aria-disabled')).toBeUndefined()

    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect(wrapper.find('[data-testid="progress-bar-next"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar"]').exists()).toBe(true)
  })

  it('shows the Project file export in the Project panel and the Picture and chart in the Frame panel', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-project"]').trigger('click')

    const panel = wrapper.find('[data-testid="panel-dropdown"]')
    expect(panel.find('[data-testid="export-project-file"]').exists()).toBe(true)
    expect(panel.find('[data-testid="export-png"]').exists()).toBe(false)

    await wrapper.find('[data-testid="strip-frame"]').trigger('click')
    expect(wrapper.find('[data-testid="panel-dropdown"] [data-testid="export-png"]').exists()).toBe(true)
  })

  it('opens the Projects library from its Menu row when projects exist', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-menu"]').trigger('click')

    const btn = wrapper.find('[data-testid="menu-saved-projects"]')
    expect(btn.attributes('aria-disabled')).toBeUndefined()
    // Its own library icon (ticket 188), not the unrelated Save Project icon it used to reuse.
    expect(btn.find('svg').attributes('data-icon')).toBe('library')
    expect(btn.text()).toContain('1')

    await btn.trigger('click')
    // Menu swaps to its Projects library subpanel.
    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="panel-sub-title"]').text()).toBe(en.projects.heading)
    expect(wrapper.find('[data-testid="panel-body"] [data-testid="project-list"]').exists()).toBe(true)
  })

  it('exports the whole library from the Projects library (ticket 385)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-menu"]').trigger('click')
    await wrapper.find('[data-testid="menu-saved-projects"]').trigger('click')

    await wrapper.get('[data-testid="panel-body"]').find('[data-testid="menu-export-all"]').trigger('click')
    await vi.waitFor(() => expect(downloadFile).toHaveBeenCalledWith(expect.stringMatching(/\.openbeads$/), expect.any(Uint8Array), 'application/json'))
  })

  it('closes the Saved Projects drawer on project select', async () => {
    const wrapper = mount(App)
    // Create two projects so a second one can be selected.
    await createProjectViaForm(wrapper)
    await wrapper.find('[data-testid="strip-menu"]').trigger('click')
    await wrapper.find('[data-testid="menu-new-project"]').trigger('click')
    await createProjectViaPanel(wrapper)
    // Now two projects saved; open Menu and the saved-projects drawer.
    await wrapper.find('[data-testid="strip-menu"]').trigger('click')
    await wrapper.find('[data-testid="menu-saved-projects"]').trigger('click')

    // Scope the click to the subpanel, avoiding the always-mounted (but hidden) AppDrawer ProjectList in the DOM.
    const savedProjectsPanel = wrapper.get('[data-testid="panel-body"]')
    await savedProjectsPanel.findAll('[data-testid^="select-project-"]')[1]!.trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    // Both panels should be gone.
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
  })

  it('shows the open Project\'s name, save state and Bead pickers of Project (tickets 295, 443)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-project"]').trigger('click')

    const panel = wrapper.get('[data-testid="panel-dropdown"]')
    expect(panel.get('[data-testid="project-name"]').text()).not.toBe('')
    expect(panel.get('[data-testid="save-state"]').text()).toBe(en.panels.project.savedLocal)
    expect(panel.find('[data-testid="save-icon"] svg').exists()).toBe(true)
    expect(panel.get('[data-testid="bead-brand"] button').text()).toBe('TOHO')
  })

  it('opens the Menu from the Canvas strip as a dropdown with language, theme, Overview and the source link, and nothing about the Project (tickets 295, 443)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="strip-menu"]').trigger('click')

    const panel = wrapper.get('[data-testid="panel-dropdown"]')
    expect(panel.find('[data-testid="language-switcher"]').exists()).toBe(true)
    expect(panel.find('[data-testid="menu-item-name-on-exports-change"]').exists()).toBe(false)
    expect(panel.get('[data-testid="menu-item-overview"]').attributes('href')).toMatch(/overview\/$/)
    expect(panel.get('[data-testid="menu-item-source"]').attributes('href')).toContain('github.com')
    expect(panel.find('[data-testid="menu-item-shortcuts"]').exists()).toBe(true)
    expect(panel.find('[data-testid="save-box"]').exists()).toBe(false)
    expect(panel.find('[data-testid="project-panel"]').exists()).toBe(false)
  })
})

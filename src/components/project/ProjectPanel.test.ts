import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'
import ProjectPanel from './ProjectPanel.vue'
import { findBead, offeredBeads } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import { replaceBead } from '../../domain/projectBead'
import { en } from '../../i18n/en'

afterEach(() => vi.unstubAllGlobals())

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 4, height: 4, unit: 'beads' } })
const base = { project, replaceCandidates: offeredBeads().filter((bead) => bead.id !== project.bead?.id), saveFailed: false, unsaved: false }

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(ProjectPanel, { props: { ...base, ...props }, attachTo: document.body })
}

describe('ProjectPanel (tickets 443, 554)', () => {
  it('has the head, then the bead, canvas, export and this project sections, in that order', () => {
    const wrapper = mountPanel()
    const order = ['project-head', 'bead-shape', 'bead-brand', 'canvas-section', 'export-project-file', 'project-duplicate', 'project-clear', 'project-delete']
    const html = wrapper.html()
    const positions = order.map((id) => html.indexOf(`data-testid="${id}"`))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(wrapper.findAll('.panel-section__label').map((label) => label.text())).toEqual(['Bead', 'Canvas', 'Export', 'This project'])
    expect(wrapper.get('[data-testid="project-delete"]').classes()).toContain('panel-item--danger')
    expect(wrapper.get('[data-testid="project-clear"]').text()).toBe(en.panels.project.clear)
    expect(wrapper.get('[data-testid="export-project-file"]').text()).toContain('.openbeads')
  })

  it('has none of what moved to the Frame panel or went away', () => {
    const wrapper = mountPanel()
    for (const gone of ['canvas-technique-row', 'frame-technique', 'size-estimate-row', 'frame-from-starter', 'project-bead-row', 'project-name-on-exports', 'frame-edit', 'frame-fit', 'frame-remove']) {
      expect(wrapper.find(`[data-testid="${gone}"]`).exists(), gone).toBe(false)
    }
    expect(wrapper.text()).not.toContain('Beads needed')
    expect(wrapper.text()).not.toContain('Estimated size')
  })

  it('shows the Bead shape and asks for the other one (ticket 508)', async () => {
    const wrapper = mountPanel()
    const shape = wrapper.get('[data-testid="bead-shape"]')
    expect(shape.get('[aria-checked="true"]').attributes('data-value')).toBe('symmetric')

    await shape.get('[data-value="real"]').trigger('click')
    expect(wrapper.emitted('set-bead-shape')).toEqual([['real']])
    await wrapper.setProps({ project: { ...project, beadShape: 'real' } })
    expect(wrapper.get('[data-testid="bead-shape"] [aria-checked="true"]').attributes('data-value')).toBe('real')
  })

  it('shows the Bead as Brand, Type and Size and asks to replace it, keeping what it can', async () => {
    const miyuki = replaceBead(project, findBead('miyuki/delica/11-0')!)
    const wrapper = mountPanel({ project: miyuki, replaceCandidates: offeredBeads().filter((bead) => bead.id !== 'miyuki/delica/11-0') })
    const names = ['bead-brand', 'bead-type', 'bead-size'].map((id) => wrapper.get(`[data-testid="${id}"] button`).attributes('aria-label'))
    expect(names).toEqual(['Brand: Miyuki', 'Type: Delica', 'Size: 11/0'])
    // Type only lists the Brand's own, Size the Type's own, in an app-drawn menu: a native select's picker swallowed
    // the pick on an iPad mini (ticket 442).
    await wrapper.get('[data-testid="bead-size"] button').trigger('click')
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="bead-size"] [role="menuitemradio"]').map((item) => item.text())).toEqual(['11/0', '15/0', '10/0', '8/0'])
    await wrapper.get('[data-testid="bead-size"] [data-value="miyuki/delica/15-0"]').trigger('click')
    expect(wrapper.emitted('replace-bead')).toEqual([['miyuki/delica/15-0']])
    // The pickers keep showing the Project's Bead until the replacement is confirmed.
    expect(wrapper.get('[data-testid="bead-size"] button').attributes('aria-label')).toBe('Size: 11/0')

    await wrapper.get('[data-testid="bead-brand"] button').trigger('click')
    await wrapper.get('[data-testid="bead-brand"] [data-value="toho"]').trigger('click')
    expect(wrapper.emitted('replace-bead')?.at(-1)).toEqual(['toho/round/11-0'])
  })

  it('says saved, unsaved or failed in a polite live region, failed with the reason and a press to try again', async () => {
    const wrapper = mountPanel()
    const state = () => wrapper.get('[data-testid="save-state"]')
    expect(state().text()).toBe(en.panels.project.savedLocal)
    expect(state().attributes('role')).toBe('status')
    expect(state().attributes('aria-live')).toBe('polite')
    expect(wrapper.find('[data-testid="save-icon"] [data-icon="save"]').exists()).toBe(true)
    expect(wrapper.find('[data-icon="cloud"]').exists()).toBe(false)

    await wrapper.setProps({ unsaved: true })
    expect(state().text()).toBe(en.panels.project.notSavedYet)
    expect(state().classes()).toContain('project-head__state--unsaved')

    await wrapper.setProps({ saveFailed: true })
    expect(state().text()).toContain('Not saved. ')
    await wrapper.get('[data-testid="save-try-again"]').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('opens the keyboard when the pencil is tapped on a touch device (ticket 520)', async () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(pointer: coarse)': true }).matchMedia)
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="project-name-edit"]').trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('[data-testid="project-name-input"]').element)
  })

  it('renames: the pencil opens a field with Save and Cancel and a counter; Enter saves', async () => {
    const wrapper = mountPanel()
    expect(wrapper.get('[data-testid="project-name-edit"]').attributes('aria-label')).toBe('Rename Moth')
    await wrapper.get('[data-testid="project-name-edit"]').trigger('click')
    const input = wrapper.get<HTMLInputElement>('[data-testid="project-name-input"]')
    expect(input.element.value).toBe('Moth')
    expect(wrapper.get('[data-testid="project-name-form"]').text()).toContain('4/40')
    expect(wrapper.find('[data-testid="project-name-save"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="project-name-cancel"]').exists()).toBe(true)

    await input.setValue('Owl')
    await wrapper.get('[data-testid="project-name-form"]').trigger('submit')
    expect(wrapper.emitted('rename')).toEqual([['Owl']])
    expect(wrapper.find('[data-testid="project-name-form"]').exists()).toBe(false)
  })

  it('refuses an empty name with "A Project needs a name." and Cancel puts the name back', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="project-name-edit"]').trigger('click')
    await wrapper.get('[data-testid="project-name-input"]').setValue('  ')
    await wrapper.get('[data-testid="project-name-form"]').trigger('submit')
    expect(wrapper.get('[data-testid="project-name-error"]').text()).toBe(en.panels.project.nameRequired)
    expect(wrapper.emitted('rename')).toBeUndefined()

    await wrapper.get('[data-testid="project-name-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="project-name-form"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="project-name"]').text()).toBe('Moth')
  })

  it('cancels a rename when the panel hears Escape', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="project-name-edit"]').trigger('click')
    await wrapper.get('[data-testid="project-name-form"]').trigger('panel-escape')
    expect(wrapper.find('[data-testid="project-name-form"]').exists()).toBe(false)
    expect(wrapper.emitted('rename')).toBeUndefined()
  })

  it('shows the maker smaller, or "Add your name for exports" with none, and saves it trimmed', async () => {
    const wrapper = mountPanel()
    expect(wrapper.get('[data-testid="project-maker-add"]').text()).toBe(en.panels.project.addMaker)
    await wrapper.get('[data-testid="project-maker-add"]').trigger('click')
    await wrapper.get('[data-testid="project-maker-input"]').setValue(' Maria ')
    await wrapper.get('[data-testid="project-maker-form"]').trigger('submit')
    expect(wrapper.emitted('save-maker-name')).toEqual([['Maria']])

    await wrapper.setProps({ project: { ...project, makerName: 'Maria' } })
    expect(wrapper.get('[data-testid="project-maker"]').text()).toBe('Maria')
    expect(wrapper.get('[data-testid="project-maker-edit"]').attributes('aria-label')).toBe(en.panels.project.changeMaker)
  })

  it('has one Technique control: it sets the Frame, or the Canvas when there is no Frame', async () => {
    const wrapper = mountPanel()
    const picker = () => wrapper.get('[data-testid="project-technique"] button')
    expect(picker().attributes('aria-label')).toBe('Technique: Loom')
    await picker().trigger('click')
    await wrapper.get('[data-testid="project-technique"] [data-value="peyote"]').trigger('click')
    expect(wrapper.emitted('set-technique')).toEqual([['peyote']])
    expect(wrapper.emitted('set-canvas-technique')).toBeUndefined()

    await wrapper.setProps({ project: { ...project, frame: undefined } })
    await picker().trigger('click')
    await wrapper.get('[data-testid="project-technique"] [data-value="brick"]').trigger('click')
    expect(wrapper.emitted('set-canvas-technique')).toEqual([['brick']])
  })

  it('locks the Technique, with the reason, once a Row progress pass is done', async () => {
    const wrapper = mountPanel({ project: { ...project, rowProgress: { direction: 'rows', currentRow: 1, currentColumn: 0 } } })
    const picker = wrapper.get('[data-testid="project-technique"] button')
    expect(picker.attributes('aria-disabled')).toBe('true')
    await picker.trigger('click')
    expect(wrapper.find('[data-testid="project-technique"] [role="menu"]').exists()).toBe(false)
  })

  it('in high contrast replaces the swatches of the canvas section with a line', async () => {
    document.documentElement.dataset.theme = 'contrast'
    try {
      await new Promise((resolve) => setTimeout(resolve))
      const wrapper = mountPanel()
      expect(wrapper.get('[data-testid="canvas-stays-white"]').text()).toBe(en.panels.project.whiteInContrast)
    } finally {
      document.documentElement.dataset.theme = 'light'
    }
  })

  it('emits Duplicate, Clear, Delete and the Project file export', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="project-duplicate"]').trigger('click')
    await wrapper.get('[data-testid="project-clear"]').trigger('click')
    await wrapper.get('[data-testid="project-delete"]').trigger('click')
    await wrapper.get('[data-testid="export-project-file"]').trigger('click')
    expect(['duplicate', 'clear', 'delete', 'export-project-file'].map((name) => wrapper.emitted(name)?.length)).toEqual([1, 1, 1, 1])
    expect(wrapper.find('[data-testid="export-png"]').exists()).toBe(false)
  })

  it('folds a section shut and shows its summary', async () => {
    localStorage.removeItem('openbeads:panel-sections-closed')
    const wrapper = mountPanel()
    const header = wrapper.findAll('.panel-section__header')[0]!
    await header.trigger('click')
    expect(header.attributes('aria-expanded')).toBe('false')
    expect(header.text()).toContain('TOHO Cube 1.5mm · symmetric')
  })
})

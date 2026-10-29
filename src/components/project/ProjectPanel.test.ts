import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'
import ProjectPanel from './ProjectPanel.vue'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { createProject } from '../../domain/createProject'
import { withBeadShape } from '../../domain/projectBead'
import { en } from '../../i18n/en'
import { frameOf } from '../../domain/layerRecord'
import { TECHNIQUES } from '../../domain/weave'
import { withLayers } from '../../testUtils/layerFields'

afterEach(() => {
  vi.unstubAllGlobals()
  useCanvasBackground().remember(1)
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 4, height: 4, unit: 'beads' } })
const base = { project, saveFailed: false, unsaved: false }

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(ProjectPanel, { props: { ...base, ...props }, attachTo: document.body })
}

describe('ProjectPanel (tickets 443, 554, 0670)', () => {
  it('has the head, then the Canvas\'s Layer settings, export and this project sections, in that order', () => {
    const wrapper = mountPanel()
    const order = ['project-head', 'canvas-technique', 'bead-shape', 'bead-brand', 'canvas-section', 'export-project-file', 'project-duplicate', 'project-clear', 'project-delete']
    const html = wrapper.html()
    const positions = order.map((id) => html.indexOf(`data-testid="${id}"`))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(wrapper.findAll('.panel-section__label').map((label) => label.text())).toEqual(['Canvas', 'Export', 'This project'])
    expect(wrapper.get('[data-testid="project-delete"]').classes()).toContain('panel-item--danger')
    expect(wrapper.get('[data-testid="project-clear"]').text()).toBe(en.panels.project.clear)
    expect(wrapper.get('[data-testid="export-project-file"]').text()).toContain('.openbeads')
  })

  it('has none of what moved to the Frame panel or went away', () => {
    const wrapper = mountPanel()
    for (const gone of ['canvas-technique-row', 'project-technique', 'frame-technique', 'size-estimate-row', 'frame-from-starter', 'project-bead-row', 'project-name-on-exports', 'frame-edit', 'frame-fit', 'frame-remove']) {
      expect(wrapper.find(`[data-testid="${gone}"]`).exists(), gone).toBe(false)
    }
    expect(wrapper.text()).not.toContain('Beads needed')
    expect(wrapper.text()).not.toContain('Estimated size')
  })

  it('sets the Canvas in its Layer settings: each ask names the Canvas (ticket 0670)', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="canvas-technique"] button').trigger('click')
    await wrapper.get('[data-testid="canvas-technique"] [data-value="peyote"]').trigger('click')
    await wrapper.get('[data-testid="bead-shape"] [data-value="real"]').trigger('click')
    await wrapper.get('[data-testid="bead-brand"] button').trigger('click')
    await wrapper.get('[data-testid="bead-brand"] [data-value="miyuki"]').trigger('click')
    await wrapper.get('[data-testid="canvas-section"] [data-testid="background-color-fog"]').trigger('click')
    expect(wrapper.emitted('set-technique')).toEqual([['canvas', 'peyote']])
    expect(wrapper.emitted('set-bead-shape')).toEqual([['canvas', 'real']])
    expect(wrapper.emitted('replace-bead')?.[0]?.[0]).toBe('canvas')
    expect(wrapper.emitted('set-background')).toEqual([['canvas', 4]])
  })

  it('shows the Canvas\'s own Weave and Bead shape under a Frame woven otherwise (ticket 0670)', () => {
    const framed = withLayers(project, { frame: { ...frameOf(project)!, technique: 'peyote' as const } })
    const wrapper = mountPanel({ project: withBeadShape(framed, 'frame', 'real') })
    expect(wrapper.get('[data-testid="canvas-technique"] button').attributes('aria-label')).toBe('Technique: Loom')
    expect(wrapper.get('[data-testid="bead-shape"] [aria-checked="true"]').attributes('data-value')).toBe('symmetric')
  })

  it('changes the Canvas\'s Technique while a Frame exists, every one offered, even once a Row progress pass is done', async () => {
    const triangle = { ...frameOf(project)!, technique: 'peyote' as const, shape: 'triangle' as const, settings: { rounds: 4 } }
    const wrapper = mountPanel({ project: withLayers(project, { frame: triangle, rowProgress: { direction: 'rows', currentRow: 1, currentColumn: 0 } }) })
    const picker = wrapper.get('[data-testid="canvas-technique"] button')
    expect(picker.attributes('aria-disabled')).toBeUndefined()
    await picker.trigger('click')
    expect(wrapper.findAll('[data-testid="canvas-technique"] [role="menuitemradio"]')).toHaveLength(TECHNIQUES.length)
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
    expect(header.text()).toContain('Loom · TOHO Cube 1.5mm')
  })
})

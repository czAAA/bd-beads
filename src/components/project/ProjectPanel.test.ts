import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProjectPanel from './ProjectPanel.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject } from '../../domain/project'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 4, height: 4, unit: 'beads' } })
const base = { project, beadName: 'TOHO Cube 1.5mm', replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(ProjectPanel, { props: { ...base, ...props }, attachTo: document.body })
}

describe('ProjectPanel (ticket 443)', () => {
  it('has the name with a pencil, then Technique, the Bead line, Canvas, Save and exports, the Name row, Duplicate and Delete', () => {
    const wrapper = mountPanel()
    const order = ['project-name', 'frame-technique', 'project-bead-row', 'canvas-section', 'save-button', 'export-png', 'export-pdf', 'export-project-file', 'project-name-on-exports', 'project-duplicate', 'project-delete']
    const html = wrapper.html()
    const positions = order.map((id) => html.indexOf(`data-testid="${id}"`))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(wrapper.get('[data-testid="project-rename"]').attributes('aria-label')).toBe('Rename Moth')
    expect(wrapper.get('[data-testid="project-bead-row"]').text()).toContain('TOHO Cube 1.5mm')
    expect(wrapper.get('[data-testid="project-delete"]').classes()).toContain('panel-item--danger')
    expect(wrapper.get('[data-testid="save-button"]').classes()).toContain('app-button--primary')
  })

  it('has no Frame Edit, Fit or Remove, and no Frame explainer', () => {
    const wrapper = mountPanel()
    for (const gone of ['frame-edit', 'frame-fit', 'frame-remove', 'frame-explainer']) expect(wrapper.find(`[data-testid="${gone}"]`).exists()).toBe(false)
  })

  it('says saved, unsaved or failed in a polite live region, failed with the reason and Try again', async () => {
    const wrapper = mountPanel()
    const state = () => wrapper.get('[data-testid="save-state"]')
    expect(state().text()).toBe(en.saveBox.savedState)
    expect(state().attributes('role')).toBe('status')
    expect(state().attributes('aria-live')).toBe('polite')
    expect(state().find('svg').attributes('data-icon')).toBe('check')

    await wrapper.setProps({ unsaved: true })
    expect(state().text()).toBe(en.panels.project.unsaved)
    expect(state().classes()).toContain('project-panel__state--unsaved')

    await wrapper.setProps({ saveFailed: true })
    expect(state().text()).toContain('Not saved. ')
    expect(state().find('svg').attributes('data-icon')).toBe('warning')
    await wrapper.get('[data-testid="save-try-again"]').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('renames: the pencil opens a field with Save and Cancel and a counter; Enter saves', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="project-rename"]').trigger('click')
    const input = wrapper.get<HTMLInputElement>('[data-testid="project-rename-input"]')
    expect(input.element.value).toBe('Moth')
    expect(wrapper.get('[data-testid="project-rename-form"]').text()).toContain('4/40')
    expect(wrapper.find('[data-testid="project-rename-save"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="project-rename-cancel"]').exists()).toBe(true)

    await input.setValue('Owl')
    await wrapper.get('[data-testid="project-rename-form"]').trigger('submit')
    expect(wrapper.emitted('rename')).toEqual([['Owl']])
    expect(wrapper.find('[data-testid="project-rename-form"]').exists()).toBe(false)
  })

  it('refuses an empty name with "A Project needs a name." and Cancel puts the heading back', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="project-rename"]').trigger('click')
    await wrapper.get('[data-testid="project-rename-input"]').setValue('  ')
    await wrapper.get('[data-testid="project-rename-form"]').trigger('submit')
    expect(wrapper.get('[data-testid="project-rename-error"]').text()).toBe(en.panels.project.nameRequired)
    expect(wrapper.emitted('rename')).toBeUndefined()

    await wrapper.get('[data-testid="project-rename-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="project-rename-form"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="project-name"]').text()).toBe('Moth')
  })

  it('cancels a rename when the panel hears Escape', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="project-rename"]').trigger('click')
    await wrapper.get('[data-testid="project-rename-form"]').trigger('panel-escape')
    expect(wrapper.find('[data-testid="project-rename-form"]').exists()).toBe(false)
    expect(wrapper.emitted('rename')).toBeUndefined()
  })

  it('in high contrast keeps only the Position marks of the Canvas section', async () => {
    document.documentElement.dataset.theme = 'contrast'
    try {
      await new Promise((resolve) => setTimeout(resolve))
      const wrapper = mountPanel()
      expect(wrapper.get('[data-testid="canvas-stays-white"]').text()).toBe(en.panels.project.whiteInContrast)
      expect(wrapper.find('[data-testid="position-marks"]').exists()).toBe(true)
    } finally {
      document.documentElement.dataset.theme = 'light'
    }
  })

  it('emits Duplicate, Delete, the exports and the Name on exports', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="project-duplicate"]').trigger('click')
    await wrapper.get('[data-testid="project-clear"]').trigger('click')
    await wrapper.get('[data-testid="project-delete"]').trigger('click')
    await wrapper.get('[data-testid="export-png"]').trigger('click')
    await wrapper.get('[data-testid="export-pdf"]').trigger('click')
    await wrapper.get('[data-testid="export-project-file"]').trigger('click')
    await wrapper.get('[data-testid="maker-name-input"]').setValue('Maria')
    await wrapper.get('[data-testid="maker-name-input"]').trigger('keydown', { key: 'Enter' })
    expect(['duplicate', 'clear', 'delete', 'export-png', 'export-pdf', 'export-project-file'].map((name) => wrapper.emitted(name)?.length)).toEqual([1, 1, 1, 1, 1, 1])
    expect(wrapper.emitted('save-maker-name')).toEqual([['Maria']])
  })
})

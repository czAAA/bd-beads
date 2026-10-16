import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaveExport from './SaveExport.vue'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const mountBox = (props: Record<string, unknown> = {}) => mount(SaveExport, { props: { hasFrame: true, ...props }, attachTo: document.body })

describe('SaveExport (ticket 443)', () => {
  it('has Save Project as the one primary button, and asks for a save', async () => {
    const wrapper = mountBox()
    const save = wrapper.get('[data-testid="save-button"]')
    expect(save.text()).toBe(en.saveBox.saveButton)
    expect(save.classes()).toContain('app-button--primary')
    await save.trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('has PNG, PDF and Project file buttons that each ask for their export', async () => {
    const wrapper = mountBox()
    expect(['export-png', 'export-pdf', 'export-project-file'].map((id) => wrapper.get(`[data-testid="${id}"]`).text())).toEqual(['PNG', 'PDF', 'Project file'])
    for (const id of ['export-png', 'export-pdf', 'export-project-file']) await wrapper.get(`[data-testid="${id}"]`).trigger('click')
    expect(['export-png', 'export-pdf', 'export-project-file'].map((name) => wrapper.emitted(name)?.length)).toEqual([1, 1, 1])
  })

  it('waits for a second PNG or PDF while one is being drawn', async () => {
    const wrapper = mountBox({ exporting: 'png' })
    await wrapper.get('[data-testid="export-png"]').trigger('click')
    expect(wrapper.emitted('export-png')).toBeUndefined()
  })

  it('with no Frame opens "Set Frame to export" from PNG and PDF, whose Fit to drawing asks for a Frame', async () => {
    const wrapper = mountBox({ hasFrame: false })
    expect(wrapper.find('[data-testid="export-png"]').exists()).toBe(false)
    await wrapper.get('[data-testid="export-png-needs-frame"]').trigger('click')
    expect(wrapper.get('[data-testid="export-needs-frame"]').text()).toContain(en.frame.exportPromptTitle)
    await wrapper.get('[data-testid="export-fit-frame"]').trigger('click')
    expect(wrapper.emitted('fit-frame')).toHaveLength(1)
  })
})

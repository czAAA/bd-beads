import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ContextBar from './ContextBar.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject, withFrame } from '../../domain/project'

const project = createProject({ technique: 'loom', beadId: BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!.id, size: { width: 15, height: 30, unit: 'mm' } })
const painted = { ...project, beads: { 0: { 0: '#ff0000' } } }
const noFrame = withFrame(project, undefined)

describe('ContextBar', () => {
  beforeEach(() => {
    localStorage.setItem('bd-beads:locale', 'en')
  })

  it('is absent with neither a Selection nor an armed paste', () => {
    const wrapper = mount(ContextBar, { props: { project, pasteArmed: false, canRemoveLine: false } })
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
  })

  it('shows the Selection\'s size, Copy, Rotate, Remove line and a clear x while it exists', async () => {
    const wrapper = mount(ContextBar, {
      props: { project, selectionSize: { columns: 3, rows: 5 }, pasteArmed: false, canRemoveLine: true },
    })

    expect(wrapper.get('[data-testid="context-bar-size"]').text()).toBe('3×5')
    expect(wrapper.get('[data-testid="context-bar-copy"]').text()).toContain('Copy')
    expect(wrapper.get('[data-testid="context-bar-rotate"]').text()).toContain('Rotate')
    expect(wrapper.get('[data-testid="context-bar-remove-line"]').text()).toContain('Remove selected row/column')
    expect(wrapper.get('[data-testid="context-bar-remove-line"]').attributes('aria-disabled')).toBeUndefined()

    await wrapper.get('[data-testid="context-bar-copy"]').trigger('click')
    expect(wrapper.emitted('copy')).toHaveLength(1)
    await wrapper.get('[data-testid="context-bar-rotate"]').trigger('click')
    expect(wrapper.emitted('rotate')).toHaveLength(1)
    await wrapper.get('[data-testid="context-bar-remove-line"]').trigger('click')
    expect(wrapper.emitted('remove-line')).toHaveLength(1)
    await wrapper.get('[data-testid="context-bar-clear"]').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('disables Remove line when the Selection is not a whole row or column', () => {
    const wrapper = mount(ContextBar, {
      props: { project, selectionSize: { columns: 3, rows: 5 }, pasteArmed: false, canRemoveLine: false },
    })
    expect(wrapper.get('[data-testid="context-bar-remove-line"]').attributes('aria-disabled')).toBe('true')
  })

  it('turns into "Tap where to paste", Rotate and Cancel once armed', async () => {
    const wrapper = mount(ContextBar, { props: { project, pasteArmed: true, canRemoveLine: false } })

    expect(wrapper.find('[data-testid="context-bar-size"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="context-bar-hint"]').text()).toBe('Tap where to paste')
    expect(wrapper.get('[data-testid="context-bar-rotate"]').text()).toContain('Rotate')
    expect(wrapper.get('[data-testid="context-bar-cancel"]').text()).toBe('Cancel')

    await wrapper.get('[data-testid="context-bar-cancel"]').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  describe('while the Frame is being set (ticket 233)', () => {
    it('shows the Frame\'s size, Fit to drawing and Done, with no Selection', async () => {
      const wrapper = mount(ContextBar, {
        props: { project: painted, settingFrame: true, frameSummary: '17×17 · 2.7 × 2.7 cm', pasteArmed: false, canRemoveLine: false },
      })

      expect(wrapper.get('[data-testid="context-bar-frame-size"]').text()).toBe('17×17 · 2.7 × 2.7 cm')
      expect(wrapper.get('[data-testid="context-bar-fit-frame"]').attributes('aria-label')).toBe('Fit to drawing')
      expect(wrapper.get('[data-testid="context-bar-done-frame"]').text()).toBe('Done')
      expect(wrapper.find('[data-testid="context-bar-copy"]').exists()).toBe(false)

      await wrapper.get('[data-testid="context-bar-fit-frame"]').trigger('click')
      await wrapper.get('[data-testid="context-bar-done-frame"]').trigger('click')
      expect(wrapper.emitted('fit-frame')).toHaveLength(1)
      expect(wrapper.emitted('done-frame')).toHaveLength(1)
    })

    it('offers Remove Frame only once a Frame is set (ticket 258)', async () => {
      const props = { project: noFrame, settingFrame: true, pasteArmed: false, canRemoveLine: false }
      expect(mount(ContextBar, { props }).find('[data-testid="context-bar-remove-frame"]').exists()).toBe(false)

      const wrapper = mount(ContextBar, { props: { ...props, project } })
      expect(wrapper.get('[data-testid="context-bar-remove-frame"]').attributes('aria-label')).toBe('Remove Frame')
      await wrapper.get('[data-testid="context-bar-remove-frame"]').trigger('click')
      expect(wrapper.emitted('remove-frame')).toHaveLength(1)
    })

    it('takes the bar over from a Selection', () => {
      const wrapper = mount(ContextBar, {
        props: { project, settingFrame: true, selectionSize: { columns: 2, rows: 2 }, pasteArmed: false, canRemoveLine: true },
      })
      expect(wrapper.find('[data-testid="context-bar-size"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="context-bar-done-frame"]').exists()).toBe(true)
    })
  })

  it('disables Rotate, and does nothing on a click, when the Frame cannot be turned', async () => {
    const wrapper = mount(ContextBar, {
      props: { project: noFrame, selectionSize: { columns: 3, rows: 5 }, pasteArmed: false, canRemoveLine: true },
    })
    const rotate = wrapper.get('[data-testid="context-bar-rotate"]')
    expect(rotate.attributes('aria-disabled')).toBe('true')
    await rotate.trigger('click')
    expect(wrapper.emitted('rotate')).toBeUndefined()
  })

  it('carries no native title: the Tooltip names a control whose label has hidden', () => {
    const wrapper = mount(ContextBar, {
      props: { project, selectionSize: { columns: 3, rows: 5 }, pasteArmed: false, canRemoveLine: true },
    })
    expect(wrapper.find('[title]').exists()).toBe(false)
  })
})

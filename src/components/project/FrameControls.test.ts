import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FrameControls from './FrameControls.vue'
import { createProject } from '../../domain/project'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

/** A 10 × 20 bead Frame of Toho Cube 1.5 mm beads: 15 × 30 mm. */
function framed() {
  return createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 20, unit: 'beads' } })
}

describe('FrameControls', () => {
  describe('Technique (ticket 351)', () => {
    it('offers loom, peyote and brick stitch, marking the one the Project uses', () => {
      const wrapper = mount(FrameControls, { props: { project: framed() } })
      const options = wrapper.findAll('[data-testid="frame-technique"] [role="radio"]')
      expect(options.map((o) => o.text())).toEqual([en.form.techniqueLoom, en.form.techniquePeyote, en.form.techniqueBrick])
      expect(options.map((o) => o.attributes('aria-checked'))).toEqual(['true', 'false', 'false'])
    })

    it('emits the Technique that is chosen', async () => {
      const wrapper = mount(FrameControls, { props: { project: framed() } })
      await wrapper.find('[data-testid="frame-technique"] [data-value="brick"]').trigger('click')
      expect(wrapper.emitted('set-technique')).toEqual([['brick']])
    })

    it('is disabled once Row progress is on and a pass is done, and does not emit (ticket 411)', async () => {
      const project = { ...framed(), rowProgress: { direction: 'rows' as const, currentRow: 1, currentColumn: 0 } }
      const wrapper = mount(FrameControls, { props: { project } })
      const group = wrapper.find('[data-testid="frame-technique"]')
      expect(group.attributes('aria-disabled')).toBe('true')
      await group.find('[data-value="peyote"]').trigger('click')
      expect(wrapper.emitted('set-technique')).toBeUndefined()
    })
  })

  it('shows the Estimated size warning as an always-visible Note, with no (i) button (ticket 328)', () => {
    const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 15, height: 15, unit: 'mm' } })
    const wrapper = mount(FrameControls, { props: { project } })

    expect(wrapper.find('[data-testid="size-estimate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="size-estimate-note"]').text()).toBe(en.size.estimateWarning)
    expect(wrapper.find('[data-testid="size-estimate-info"]').exists()).toBe(false)
  })

  it('states the Estimated size in mm for a Frame, and offers Edit Frame, Fit and Remove Frame, not the size steppers (ticket 417)', () => {
    const wrapper = mount(FrameControls, { props: { project: framed() } })

    expect(wrapper.find('[data-testid="size-estimate"]').text()).toBe('≈ 1.5 × 3.0 cm')
    expect(wrapper.find('[data-testid="frame-edit"]').text()).toBe(en.frame.editFrame)
    expect(wrapper.find('[data-testid="frame-fit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="frame-remove"]').exists()).toBe(true)
    for (const gone of ['frame-columns', 'frame-rows', 'frame-unit', 'frame-width-side', 'frame-height-side']) {
      expect(wrapper.find(`[data-testid="${gone}"]`).exists()).toBe(false)
    }
  })

  it('emits edit-frame, fit and remove from its buttons', async () => {
    const wrapper = mount(FrameControls, { props: { project: framed() } })
    await wrapper.find('[data-testid="frame-edit"]').trigger('click')
    await wrapper.find('[data-testid="frame-fit"]').trigger('click')
    await wrapper.find('[data-testid="frame-remove"]').trigger('click')
    expect(wrapper.emitted('edit-frame')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('with no Frame says what a Frame is and offers Fit alone', () => {
    const wrapper = mount(FrameControls, { props: { project: { ...framed(), frame: undefined } } })
    expect(wrapper.find('[data-testid="frame-explainer"]').text()).toBe(en.frame.explainer)
    expect(wrapper.find('[data-testid="frame-edit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-remove"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-fit"]').exists()).toBe(true)
  })

  it('does not run Edit Frame once Row progress is on and a pass is done, and says why (ticket 411)', async () => {
    const project = { ...framed(), rowProgress: { direction: 'rows' as const, currentRow: 1, currentColumn: 0 } }
    const wrapper = mount(FrameControls, { props: { project } })
    const edit = wrapper.find('[data-testid="frame-edit"]')
    expect(edit.attributes('aria-disabled')).toBe('true')
    await edit.trigger('click')
    expect(wrapper.emitted('edit-frame')).toBeUndefined()
    expect(wrapper.find('[data-testid="frame-locked"]').text()).toBe(en.size.lockedReason)
  })
})

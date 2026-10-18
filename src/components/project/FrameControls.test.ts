import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FrameControls from './FrameControls.vue'
import { createProject } from '../../domain/project'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
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

  describe('Brick block (ticket 477)', () => {
    const brick = () => createProject({ technique: 'brick', brickBlock: 3, beadId: 'toho-cube-1.5mm', size: { width: 10, height: 20, unit: 'beads' } })

    it('shows the stepper only on Brick stitch, at the Project\'s number', () => {
      expect(mount(FrameControls, { props: { project: framed() } }).find('[data-testid="frame-brick-block"]').exists()).toBe(false)
      const wrapper = mount(FrameControls, { props: { project: brick() } })
      expect(wrapper.find('[data-testid="frame-brick-block-value"]').text()).toBe('3')
    })

    it('emits the number it steps to', async () => {
      const wrapper = mount(FrameControls, { props: { project: brick() } })
      await wrapper.find('[data-testid="frame-brick-block-more"]').trigger('pointerdown')
      await wrapper.find('[data-testid="frame-brick-block-more"]').trigger('pointerup')
      expect(wrapper.emitted('set-brick-block')).toEqual([[4]])
    })

    it('is locked once Row progress is on and a pass is done, and does not emit', async () => {
      const project = { ...brick(), rowProgress: { direction: 'rows' as const, currentRow: 1, currentColumn: 0 } }
      const wrapper = mount(FrameControls, { props: { project } })
      expect(wrapper.find('[data-testid="frame-brick-block-more"]').attributes('aria-disabled')).toBe('true')
      await wrapper.find('[data-testid="frame-brick-block-more"]').trigger('pointerdown')
      await wrapper.find('[data-testid="frame-brick-block-more"]').trigger('pointerup')
      expect(wrapper.emitted('set-brick-block')).toBeUndefined()
    })
  })

  it('shows the Estimated size warning as an always-visible Note, with no (i) button (ticket 328)', () => {
    const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 15, height: 15, unit: 'mm' } })
    const wrapper = mount(FrameControls, { props: { project } })

    expect(wrapper.find('[data-testid="size-estimate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="size-estimate-note"]').text()).toBe(en.size.estimateWarning)
    expect(wrapper.find('[data-testid="size-estimate-info"]').exists()).toBe(false)
  })

  it('states the Estimated size in mm for a Frame, with no Frame buttons and no size steppers (ticket 443)', () => {
    const wrapper = mount(FrameControls, { props: { project: framed() } })

    expect(wrapper.find('[data-testid="size-estimate"]').text()).toBe('≈ 1.5 × 3.0 cm')
    for (const gone of ['frame-edit', 'frame-fit', 'frame-remove', 'frame-explainer', 'frame-columns', 'frame-rows', 'frame-unit']) {
      expect(wrapper.find(`[data-testid="${gone}"]`).exists()).toBe(false)
    }
  })

  it('says why the Technique is locked once Row progress is on and a pass is done (ticket 411)', () => {
    const project = { ...framed(), rowProgress: { direction: 'rows' as const, currentRow: 1, currentColumn: 0 } }
    const wrapper = mount(FrameControls, { props: { project } })
    expect(wrapper.find('[data-testid="frame-locked"]').text()).toBe(en.size.lockedReason)
  })
})

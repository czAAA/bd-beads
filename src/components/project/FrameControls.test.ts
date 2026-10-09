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

    it('is disabled while Row progress is on, and does not emit', async () => {
      const project = { ...framed(), rowProgress: { enabled: true, direction: 'rows' as const, currentRow: 0, currentColumn: 0 } }
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

  it('labels the size Width and Height, in beads by default, with the Estimated size in mm (ticket 342)', () => {
    const wrapper = mount(FrameControls, { props: { project: framed() } })

    expect(wrapper.text()).toContain(en.frame.widthLabel)
    expect(wrapper.text()).toContain(en.frame.heightLabel)
    expect(wrapper.text()).not.toMatch(/Columns|Rows/)
    expect(wrapper.find('[data-testid="frame-columns"]').text()).toBe('10')
    expect(wrapper.find('[data-testid="frame-rows"]').text()).toBe('20')
    expect(wrapper.find('[data-testid="size-estimate"]').text()).toBe('≈ 1.5 × 3.0 cm')
  })

  it('switches to mm: the fields show mm, a press moves one bead, and the estimate is the bead count', async () => {
    const wrapper = mount(FrameControls, { props: { project: framed() } })

    await wrapper.find('[data-testid="frame-unit"] [data-value="mm"]').trigger('click')

    expect(wrapper.find('[data-testid="frame-columns"]').text()).toBe('15')
    expect(wrapper.find('[data-testid="frame-rows"]').text()).toBe('30')
    expect(wrapper.find('[data-testid="size-estimate"]').text()).toBe('≈ 10×20 beads')

    await wrapper.find('[data-testid="frame-columns-increase"]').trigger('click')
    expect(wrapper.emitted('set-size')).toEqual([[11, 20]])
  })

  it('remembers the unit on the device, not in the Project (ticket 342)', async () => {
    const wrapper = mount(FrameControls, { props: { project: framed() } })
    await wrapper.find('[data-testid="frame-unit"] [data-value="mm"]').trigger('click')
    expect(localStorage.getItem('bd-beads:size-unit')).toBe('mm')

    const again = mount(FrameControls, { props: { project: framed() } })
    expect(again.find('[data-testid="frame-columns"]').text()).toBe('15')
  })
})

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
      const project = { ...framed(), rowProgress: { enabled: true, direction: 'rows' as const, currentRow: 1, currentColumn: 0 } }
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

  describe('the side each stepper changes the Frame from (ticket 410)', () => {
    const optionsOf = (wrapper: ReturnType<typeof mount>, testid: string) => wrapper.findAll(`[data-testid="${testid}"] [role="radio"]`)

    it('offers Left | Right before Width and Top | Bottom before Height, on Right and Bottom until chosen', () => {
      const wrapper = mount(FrameControls, { props: { project: framed() } })
      const width = optionsOf(wrapper, 'frame-width-side')
      const height = optionsOf(wrapper, 'frame-height-side')

      expect(width.map((option) => option.text())).toEqual([en.frame.sideLeft, en.frame.sideRight])
      expect(width.map((option) => option.attributes('aria-checked'))).toEqual(['false', 'true'])
      expect(height.map((option) => option.text())).toEqual([en.frame.sideTop, en.frame.sideBottom])
      expect(height.map((option) => option.attributes('aria-checked'))).toEqual(['false', 'true'])

      const order = wrapper.findAll('[data-testid="frame-width-side-row"], [data-testid="frame-columns"], [data-testid="frame-height-side-row"], [data-testid="frame-rows"]')
      expect(order.map((el) => el.attributes('data-testid'))).toEqual(['frame-width-side-row', 'frame-columns', 'frame-height-side-row', 'frame-rows'])
    })

    it('keeps the choices on the device, not in the Project, and emits nothing for them', async () => {
      const wrapper = mount(FrameControls, { props: { project: framed() } })
      await wrapper.find('[data-testid="frame-width-side"] [data-value="left"]').trigger('click')
      await wrapper.find('[data-testid="frame-height-side"] [data-value="top"]').trigger('click')

      expect(localStorage.getItem('bd-beads:frame-width-side')).toBe('left')
      expect(localStorage.getItem('bd-beads:frame-height-side')).toBe('top')
      expect(wrapper.emitted('set-size')).toBeUndefined()

      const again = mount(FrameControls, { props: { project: framed() } })
      expect(optionsOf(again, 'frame-width-side').map((option) => option.attributes('aria-checked'))).toEqual(['true', 'false'])
      expect(optionsOf(again, 'frame-height-side').map((option) => option.attributes('aria-checked'))).toEqual(['true', 'false'])
    })

    it('falls back to Right and Bottom for a saved value it does not know', () => {
      localStorage.setItem('bd-beads:frame-width-side', 'centre')
      const wrapper = mount(FrameControls, { props: { project: framed() } })
      expect(optionsOf(wrapper, 'frame-width-side').map((option) => option.attributes('aria-checked'))).toEqual(['false', 'true'])
    })

    it('is disabled once Row progress is on and a pass is done (ticket 411)', async () => {
      const project = { ...framed(), rowProgress: { enabled: true, direction: 'rows' as const, currentRow: 1, currentColumn: 0 } }
      const wrapper = mount(FrameControls, { props: { project } })
      const width = wrapper.find('[data-testid="frame-width-side"]')
      expect(width.attributes('aria-disabled')).toBe('true')
      await width.find('[data-value="left"]').trigger('click')
      expect(localStorage.getItem('bd-beads:frame-width-side')).toBeNull()
    })
  })

  it('shows the pending Frame in the fields and the estimate, and steps from it (ticket 410)', async () => {
    const project = framed()
    const wrapper = mount(FrameControls, { props: { project, pendingFrame: { ...project.frame!, columns: 14, rows: 22 } } })

    expect(wrapper.find('[data-testid="frame-columns"]').text()).toBe('14')
    expect(wrapper.find('[data-testid="frame-rows"]').text()).toBe('22')
    expect(wrapper.find('[data-testid="size-estimate"]').text()).toBe('≈ 2.1 × 3.3 cm')

    await wrapper.find('[data-testid="frame-columns-increase"]').trigger('click')
    expect(wrapper.emitted('set-size')).toEqual([[15, 22]])
  })
})

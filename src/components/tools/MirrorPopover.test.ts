import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MirrorPopover from './MirrorPopover.vue'
import { MIRROR_OFF, type MirrorSetting } from '../../domain/mirror'

const on = (axes: Partial<MirrorSetting['axes']>, counts: Partial<MirrorSetting['counts']> = {}, mode: MirrorSetting['mode'] = 'mirror'): MirrorSetting => ({
  ...MIRROR_OFF,
  mode,
  axes: { ...MIRROR_OFF.axes, ...axes },
  counts: { ...MIRROR_OFF.counts, ...counts },
})

function mountPopover(setting: MirrorSetting, limits?: { leftRight: number; topBottom: number }) {
  return mount(MirrorPopover, { props: { tile: undefined, pill: undefined, position: 'bottom', setting, ...(limits ? { limits } : {}) } })
}

describe('MirrorPopover (ticket 0703, MirrorPopover card)', () => {
  beforeEach(() => {
    localStorage.setItem('openbeads:locale', 'en')
  })

  it('is a dialog named Mirror with the Mode as a radiogroup and the two straight Axes as pressed chips', () => {
    const wrapper = mountPopover(on({ leftRight: true }))
    expect(wrapper.get('[data-testid="mirror-popover"]').attributes('role')).toBe('dialog')
    expect(wrapper.get('[data-testid="mirror-popover"]').attributes('aria-label')).toBe('Mirror')
    const mode = wrapper.get('[data-testid="mirror-mode-row"] [role="radiogroup"]')
    expect(mode.findAll('[role="radio"]').map((radio) => [radio.text(), radio.attributes('aria-checked')])).toEqual([
      ['Off', 'false'],
      ['Mirror', 'true'],
      ['Repeat', 'false'],
    ])
    expect(wrapper.get('[data-testid="mirror-axis-leftRight"]').text()).toBe('Left–right')
    expect(wrapper.get('[data-testid="mirror-axis-leftRight"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="mirror-axis-topBottom"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-testid="mirror-axis-radial"]').exists()).toBe(false)
  })

  it('emits the setting changed: a mode picked, an Axis pressed (which turns the mode on from Off), and Off keeps the Axes', async () => {
    const wrapper = mountPopover(MIRROR_OFF)
    await wrapper.get('[data-testid="mirror-axis-topBottom"]').trigger('click')
    expect(wrapper.emitted('update:setting')).toEqual([[on({ topBottom: true })]])

    await wrapper.setProps({ setting: on({ topBottom: true }) })
    await wrapper.get('[data-testid="mirror-mode-row"] [data-value="repeat"]').trigger('click')
    expect(wrapper.emitted('update:setting')!.at(-1)).toEqual([on({ topBottom: true }, {}, 'repeat')])

    await wrapper.get('[data-testid="mirror-mode-row"] [data-value="off"]').trigger('click')
    expect(wrapper.emitted('update:setting')!.at(-1)).toEqual([on({ topBottom: true }, {}, 'off')])
  })

  it('shows an Axis count Stepper per direction that is on, with a Frame only, from 1 to its beads minus 1, a count over the limit shown clamped', async () => {
    const noFrame = mountPopover(on({ leftRight: true, topBottom: true }))
    expect(noFrame.find('[data-testid="mirror-count-leftRight"]').exists()).toBe(false)

    const wrapper = mountPopover(on({ leftRight: true }, { leftRight: 9 }), { leftRight: 5, topBottom: 2 })
    expect(wrapper.find('[data-testid="mirror-count-topBottom"]').exists()).toBe(false)
    const row = wrapper.get('[data-testid="mirror-count-leftRight"]')
    expect(row.text()).toContain('Left–right axes')
    expect(row.get('[data-testid="mirror-count-leftRight-value"]').text()).toBe('5')
    expect(row.get('[data-testid="mirror-count-leftRight-more"]').attributes('disabled')).toBeDefined()
    expect(row.get('[data-testid="mirror-count-leftRight-fewer"]').attributes('aria-label')).toBe('Fewer axes')
    await row.get('[data-testid="mirror-count-leftRight-fewer"]').trigger('click')
    expect(wrapper.emitted('update:setting')!.at(-1)).toEqual([on({ leftRight: true }, { leftRight: 4 })])
  })

  it('notes that an Axis is needed while the mode is on and none is, and closes from its Close', async () => {
    const wrapper = mountPopover(on({}))
    expect(wrapper.get('[data-testid="mirror-no-axis-note"]').text()).toBe('Turn an Axis on.')
    await wrapper.get('[data-testid="mirror-popover-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(mountPopover(MIRROR_OFF).find('[data-testid="mirror-no-axis-note"]').exists()).toBe(false)
  })
})

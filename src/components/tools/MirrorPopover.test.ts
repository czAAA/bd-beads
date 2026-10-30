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

  it('is a dialog named Mirror with the Mode as a radiogroup and the three Axes as pressed chips', () => {
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
    expect(wrapper.get('[data-testid="mirror-axis-radial"]').text()).toBe('Radial')
    expect(wrapper.get('[data-testid="mirror-axis-radial"]').attributes('aria-pressed')).toBe('false')
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

  it('on the open Canvas with a straight Axis on, notes that the handle is the setting, or in Repeat that an area is needed, in place of the count Steppers (ticket 0704)', () => {
    const mirror = mount(MirrorPopover, { props: { tile: undefined, pill: undefined, position: 'bottom', setting: on({ leftRight: true }), onCanvas: true } })
    expect(mirror.get('[data-testid="mirror-canvas-note"]').text()).toBe('Drag the handle on the axis to move it.')
    expect(mirror.find('[data-testid="mirror-count-leftRight"]').exists()).toBe(false)

    const repeat = mount(MirrorPopover, { props: { tile: undefined, pill: undefined, position: 'bottom', setting: on({ topBottom: true }, {}, 'repeat'), onCanvas: true } })
    expect(repeat.get('[data-testid="mirror-canvas-note"]').text()).toBe('Repeat on the Canvas needs an area.')

    expect(mount(MirrorPopover, { props: { tile: undefined, pill: undefined, position: 'bottom', setting: on({}), onCanvas: true } }).find('[data-testid="mirror-canvas-note"]').exists()).toBe(false)
    expect(mountPopover(on({ leftRight: true }), { leftRight: 3, topBottom: 3 }).find('[data-testid="mirror-canvas-note"]').exists()).toBe(false)
  })

  it('shows the Radial chip, exclusive with the straight Axes, and with Radial on a grid the Fold Stepper 2 to 8 with a Note saying the rule in force (ticket 0705)', async () => {
    const wrapper = mountPopover(on({ leftRight: true }), { leftRight: 5, topBottom: 2 })
    expect(wrapper.find('[data-testid="mirror-fold"]').exists()).toBe(false)
    await wrapper.get('[data-testid="mirror-axis-radial"]').trigger('click')
    const radial = wrapper.emitted('update:setting')!.at(-1)![0] as MirrorSetting
    expect(radial.axes).toEqual({ leftRight: false, topBottom: false, radial: true })

    await wrapper.setProps({ setting: radial })
    expect(wrapper.get('[data-testid="mirror-axis-radial"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="mirror-axis-leftRight"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-testid="mirror-count-leftRight"]').exists()).toBe(false)
    const fold = wrapper.get('[data-testid="mirror-fold"]')
    expect(fold.text()).toContain('Fold')
    expect(fold.get('[data-testid="mirror-fold-value"]').text()).toBe('2')
    expect(fold.get('[data-testid="mirror-fold-fewer"]').attributes('disabled')).toBeDefined()
    expect(fold.get('[data-testid="mirror-fold-fewer"]').attributes('aria-label')).toBe('Fewer folds')
    expect(fold.get('[data-testid="mirror-fold-more"]').attributes('aria-label')).toBe('More folds')
    expect(wrapper.get('[data-testid="mirror-fold-note"]').text()).toBe('An exact turn of the grid, by row and column.')
    await fold.get('[data-testid="mirror-fold-more"]').trigger('click')
    expect((wrapper.emitted('update:setting')!.at(-1)![0] as MirrorSetting).fold).toBe(3)

    await wrapper.setProps({ setting: { ...radial, fold: 6 } })
    expect(wrapper.get('[data-testid="mirror-fold-note"]').text()).toBe('A turn of 60°: each bead\'s centre turns and the nearest bead takes it, so near the centre images merge.')
    await wrapper.setProps({ setting: { ...radial, fold: 8 } })
    expect(wrapper.get('[data-testid="mirror-fold-more"]').attributes('disabled')).toBeDefined()
  })

  it('shows the Fold Stepper on the open Canvas too, with no handle Note, and not on a Custom frame (ticket 0706 gives it a Note)', () => {
    const radial = on({ radial: true })
    const canvas = mount(MirrorPopover, { props: { tile: undefined, pill: undefined, position: 'bottom', setting: radial, onCanvas: true } })
    expect(canvas.find('[data-testid="mirror-fold"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="mirror-canvas-note"]').exists()).toBe(false)
    expect(mountPopover(radial).find('[data-testid="mirror-fold"]').exists()).toBe(false)
  })
})

describe('the Area row (ticket 0710, MirrorPopover card)', () => {
  const area = { row: 1, column: 2, rows: 5, columns: 10 }
  const mountArea = (props: Record<string, unknown>) => mount(MirrorPopover, { props: { tile: undefined, pill: undefined, position: 'bottom', setting: on({ leftRight: true }), ...props } })

  it('with a Frame and no Area offers Select area and Whole Frame under the Note, no Clear, and emits the pick and the whole Frame', async () => {
    const wrapper = mountArea({ areaRow: 'frame' })
    const row = wrapper.get('[data-testid="mirror-area-row"]')
    expect(row.text()).toContain('Area')
    const select = row.get('[data-testid="mirror-select-area"]')
    expect(select.text()).toBe('Select area')
    expect(select.attributes('aria-pressed')).toBe('false')
    expect(row.get('[data-testid="mirror-whole-frame"]').text()).toBe('Whole Frame')
    expect(row.find('[data-testid="mirror-clear-area"]').exists()).toBe(false)
    expect(row.get('[data-testid="mirror-area-note"]').text()).toBe('The Axes run through the whole Frame. Select an area to mirror inside part of it; a click on the keep-out margin takes the whole Frame.')
    await select.trigger('click')
    expect(wrapper.emitted('pick')).toHaveLength(1)
    await row.get('[data-testid="mirror-whole-frame"]').trigger('click')
    expect(wrapper.emitted('whole-frame')).toHaveLength(1)
  })

  it('on the open Canvas has no Whole Frame and the Canvas Note; on a Custom frame the row is not shown', () => {
    const canvas = mountArea({ areaRow: 'canvas', onCanvas: true })
    expect(canvas.find('[data-testid="mirror-whole-frame"]').exists()).toBe(false)
    expect(canvas.get('[data-testid="mirror-area-note"]').text()).toBe('The Axes run across the whole Canvas. Select an area to mirror inside it, as in a Frame.')
    expect(mountArea({}).find('[data-testid="mirror-area-row"]').exists()).toBe(false)
  })

  it('while picking the button is pressed and says to drag', () => {
    const select = mountArea({ areaRow: 'frame', picking: true }).get('[data-testid="mirror-select-area"]')
    expect(select.attributes('aria-pressed')).toBe('true')
    expect(select.text()).toBe('Drag on the canvas…')
  })

  it('with an Area set reads its size in the Selection colour, offers Clear the area, notes that the Axes run inside it, and on the Canvas shows the count Steppers in place of the handle Note', async () => {
    const wrapper = mountArea({ areaRow: 'canvas', onCanvas: true, area, limits: { leftRight: 9, topBottom: 4 } })
    const select = wrapper.get('[data-testid="mirror-select-area"]')
    expect(select.text()).toBe('10 × 5 beads')
    expect(select.classes()).toContain('mirror-popover__area--set')
    expect(wrapper.get('[data-testid="mirror-area-note"]').text()).toBe('The Axes run inside the area. Drawing outside it is not mirrored.')
    expect(wrapper.get('[data-testid="mirror-count-leftRight-value"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="mirror-canvas-note"]').exists()).toBe(false)
    await wrapper.get('[data-testid="mirror-clear-area"]').trigger('click')
    expect(wrapper.emitted('clear-area')).toHaveLength(1)
  })
})

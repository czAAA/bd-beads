import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'

// Rich Mirror (ticket 44) is a build-time flag (src/featureFlags.ts), off by default in the test env (`.env`, same
// as production). Mocking the module -- rather than relying on `.env.test` -- keeps this one file exercising the
// flag-on path deliberately and explicitly, alongside App.test.ts's unmodified flag-off coverage.
vi.mock('./featureFlags', () => ({ isRichMirrorEnabled: () => true }))

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

async function createPatternViaForm(wrapper: ReturnType<typeof mount>, width: string, height: string) {
  await wrapper.find('[data-testid="bead-select"]').setValue(cubeBead.id)
  await wrapper.find('[data-testid="width-input"]').setValue(width)
  await wrapper.find('[data-testid="height-input"]').setValue(height)
  await wrapper.find('form').trigger('submit')
}

beforeEach(() => {
  localStorage.clear()
})

describe('App with the rich Mirror flag on (ticket 44)', () => {
  it('shows axis counters instead of the on/off toggles in the Mirror group', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="mirror-left-right"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mirror-top-bottom"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mirror-horizontal"]').exists()).toBe(false)
  })

  it('draws no axis lines and mirrors nothing while both counts are 0', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10x20

    expect(wrapper.findAll('[data-testid="mirror-axis-line-column"]')).toHaveLength(0)

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown') // paint (0,0)

    expect(wrapper.findAll('[data-testid="grid-cell"]').filter((cell) => !!cell.attributes('style')?.includes('background-color'))).toHaveLength(1)
  })

  it('1 left-right axis draws one axis line and mirrors across the center exactly like the legacy toggle', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns, 20 rows

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')

    expect(wrapper.findAll('[data-testid="mirror-axis-line-column"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('1')

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('mousedown') // paint (0,0), 10 columns wide -> mirrors to (0,9)

    const painted = cells.filter((cell) => cell.attributes('style')?.includes('background-color'))
    expect(painted).toHaveLength(2)
  })

  it('still shows the Mirror current buttons, unchanged', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="mirror-current-horizontal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mirror-current-vertical"]').exists()).toBe(true)
  })

  it('resets axis counts to 0 when switching Patterns', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('1')

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('0')
  })

  it('rotating swaps which counter reads which grid axis, without touching the grid', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns, 20 rows

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="mirror-top-bottom-value"]').text()).toContain('0')

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    // Same underlying columns-count (1) now reads as Top–bottom, since the picture turned 90°.
    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('0')
    expect(wrapper.find('[data-testid="mirror-top-bottom-value"]').text()).toContain('1')
  })
})

describe("App's Mirror copy mode (ticket 45)", () => {
  it('shows its on/off state and switches strips from mirror-image to plain-repeat when turned on', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click') // 1 axis, 2 strips of 5

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    const paintedColumns = () =>
      cells
        .map((cell, index) => ({ index, painted: cell.attributes('style')?.includes('background-color') }))
        .filter((cell) => cell.painted)
        .map((cell) => cell.index)

    await cells[0]!.trigger('mousedown') // paint (0,0)
    await wrapper.trigger('mouseup') // ends the stroke, so it becomes one undo step
    expect(paintedColumns()).toEqual([0, 9]) // mirror-image by default: 0 <-> 9

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    const copyModeButton = wrapper.find('[data-testid="mirror-copy-mode"]')
    expect(copyModeButton.attributes('aria-pressed')).toBe('false')
    await copyModeButton.trigger('click')
    expect(copyModeButton.attributes('aria-pressed')).toBe('true')

    await cells[0]!.trigger('mousedown') // paint (0,0) again, now in copy mode
    expect(paintedColumns()).toEqual([0, 5]) // plain repeat: same relative cell in the other strip, 0 <-> 5
  })

  it('resets to off when switching Patterns', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-testid="mirror-copy-mode"]').trigger('click')
    expect(wrapper.find('[data-testid="mirror-copy-mode"]').attributes('aria-pressed')).toBe('true')

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="mirror-copy-mode"]').attributes('aria-pressed')).toBe('false')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ToolPill from './ToolPill.vue'

const TOOL_IDS = ['paint', 'fill', 'select', 'piece', 'erase', 'hand']

const base = { activeTool: 'paint', position: 'bottom', colorMode: 'one', recentsInPill: [], recentsInPopover: [], popoverOpen: false, colorHex: '#e63746', colorName: 'Red' } as const

describe('ToolPill (ticket 439)', () => {
  afterEach(() => vi.restoreAllMocks())

  beforeEach(() => {
    localStorage.setItem('openbeads:locale', 'en')
  })

  it('is a toolbar named Tools with the grip first, then the six tools, a divider and the colour control', () => {
    const wrapper = mount(ToolPill, { props: base })
    const pill = wrapper.get('[data-testid="tool-pill"]')
    expect(pill.attributes('role')).toBe('toolbar')
    expect(pill.attributes('aria-label')).toBe('Tools')
    expect(wrapper.findAll('button').map((button) => button.attributes('data-testid'))).toEqual([
      'tool-pill-grip',
      ...TOOL_IDS.map((id) => `pill-tool-${id}`),
      'pill-color',
    ])
    expect(wrapper.findAll('.tool-pill__divider')).toHaveLength(1)
  })

  it('shows a Paste tile right after Hand only while the clipboard holds something, lit in paste mode (ticket 447)', async () => {
    expect(mount(ToolPill, { props: base }).find('[data-testid="pill-tool-paste"]').exists()).toBe(false)

    const wrapper = mount(ToolPill, { props: { ...base, hasClipboard: true } })
    const ids = wrapper.findAll('button').map((button) => button.attributes('data-testid'))
    expect(ids.indexOf('pill-tool-paste')).toBe(ids.indexOf('pill-tool-hand') + 1)
    const paste = wrapper.get('[data-testid="pill-tool-paste"]')
    expect(paste.attributes('aria-label')).toBe('Paste')
    expect(paste.get('.icon-btn__key').text()).toBe('7')
    expect(paste.attributes('aria-pressed')).toBe('false')
    await paste.trigger('click')
    expect(wrapper.emitted('paste-mode')).toHaveLength(1)
    expect(wrapper.emitted('select-tool')).toBeUndefined()

    await wrapper.setProps({ activeTool: 'select', pasteArmed: true })
    expect(wrapper.get('[data-testid="pill-tool-paste"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="pill-tool-select"]').attributes('aria-pressed')).toBe('false')
  })

  it('shows each tool\'s name and hotkey, lights the active one in the accent and emits the tool picked', async () => {
    const wrapper = mount(ToolPill, { props: { ...base, activeTool: 'fill' } })
    const fill = wrapper.get('[data-testid="pill-tool-fill"]')
    expect(fill.attributes('aria-label')).toBe('Fill')
    expect(fill.get('.icon-btn__key').text()).toBe('2')
    expect(fill.attributes('aria-pressed')).toBe('true')
    expect(fill.classes()).toContain('icon-btn--accent')
    expect(wrapper.get('[data-testid="pill-tool-paint"]').classes()).not.toContain('icon-btn--accent')

    for (const id of TOOL_IDS) await wrapper.get(`[data-testid="pill-tool-${id}"]`).trigger('click')
    expect(wrapper.emitted('select-tool')).toEqual(TOOL_IDS.map((id) => [id]))
  })

  it('goes vertical on the left and right, and docks to the position it is given', async () => {
    const wrapper = mount(ToolPill, { props: base })
    const pill = wrapper.get('[data-testid="tool-pill"]')
    expect(pill.attributes('aria-orientation')).toBe('horizontal')
    for (const [position, vertical] of [['left', true], ['top', false], ['right', true], ['bottom', false]] as const) {
      await wrapper.setProps({ position })
      expect(pill.attributes('data-position')).toBe(position)
      expect(pill.classes().includes('tool-pill--vertical')).toBe(vertical)
      expect(pill.attributes('aria-orientation')).toBe(vertical ? 'vertical' : 'horizontal')
    }
  })

  it('names the colour tile "Color, <name>", flags it expanded and toggles the popover', async () => {
    const wrapper = mount(ToolPill, { props: base })
    const tile = wrapper.get('[data-testid="pill-color"]')
    expect(tile.attributes('aria-label')).toBe('Color, Red')
    expect(tile.attributes('aria-expanded')).toBe('false')
    expect(tile.find('.icon-btn__key').exists()).toBe(false)
    await tile.trigger('click')
    expect(wrapper.emitted('update:popoverOpen')).toEqual([[true]])

    await wrapper.setProps({ popoverOpen: true })
    expect(wrapper.get('[data-testid="pill-color"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[data-testid="color-popover"]').exists()).toBe(true)
  })

  it('shows three recents in Recent colors mode, and a recent picks its colour at once', async () => {
    const wrapper = mount(ToolPill, { props: { ...base, colorMode: 'recent', recentsInPill: ['#111111', '#222222', '#333333'] } })
    const recents = wrapper.findAll('[data-testid="pill-recent"]')
    expect(recents).toHaveLength(3)
    await recents[1]!.trigger('click')
    expect(wrapper.emitted('pick-recent')).toEqual([['#222222']])
    expect(wrapper.find('[data-testid="pill-palette"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pill-color"] .tool-pill__swatch-mark').exists()).toBe(true)

    await wrapper.setProps({ colorMode: 'one' })
    expect(wrapper.find('[data-testid="pill-recent"]').exists()).toBe(false)
  })

  it('drops the recents while the pill would overflow its edge, and brings them back with room', async () => {
    let scrollWidth = 600
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => scrollWidth)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
    const wrapper = mount(ToolPill, { props: { ...base, colorMode: 'recent', recentsInPill: ['#111111', '#222222', '#333333'] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="pill-recent"]').exists()).toBe(false)

    scrollWidth = 400
    await wrapper.setProps({ position: 'top' })
    await flushPromises()
    expect(wrapper.findAll('[data-testid="pill-recent"]')).toHaveLength(3)
  })

  it('moves to the edge an arrow key on the "Move tools" grip names', async () => {
    const wrapper = mount(ToolPill, { props: base })
    const grip = wrapper.get('[data-testid="tool-pill-grip"]')
    expect(grip.attributes('aria-label')).toBe('Move tools')
    for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) await grip.trigger('keydown', { key })
    await grip.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:position')).toEqual([['left'], ['top'], ['right'], ['bottom']])
  })

  it('has one Tab stop among its tools: the active one', () => {
    const wrapper = mount(ToolPill, { props: { ...base, activeTool: 'hand' } })
    const stops = wrapper.findAll('.tool-pill__stop').filter((button) => button.attributes('tabindex') === '0')
    expect(stops.map((button) => button.attributes('data-testid'))).toEqual(['pill-tool-hand'])
  })
})

describe('dragging the Tool pill (ticket 439)', () => {
  function area(wrapper: ReturnType<typeof mount>) {
    // jsdom lays nothing out: give the drawing area a size so the nearest edge means something.
    wrapper.get('[data-testid="tool-pill-layer"]').element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) })
  }

  function move(x: number, y: number, type = 'pointermove') {
    window.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true }))
  }

  it('lifts after 8px, shows the four drop zones with the nearest lit, and snaps to that edge on release', async () => {
    const wrapper = mount(ToolPill, { props: base, attachTo: document.body })
    area(wrapper)
    const pill = wrapper.get('[data-testid="tool-pill"]')
    await pill.trigger('pointerdown', { button: 0, clientX: 200, clientY: 280, pointerId: 1 })

    move(204, 280)
    expect(wrapper.find('[data-testid="tool-pill-zones"]').exists()).toBe(false)

    move(60, 150)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:popoverOpen')).toEqual([[false]])
    expect(wrapper.findAll('.tool-pill-zone')).toHaveLength(4)
    expect(wrapper.get('[data-testid="tool-pill-zone-left"]').classes()).toContain('tool-pill-zone--near')
    expect(pill.classes()).toContain('tool-pill--lifted')

    move(60, 150, 'pointerup')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:position')).toEqual([['left']])
    expect(wrapper.find('[data-testid="tool-pill-zones"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('is a tap, not a drag, under 8px: nothing moves and the tile is pressed', async () => {
    await new Promise((resolve) => setTimeout(resolve, 150)) // the earlier drop's swallowed click has expired
    const wrapper = mount(ToolPill, { props: base, attachTo: document.body })
    area(wrapper)
    await wrapper.get('[data-testid="tool-pill"]').trigger('pointerdown', { button: 0, clientX: 200, clientY: 280, pointerId: 1 })
    move(203, 283)
    move(203, 283, 'pointerup')
    await wrapper.get('[data-testid="pill-tool-fill"]').trigger('click')
    expect(wrapper.emitted('update:position')).toBeUndefined()
    expect(wrapper.emitted('select-tool')).toEqual([['fill']])
    wrapper.unmount()
  })
})

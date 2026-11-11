import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ToolPill from './ToolPill.vue'
import { PILL_TILES, type PillPosition } from '../../domain/toolPill'
import { controlAction } from '../../composables/shell/controlRegistry'

const TOOL_IDS = ['paint', 'fill', 'select', 'erase', 'hand', 'piece']

const base = { activeTool: 'paint', position: 'bottom', recentsInPill: [], popoverOpen: false, colorHex: '#e63746', colorName: 'Red' } as const

describe('ToolPill (ticket 439)', () => {
  afterEach(() => vi.restoreAllMocks())

  beforeEach(() => {
    localStorage.setItem('openbeads:locale', 'en')
  })

  it('is a toolbar named Tools with the grip first, then the six tools, the Mirror tile, a divider and the colour control', () => {
    const wrapper = mount(ToolPill, { props: base })
    const pill = wrapper.get('[data-testid="tool-pill"]')
    expect(pill.attributes('role')).toBe('toolbar')
    expect(pill.attributes('aria-label')).toBe('Tools')
    expect(wrapper.findAll('button').map((button) => button.attributes('data-testid'))).toEqual([
      'tool-pill-grip',
      ...TOOL_IDS.map((id) => `pill-tool-${id}`),
      'pill-tool-mirror',
      'pill-color',
    ])
    expect(wrapper.findAll('.tool-pill__divider')).toHaveLength(1)
  })

  it('has the Mirror tile after Piece, key 7, lit while the Mirror is on whatever the tool, and its press asks for Mirror mode, opening nothing (ADR 0082)', async () => {
    const wrapper = mount(ToolPill, { props: { ...base, activeTool: 'fill' } })
    const ids = wrapper.findAll('button').map((button) => button.attributes('data-testid'))
    expect(ids.indexOf('pill-tool-mirror')).toBe(ids.indexOf('pill-tool-piece') + 1)
    const tile = wrapper.get('[data-testid="pill-tool-mirror"]')
    expect(tile.attributes('aria-label')).toBe('Mirror')
    expect(tile.get('.icon-btn__key').text()).toBe('7')
    expect(tile.attributes('aria-haspopup')).toBeUndefined()
    expect(tile.attributes('aria-pressed')).toBe('false')
    expect(tile.classes()).not.toContain('icon-btn--accent')

    await tile.trigger('click')
    expect(wrapper.emitted('mirror-tile')).toHaveLength(1)
    expect(wrapper.emitted('select-tool')).toBeUndefined()

    await wrapper.setProps({ mirrorOn: true })
    expect(wrapper.get('[data-testid="pill-tool-mirror"]').classes()).toContain('icon-btn--accent')
    expect(wrapper.get('[data-testid="pill-tool-mirror"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="pill-tool-fill"]').classes()).toContain('icon-btn--accent')
  })

  it('lights the Mirror tile in Mirror mode, and not the Select tile it runs under (ADR 0082)', () => {
    const wrapper = mount(ToolPill, { props: { ...base, activeTool: 'select', mirrorMarking: true } })
    expect(wrapper.get('[data-testid="pill-tool-mirror"]').classes()).toContain('icon-btn--accent')
    expect(wrapper.get('[data-testid="pill-tool-select"]').attributes('aria-pressed')).toBe('false')
  })

  it('lights no tool while Pick color from canvas waits for a bead, Paint included (ticket 0845)', () => {
    const wrapper = mount(ToolPill, { props: { ...base, picking: true } })
    for (const id of TOOL_IDS) expect(wrapper.get(`[data-testid="pill-tool-${id}"]`).attributes('aria-pressed'), id).toBe('false')
  })

  it('shows a Paste tile right after the Mirror tile only while the clipboard holds something, lit in paste mode (ticket 447)', async () => {
    expect(mount(ToolPill, { props: base }).find('[data-testid="pill-tool-paste"]').exists()).toBe(false)

    const wrapper = mount(ToolPill, { props: { ...base, hasClipboard: true } })
    const ids = wrapper.findAll('button').map((button) => button.attributes('data-testid'))
    expect(ids.indexOf('pill-tool-paste')).toBe(ids.indexOf('pill-tool-mirror') + 1)
    const paste = wrapper.get('[data-testid="pill-tool-paste"]')
    expect(paste.attributes('aria-label')).toBe('Paste')
    expect(paste.get('.icon-btn__key').text()).toBe('8')
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

  it('keys every tile by its place in the pill, its badge and its registry chord agreeing: 1 to 8 (ADR 0084)', () => {
    const wrapper = mount(ToolPill, { props: { ...base, hasClipboard: true } })
    const tiles = wrapper.findAll('[data-testid^="pill-tool-"]')
    expect(tiles.map((tile) => tile.attributes('data-testid'))).toEqual(PILL_TILES.map((tile) => `pill-tool-${tile}`))
    tiles.forEach((tile, index) => {
      const id = PILL_TILES[index]!
      const chord = controlAction(id === 'mirror' ? 'mirror' : `tool-${id}`).chords[0]!.key
      expect(tile.get('.icon-btn__key').text(), id).toBe(String(index + 1))
      expect(chord, id).toBe(String(index + 1))
    })
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

  // The canvas box clips what it holds and stacks it under its own bars: on an iPad held sideways, with the pill on the
  // right, the Custom color picker opened under the Progress bar and could not be reached (ticket 0726). The popovers sit
  // in the app shell, where StackingOrder puts them over the bars and under a dialog.
  it.each([['colour', { popoverOpen: true }, 'color-popover']] as const)('opens its %s popover in the app shell, outside the canvas box', async (_, open, testid) => {
    const shell = document.body.appendChild(document.createElement('div'))
    shell.className = 'app-shell'
    const wrapper = mount(ToolPill, { props: { ...base, ...open }, attachTo: shell, global: { stubs: { teleport: false } } })
    await nextTick()
    const popover = document.querySelector(`[data-testid="${testid}"]`)
    expect(popover?.parentElement).toBe(shell)
    expect(wrapper.element.contains(popover)).toBe(false)
    wrapper.unmount()
    shell.remove()
  })

  it('shows three recents beside the swatch, and a recent picks its colour at once', async () => {
    const wrapper = mount(ToolPill, { props: { ...base, recentsInPill: ['#111111', '#222222', '#333333'] } })
    const recents = wrapper.findAll('[data-testid="pill-recent"]')
    expect(recents).toHaveLength(3)
    await recents[1]!.trigger('click')
    expect(wrapper.emitted('pick-recent')).toEqual([['#222222']])
    expect(wrapper.find('[data-testid="pill-palette"]').exists()).toBe(false)
  })

  it('draws the colour tile as the palette icon filled with the chosen colour, its dabs in the mark that reads on it (ticket 0829)', async () => {
    const wrapper = mount(ToolPill, { props: { ...base, colorHex: '#102040' } })
    const swatch = wrapper.find('[data-testid="pill-color"] .tool-pill__swatch')
    expect(swatch.attributes('data-icon')).toBe('palette')
    expect((swatch.element as SVGElement).style.getPropertyValue('--pill-swatch')).toBe('#102040')
    expect(swatch.classes()).toContain('tool-pill__swatch--light')
    await wrapper.setProps({ colorHex: '#fff8e0' })
    expect(swatch.classes()).toContain('tool-pill__swatch--dark')
    // No colour chosen: an empty palette in the tile's own ink, with no mark.
    await wrapper.setProps({ colorHex: undefined })
    expect((swatch.element as SVGElement).style.getPropertyValue('--pill-swatch')).toBe('')
    expect(swatch.classes().some((name) => name.startsWith('tool-pill__swatch--'))).toBe(false)
  })

  it('drops the recents while the tools would have to scroll, and brings them back with room (ticket 0837)', async () => {
    // The tools have 300px of room and need `needed`.
    let needed = 500
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => needed)
    const wrapper = mount(ToolPill, { props: { ...base, recentsInPill: ['#111111', '#222222', '#333333'] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="pill-recent"]').exists()).toBe(false)

    needed = 300
    await wrapper.setProps({ position: 'top' })
    await flushPromises()
    expect(wrapper.findAll('[data-testid="pill-recent"]')).toHaveLength(3)
  })

  // Which key names which edge is pillPositionForKey's (toolPill.test).
  it('moves to the edge an arrow key on the "Move tools" grip names', async () => {
    const wrapper = mount(ToolPill, { props: base })
    const grip = wrapper.get('[data-testid="tool-pill-grip"]')
    expect(grip.attributes('aria-label')).toBe('Move tools')
    await grip.trigger('keydown', { key: 'ArrowUp' })
    await grip.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:position')).toEqual([['top']])
  })

  it('has one Tab stop among its tools: the active one', () => {
    const wrapper = mount(ToolPill, { props: { ...base, activeTool: 'hand' } })
    const stops = wrapper.findAll('.tool-pill__stop').filter((button) => button.attributes('tabindex') === '0')
    expect(stops.map((button) => button.attributes('data-testid'))).toEqual(['pill-tool-hand'])
  })
})

describe('the Tool pill’s arrows follow its axis (ticket 563, ADR 0075)', () => {
  async function pressOn(position: PillPosition, from: string, key: string) {
    const wrapper = mount(ToolPill, { props: { ...base, position, activeTool: 'paint' }, attachTo: document.body })
    const start = wrapper.get(`[data-testid="${from}"]`).element as HTMLElement
    start.focus()
    await wrapper.get('[data-testid="tool-pill"]').trigger('keydown', { key })
    const focused = (document.activeElement as HTMLElement | null)?.getAttribute('data-testid')
    wrapper.unmount()
    return focused
  }

  it.each<[PillPosition, string, string]>([
    ['bottom', 'ArrowRight', 'ArrowLeft'],
    ['top', 'ArrowRight', 'ArrowLeft'],
    ['left', 'ArrowDown', 'ArrowUp'],
    ['right', 'ArrowDown', 'ArrowUp'],
  ])('steps with %s along %s and %s', async (position, forward, backward) => {
    const tools = TOOL_IDS.map((tool) => `pill-tool-${tool}`)
    expect(await pressOn(position, tools[1]!, forward)).toBe(tools[2])
    expect(await pressOn(position, tools[1]!, backward)).toBe(tools[0])
  })

  it.each<[PillPosition, string]>([
    ['bottom', 'ArrowDown'],
    ['top', 'ArrowUp'],
    ['left', 'ArrowRight'],
    ['right', 'ArrowLeft'],
  ])('ignores the other axis (%s, %s)', async (position, key) => {
    expect(await pressOn(position, 'pill-tool-hand', key)).toBe('pill-tool-hand')
  })

  it('stops at the last tile and jumps with Home and End', async () => {
    expect(await pressOn('bottom', 'pill-color', 'ArrowRight')).toBe('pill-color')
    expect(await pressOn('bottom', 'pill-tool-hand', 'End')).toBe('pill-color')
    expect(await pressOn('bottom', 'pill-tool-hand', 'Home')).toBe('tool-pill-grip')
  })

  it('pins Paint before the scrolling tools and the colour control after them, the Paste tile scrolling with the tools (ticket 0837)', () => {
    const wrapper = mount(ToolPill, { props: { ...base, hasClipboard: true } })
    const tools = wrapper.get('[data-testid="tool-pill-tools"]')
    expect(tools.findAll('button').map((button) => button.attributes('data-testid'))).toEqual([
      ...TOOL_IDS.slice(1).map((id) => `pill-tool-${id}`),
      'pill-tool-mirror',
      'pill-tool-paste',
    ])
    expect(tools.find('[data-testid="pill-tool-paint"]').exists()).toBe(false)
    expect(tools.find('[data-testid="pill-color"]').exists()).toBe(false)
  })

  it('leaves the grip out of the Tab stops', () => {
    const wrapper = mount(ToolPill, { props: base })
    expect(wrapper.get('[data-testid="tool-pill-grip"]').attributes('tabindex')).toBe('-1')
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

  it('follows a finger or pen only from the grip, so a swipe on the tools scrolls them (ticket 0837); a mouse drags it from a tile', async () => {
    const wrapper = mount(ToolPill, { props: base, attachTo: document.body })
    area(wrapper)
    const lifted = () => wrapper.get('[data-testid="tool-pill"]').classes().includes('tool-pill--lifted')
    for (const pointerType of ['touch', 'pen']) {
      await wrapper.get('[data-testid="pill-tool-fill"]').trigger('pointerdown', { button: 0, clientX: 200, clientY: 280, pointerId: 1, pointerType })
      move(120, 280)
      await nextTick()
      expect(lifted(), pointerType).toBe(false)
      move(120, 280, 'pointerup')
    }

    await wrapper.get('[data-testid="tool-pill-grip"]').trigger('pointerdown', { button: 0, clientX: 200, clientY: 280, pointerId: 1, pointerType: 'touch' })
    move(120, 280)
    await nextTick()
    expect(lifted()).toBe(true)
    move(120, 280, 'pointercancel')
    await nextTick()

    await wrapper.get('[data-testid="pill-tool-fill"]').trigger('pointerdown', { button: 0, clientX: 200, clientY: 280, pointerId: 1, pointerType: 'mouse' })
    move(120, 280)
    await nextTick()
    expect(lifted()).toBe(true)
    move(120, 280, 'pointercancel')
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ProjectSurface from './ProjectSurface.vue'
import { createProject } from '../../domain/createProject'
import { DRAG_SLOP_PX } from '../../domain/dragSlop'
import { CANVAS_HOLD_MS } from '../../domain/hold'
import { MIRROR_OFF } from '../../domain/mirror'
import { toolCapabilities, type ToolCapabilities } from '../../domain/tool'
import { recordingContext } from '../../testUtils/recordingContext'

// What a held press becomes on the real pointer events (spec 1072, ticket 1065): the drawing pointer, still for the
// hold's length, asks for its press to be dropped and for the Radial toolbox. The rule itself is `pressBecomes`'s test.
const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 20, height: 20, unit: 'beads' } })

function rectOf(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(recordingContext().context as unknown as CanvasRenderingContext2D)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this.classList.contains('project-surface') ? rectOf(0, 0, 1000, 800) : rectOf(0, 0, 0, 0)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const can = (on: Partial<ToolCapabilities> = {}): ToolCapabilities => ({ ...toolCapabilities(undefined), ...on })
const PAINT = can({ tool: 'paint' })

/** The surface with the hold on, and what it reported upward about the hold, in order. */
async function mountSurface(extra: Record<string, unknown> = {}) {
  const said: unknown[][] = []
  const wrapper = mount(ProjectSurface, {
    props: {
      project,
      zoom: 1,
      scroll: { x: 0, y: 0 },
      tools: PAINT,
      inputMode: 'pen',
      holdOpens: true,
      onHold: (...at: unknown[]) => said.push(['hold', ...at]),
      onDropPress: () => said.push(['drop-press']),
      onOpenToolbox: (...where: unknown[]) => said.push(['open-toolbox', ...where]),
      ...extra,
    },
    attachTo: document.body,
  })
  await nextTick()
  await nextTick()
  return { wrapper, surface: wrapper.get('[data-testid="project-surface"]'), said }
}

/** A bead's middle on screen: a bead is 20 px at zoom 1. */
const bead = (row: number, column: number) => ({ clientX: column * 20 + 10, clientY: row * 20 + 10 })
const AT = bead(3, 5)
const POINT = { x: AT.clientX, y: AT.clientY }
const PEN = { pointerType: 'pen', isPrimary: true, pointerId: 2 }
const FINGER = { pointerType: 'touch', isPrimary: true, pointerId: 3 }
const MOUSE = { pointerType: 'mouse', isPrimary: true, pointerId: 1 }
const DOWN = { button: 0, buttons: 1 }

/** An area of 2 x 3 beads at (1, 1), its box (20, 20) to (80, 60) on screen: a point inside it, on the bead (1, 2), and
 * one on its bottom-left handle. */
const SELECT = can({ tool: 'select', selects: true, selectsAnywhere: true })
const AREA = { top: 1, left: 1, rows: 2, columns: 3 }
const INSIDE = { clientX: 50, clientY: 30 }
const ON_HANDLE = { clientX: 13, clientY: 67 }

/** What a completed hold reports: the hairline goes, the press is dropped, then the ring is asked for where it was
 * pressed, on the bead position under it. */
const OPENED = [['hold', POINT], ['hold'], ['drop-press'], ['open-toolbox', POINT, { row: 3, column: 5 }]]

describe('ProjectSurface: a hold opens the Radial toolbox (ticket 1065)', () => {
  it('in Pen mode a held pen asks for the ring and a held finger never does', async () => {
    const pen = await mountSurface({ inputMode: 'pen' })
    await pen.surface.trigger('pointerdown', { ...AT, ...PEN, ...DOWN })
    vi.advanceTimersByTime(CANVAS_HOLD_MS)
    expect(pen.said).toEqual(OPENED)
    pen.wrapper.unmount()

    // A resting palm is a long, still touch.
    const finger = await mountSurface({ inputMode: 'pen' })
    await finger.surface.trigger('pointerdown', { ...AT, ...FINGER, ...DOWN })
    vi.advanceTimersByTime(CANVAS_HOLD_MS * 10)
    expect(finger.said).toEqual([])
    finger.wrapper.unmount()
  })

  it('in Mouse mode a held finger asks for the ring and a held pen never does', async () => {
    const finger = await mountSurface({ inputMode: 'mouse' })
    await finger.surface.trigger('pointerdown', { ...AT, ...FINGER, ...DOWN })
    vi.advanceTimersByTime(CANVAS_HOLD_MS)
    expect(finger.said).toEqual(OPENED)
    finger.wrapper.unmount()

    const pen = await mountSurface({ inputMode: 'mouse' })
    await pen.surface.trigger('pointerdown', { ...AT, ...PEN, ...DOWN })
    vi.advanceTimersByTime(CANVAS_HOLD_MS * 10)
    expect(pen.said).toEqual([])
    pen.wrapper.unmount()
  })

  it('never times a mouse\'s left button, in either mode', async () => {
    for (const inputMode of ['mouse', 'pen']) {
      const { wrapper, surface, said } = await mountSurface({ inputMode })
      await surface.trigger('pointerdown', { ...AT, ...MOUSE, ...DOWN })
      vi.advanceTimersByTime(CANVAS_HOLD_MS * 10)
      expect(said).toEqual([])
      wrapper.unmount()
    }
  })

  it('starts the tool at the press as today, shows the hairline\'s point at once and asks for nothing until the hold is up', async () => {
    const { wrapper, surface, said } = await mountSurface()
    await surface.trigger('pointerdown', { ...AT, ...PEN, ...DOWN })
    expect(wrapper.emitted('cell-primary-down')).toEqual([[3, 5]])
    expect(said).toEqual([['hold', POINT]])

    vi.advanceTimersByTime(CANVAS_HOLD_MS - 1)
    expect(said).toEqual([['hold', POINT]])

    vi.advanceTimersByTime(1)
    expect(said).toEqual(OPENED)
    wrapper.unmount()
  })

  it('opens under every tool', async () => {
    const tools = [
      can({ tool: 'paint' }),
      can({ tool: 'fill', nearestOnPress: true }),
      can({ tool: 'select', selects: true, selectsAnywhere: true }),
      can({ tool: 'erase' }),
      can({ tool: 'hand', moves: true }),
    ]
    for (const tool of tools) {
      const { wrapper, surface, said } = await mountSurface({ tools: tool })
      await surface.trigger('pointerdown', { ...AT, ...PEN, ...DOWN })
      vi.advanceTimersByTime(CANVAS_HOLD_MS)
      expect(said, tool.tool).toEqual(OPENED)
      await nextTick()
      // The Hand's pan is dropped with the rest.
      expect(surface.classes()).not.toContain('project-surface--dragging')
      wrapper.unmount()
    }

  })

  it('a move of the drag slop inside the hold is a stroke as today and opens nothing', async () => {
    const { wrapper, surface, said } = await mountSurface()
    await surface.trigger('pointerdown', { ...AT, ...PEN, ...DOWN })
    vi.advanceTimersByTime(CANVAS_HOLD_MS - 100)
    await surface.trigger('pointermove', { clientX: AT.clientX + DRAG_SLOP_PX, clientY: AT.clientY, ...PEN, buttons: 1 })
    expect(said).toEqual([['hold', POINT], ['hold']])

    // The stroke goes on, and resting later in it opens nothing.
    await surface.trigger('pointermove', { ...bead(3, 7), ...PEN, buttons: 1 })
    vi.advanceTimersByTime(CANVAS_HOLD_MS * 10)
    expect(wrapper.emitted('cells-primary-move')).toEqual([[[{ row: 3, column: 6 }, { row: 3, column: 7 }]]])
    expect(said).toEqual([['hold', POINT], ['hold']])
    wrapper.unmount()
  })

  it('a wobble short of the drag slop is still a hold', async () => {
    const { wrapper, surface, said } = await mountSurface()
    await surface.trigger('pointerdown', { ...AT, ...PEN, ...DOWN })
    await surface.trigger('pointermove', { clientX: AT.clientX + DRAG_SLOP_PX - 1, clientY: AT.clientY, ...PEN, buttons: 1 })
    vi.advanceTimersByTime(CANVAS_HOLD_MS)
    expect(said).toEqual(OPENED)
    wrapper.unmount()
  })

  it('a second finger (a pinch) ends the hold, heard on the surface or told by the shell', async () => {
    const heard = await mountSurface({ inputMode: 'mouse' })
    await heard.surface.trigger('pointerdown', { ...AT, ...FINGER, ...DOWN })
    await heard.surface.trigger('pointerdown', { ...bead(8, 8), pointerType: 'touch', isPrimary: false, pointerId: 4, ...DOWN })
    vi.advanceTimersByTime(CANVAS_HOLD_MS * 10)
    expect(heard.said).toEqual([['hold', POINT], ['hold']])
    heard.wrapper.unmount()

    // In the app the pinch takes the second finger before the surface hears it (usePinchPan).
    const told = await mountSurface({ inputMode: 'mouse', holdEnds: 0 })
    await told.surface.trigger('pointerdown', { ...AT, ...FINGER, ...DOWN })
    await told.wrapper.setProps({ holdEnds: 1 })
    vi.advanceTimersByTime(CANVAS_HOLD_MS * 10)
    expect(told.said).toEqual([['hold', POINT], ['hold']])
    told.wrapper.unmount()
  })

  it('a tap, lifted or cancelled before the hold is up, opens nothing', async () => {
    for (const end of ['pointerup', 'pointercancel']) {
      const { wrapper, surface, said } = await mountSurface()
      await surface.trigger('pointerdown', { ...AT, ...PEN, ...DOWN })
      vi.advanceTimersByTime(CANVAS_HOLD_MS - 1)
      await surface.trigger(end, { ...PEN })
      vi.advanceTimersByTime(CANVAS_HOLD_MS * 10)
      expect(said, end).toEqual([['hold', POINT], ['hold']])
      wrapper.unmount()
    }
  })

  it('after the hold the pointer still down is no tool\'s: it draws and hovers nothing, and its lift ends it', async () => {
    const { wrapper, surface, said } = await mountSurface()
    await surface.trigger('pointerdown', { ...AT, ...PEN, ...DOWN })
    vi.advanceTimersByTime(CANVAS_HOLD_MS)
    const count = () => Object.fromEntries(Object.entries(wrapper.emitted()).filter(([name]) => /^cell/.test(name)).map(([name, calls]) => [name, calls.length]))
    const before = count()

    await surface.trigger('pointermove', { ...bead(3, 9), ...PEN, buttons: 1 })
    await surface.trigger('pointerup', { ...PEN })
    expect(count()).toEqual(before)
    expect(said).toEqual(OPENED)

    // The next press is a press as any other.
    await surface.trigger('pointerdown', { ...bead(6, 6), ...PEN, ...DOWN })
    expect(wrapper.emitted('cell-primary-down')?.at(-1)).toEqual([6, 6])
    wrapper.unmount()
  })

  it('never times a press a handle takes: the Selection\'s', async () => {
    const { wrapper, surface, said } = await mountSurface({ tools: SELECT, selection: AREA })
    await surface.trigger('pointerdown', { ...ON_HANDLE, ...PEN, ...DOWN })
    vi.advanceTimersByTime(CANVAS_HOLD_MS * 10)
    expect(wrapper.emitted('selection-press')!.map(([target]) => target)).toEqual([{ kind: 'handle', edges: ['bottom', 'left'] }])
    expect(said).toEqual([])
    wrapper.unmount()
  })
})

describe('ProjectSurface: a hold inside an area opens the Radial toolbox (ticket 1084)', () => {
  /** A completed hold inside the area: the same as anywhere else, on the bead position pressed. */
  const INSIDE_POINT = { x: INSIDE.clientX, y: INSIDE.clientY }
  const OPENED_INSIDE = [['hold', INSIDE_POINT], ['hold'], ['drop-press'], ['open-toolbox', INSIDE_POINT, { row: 1, column: 2 }]]
  const MIRROR_MODE = { tools: can({ tool: 'select', selects: true, marksArea: true }), mirror: { ...MIRROR_OFF, mode: 'mirror' as const, place: { layer: 'canvas' as const, area: { row: 1, column: 1, rows: 2, columns: 3 } } } }

  it.each([
    ['the Selection', { tools: SELECT, selection: AREA }],
    ['the Mirror\'s Area in Mirror mode', MIRROR_MODE],
  ])('held still inside %s it starts the move, then drops it and asks for the ring; the lift releases nothing', async (_name, extra) => {
    const { wrapper, surface, said } = await mountSurface(extra)
    await surface.trigger('pointerdown', { ...INSIDE, ...PEN, ...DOWN })
    expect(wrapper.emitted('selection-press')).toEqual([[{ kind: 'inside' }, { row: 1, column: 2 }]])
    expect(said).toEqual([['hold', INSIDE_POINT]])

    vi.advanceTimersByTime(CANVAS_HOLD_MS)
    expect(said).toEqual(OPENED_INSIDE)

    await surface.trigger('pointermove', { ...bead(6, 9), ...PEN, buttons: 1 })
    await surface.trigger('pointerup', { ...PEN })
    expect(wrapper.emitted('selection-drag')).toBeUndefined()
    expect(wrapper.emitted('selection-release')).toBeUndefined()
    wrapper.unmount()
  })

  it('a press inside that moves the drag slop before the hold is up moves the area as today and opens nothing', async () => {
    const { wrapper, surface, said } = await mountSurface({ tools: SELECT, selection: AREA })
    await surface.trigger('pointerdown', { ...INSIDE, ...PEN, ...DOWN })
    await surface.trigger('pointermove', { ...bead(4, 6), ...PEN, buttons: 1 })
    vi.advanceTimersByTime(CANVAS_HOLD_MS * 10)
    await surface.trigger('pointerup', { ...PEN })
    expect(said).toEqual([['hold', INSIDE_POINT], ['hold']])
    expect(wrapper.emitted('selection-drag')).toEqual([[{ row: 4, column: 6 }]])
    expect(wrapper.emitted('selection-release')).toHaveLength(1)
    wrapper.unmount()
  })

  it('a quick tap inside is released as today, for the tool\'s own tap', async () => {
    // In Mouse mode the finger is the drawing pointer.
    const { wrapper, surface, said } = await mountSurface({ tools: SELECT, selection: AREA, inputMode: 'mouse' })
    await surface.trigger('pointerdown', { ...INSIDE, ...FINGER, ...DOWN })
    await surface.trigger('pointerup', { ...FINGER })
    vi.advanceTimersByTime(CANVAS_HOLD_MS * 10)
    expect(said).toEqual([['hold', INSIDE_POINT], ['hold']])
    expect(wrapper.emitted('selection-release')).toHaveLength(1)
    wrapper.unmount()
  })

  it('never times a mouse\'s left button inside, nor a press where the ring would not open', async () => {
    for (const [pointer, extra] of [[MOUSE, { inputMode: 'mouse' }], [PEN, { holdOpens: false }]] as const) {
      const { wrapper, surface, said } = await mountSurface({ tools: SELECT, selection: AREA, ...extra })
      await surface.trigger('pointerdown', { ...INSIDE, ...pointer, ...DOWN })
      vi.advanceTimersByTime(CANVAS_HOLD_MS * 10)
      expect(wrapper.emitted('selection-press')).toHaveLength(1)
      expect(said).toEqual([])
      wrapper.unmount()
    }
  })
})

describe('ProjectSurface: where the ring would not open', () => {
  it('opens nothing when the ring stops being able to open during the hold (the Canvas turned read-only)', async () => {
    const { wrapper, surface, said } = await mountSurface()
    await surface.trigger('pointerdown', { ...AT, ...PEN, ...DOWN })
    await wrapper.setProps({ holdOpens: false })
    vi.advanceTimersByTime(CANVAS_HOLD_MS)
    expect(said).toEqual([['hold', POINT], ['hold']])
    wrapper.unmount()
  })

  it('times no hold where the ring would not open, nor on the press Pick color from Canvas waits for', async () => {
    for (const extra of [{ holdOpens: false }, { tools: can({ tool: 'paint', picking: true }) }]) {
      const { wrapper, surface, said } = await mountSurface(extra)
      await surface.trigger('pointerdown', { ...AT, ...PEN, ...DOWN })
      vi.advanceTimersByTime(CANVAS_HOLD_MS * 10)
      expect(said).toEqual([])
      wrapper.unmount()
    }
  })
})

describe('ProjectSurface: the slide after a hold (ticket 1077)', () => {
  /** The surface after a pen's hold opened the ring at AT, and what it reports about the slide from then on. */
  async function held() {
    const slid: unknown[][] = []
    const mounted = await mountSurface({ onSlide: (...at: unknown[]) => slid.push(['slide', ...at]), onSlideLift: (...at: unknown[]) => slid.push(['slide-lift', ...at]) })
    await mounted.surface.trigger('pointerdown', { ...AT, ...PEN, ...DOWN })
    vi.advanceTimersByTime(CANVAS_HOLD_MS)
    return { ...mounted, slid }
  }
  const right = (px: number) => ({ clientX: AT.clientX + px, clientY: AT.clientY })

  it('says where the pointer is once it has moved the drag slop since the ring opened, and where it lifts', async () => {
    const { wrapper, surface, slid } = await held()
    await surface.trigger('pointermove', { ...right(DRAG_SLOP_PX - 1), ...PEN, buttons: 1 })
    expect(slid).toEqual([])
    await surface.trigger('pointermove', { ...right(90), ...PEN, buttons: 1 })
    // Armed for good: back where it started it still slides.
    await surface.trigger('pointermove', { ...right(2), ...PEN, buttons: 1 })
    await surface.trigger('pointerup', { ...right(3), ...PEN })
    expect(slid).toEqual([
      ['slide', { x: POINT.x + 90, y: POINT.y }],
      ['slide', { x: POINT.x + 2, y: POINT.y }],
      ['slide-lift', { x: POINT.x + 3, y: POINT.y }],
    ])
    wrapper.unmount()
  })

  it('a hold lifted with less than the drag slop of movement says nothing: the ring stays open for a tap', async () => {
    const { wrapper, surface, slid } = await held()
    await surface.trigger('pointermove', { ...right(DRAG_SLOP_PX - 1), ...PEN, buttons: 1 })
    await surface.trigger('pointerup', { ...right(DRAG_SLOP_PX - 1), ...PEN })
    expect(slid).toEqual([])
    wrapper.unmount()
  })

  it('measures the move from where the pointer was when the ring opened, not from where it went down', async () => {
    const slid: unknown[][] = []
    const { wrapper, surface } = await mountSurface({ onSlide: (...at: unknown[]) => slid.push(['slide', ...at]), onSlideLift: (...at: unknown[]) => slid.push(['slide-lift', ...at]) })
    await surface.trigger('pointerdown', { ...AT, ...PEN, ...DOWN })
    // The pen drifts during the hold, short of a stroke.
    await surface.trigger('pointermove', { ...right(DRAG_SLOP_PX - 1), ...PEN, buttons: 1 })
    vi.advanceTimersByTime(CANVAS_HOLD_MS)
    await surface.trigger('pointermove', { ...right(DRAG_SLOP_PX + 2), ...PEN, buttons: 1 })
    await surface.trigger('pointerup', { ...right(DRAG_SLOP_PX + 2), ...PEN })
    expect(slid).toEqual([])
    wrapper.unmount()
  })

  it('a slide that is cancelled lifts on nothing: it only says the slide ended', async () => {
    const { wrapper, surface, slid } = await held()
    await surface.trigger('pointermove', { ...right(90), ...PEN, buttons: 1 })
    await surface.trigger('pointercancel', { ...right(90), ...PEN })
    expect(slid).toEqual([['slide', { x: POINT.x + 90, y: POINT.y }], ['slide']])
    wrapper.unmount()
  })

  it('a mouse does not slide: its right-button drag says nothing to the ring', async () => {
    const slid: unknown[][] = []
    const { wrapper, surface } = await mountSurface({ onSlide: () => slid.push(['slide']), onSlideLift: () => slid.push(['slide-lift']) })
    await surface.trigger('pointerdown', { ...AT, ...MOUSE, button: 2, buttons: 2 })
    await surface.trigger('pointermove', { ...right(90), ...MOUSE, buttons: 2 })
    await surface.trigger('pointerup', { ...right(90), ...MOUSE, button: 2 })
    expect(slid).toEqual([])
    wrapper.unmount()
  })
})

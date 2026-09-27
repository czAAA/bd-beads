import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PatternSurface from './PatternSurface.vue'
import { createPattern, type Pattern, type RowProgress, type Technique } from '../domain/pattern'
import { GRID_BORDER_PX } from '../domain/grid'
import { DARK_THEME, DEFAULT_THEME } from '../rendering/beadLook'
import { recordingContext } from '../testUtils/recordingContext'

/** A Pattern of this many beads, with any of its fields changed. */
function patternOf(columns: number, rows: number, extra: Partial<Pattern> = {}, technique: Technique = 'loom'): Pattern {
  const pattern = createPattern({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  return { ...pattern, ...extra }
}

/** Where the surface sits on the screen, and what else clips it. jsdom does no layout, so every rectangle is said here. */
interface Layout {
  surface: { left: number; top: number }
  /** An ancestor that clips (the canvas panel's horizontal scroll), as a screen rectangle. */
  clip?: { left: number; top: number; right: number; bottom: number }
}

let layout: Layout
let context: ReturnType<typeof recordingContext>

function rectOf(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }
}

beforeEach(() => {
  context = recordingContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context.context as unknown as CanvasRenderingContext2D)
  layout = { surface: { left: 0, top: 0 }, clip: { left: 0, top: 0, right: 1000, bottom: 800 } }
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.classList.contains('pattern-surface')) {
      // The box is the displayed Pattern plus its outline: what the surface's own style says.
      const style = (this as HTMLElement).style
      return rectOf(layout.surface.left, layout.surface.top, Number.parseFloat(style.width), Number.parseFloat(style.height))
    }
    if (this.hasAttribute('data-clip') && layout.clip) {
      const { left, top, right, bottom } = layout.clip
      return rectOf(left, top, right - left, bottom - top)
    }
    return rectOf(0, 0, 0, 0)
  })
  // A frame arrives right after the event that asked for it, which is all these tests need of one.
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queueMicrotask(() => callback(0))
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** Mounts the surface inside a stand-in for the canvas panel's scroll container (which clips), attached so styles apply. */
async function mountSurface(pattern: Pattern, zoom = 1) {
  const host = document.createElement('div')
  host.setAttribute('data-clip', '')
  host.style.overflowX = 'auto'
  document.body.append(host)
  const wrapper = mount(PatternSurface, { props: { pattern, zoom }, attachTo: host })
  // The window is found once the box is on the page, and the canvases are drawn once they have their size.
  await nextTick()
  await nextTick()
  return { wrapper, host }
}

const windowOf = (wrapper: Awaited<ReturnType<typeof mountSurface>>['wrapper']) =>
  wrapper.find('[data-testid="pattern-surface-cells"]').attributes('data-window')

/** Times the surface has been drawn: each draws the cells and then the overlay, and each starts by clearing. */
const draws = () => context.named('clearRect').length / 2

describe('PatternSurface', () => {
  it('redraws both layers in the new theme\'s colors when the theme changes, at the same size and window', async () => {
    const { wrapper } = await mountSurface(patternOf(20, 10), 1)
    const style = wrapper.find('[data-testid="pattern-surface"]').attributes('style')
    const window = windowOf(wrapper)
    context.calls.length = 0

    document.documentElement.dataset.theme = 'dark'
    try {
      await nextTick()
      await nextTick()
      await nextTick()

      expect(draws()).toBe(1)
      // The whole surface is cleared and painted the dark board first.
      expect(context.named('fillRect')[0]!.fillStyle).toBe(DARK_THEME.background)
      expect(wrapper.find('[data-testid="pattern-surface"]').attributes('style')).toBe(style)
      expect(windowOf(wrapper)).toBe(window)
    } finally {
      document.documentElement.dataset.theme = 'light'
      await nextTick()
    }
  })

  it('is the box the DOM grid was, the size of the Pattern and its outline', async () => {
    const { wrapper } = await mountSurface(patternOf(20, 10), 1)

    const style = wrapper.find('[data-testid="pattern-surface"]').attributes('style')
    // 20 × 10 loom beads at 20px, and the board's 14px padding on every side.
    expect(style).toContain('width: 428px')
    expect(style).toContain('height: 228px')
  })

  it('holds a window of a Pattern too big to draw whole: the screen and a margin, not the Pattern', async () => {
    const { wrapper } = await mountSurface(patternOf(250, 250), 3)

    // 15,000 px across at 300%; the screen shows 1000 × 800 of it less the board's 42px padding, from the first bead, and 160 more.
    expect(windowOf(wrapper)).toBe('0,0,1118,918')
    const canvas = wrapper.find<HTMLCanvasElement>('[data-testid="pattern-surface-cells"]').element
    expect([canvas.width, canvas.height]).toEqual([1119, 919])
  })

  it('draws a Pattern that fits on screen whole, and no bigger', async () => {
    const { wrapper } = await mountSurface(patternOf(20, 10), 1)

    expect(windowOf(wrapper)).toBe('0,0,400,200')
  })

  it('draws no more beads for a bigger Pattern: the cost follows the screen', async () => {
    const drawn = async (columns: number, rows: number) => {
      context.calls.length = 0
      await mountSurface(patternOf(columns, rows), 1)
      return context.named('fillRect').length
    }

    const large = await drawn(250, 250)
    const larger = await drawn(400, 400)

    expect(larger).toBe(large)
  })

  it('holds a Pattern that is bigger than the screen but not big for a canvas whole, so that scrolling it draws nothing (ticket 122)', async () => {
    const { wrapper } = await mountSurface(patternOf(75, 75), 1)
    const before = draws()

    // 1500px each way against a screen of 1000 × 800: the whole of it, with no margin to run out of.
    expect(windowOf(wrapper)).toBe('0,0,1500,1500')

    for (const top of [-300, -700, -100, 0]) {
      layout.surface.top = top
      window.dispatchEvent(new Event('scroll'))
      await nextTick()
      await nextTick()
    }
    expect(draws()).toBe(before)
  })

  it('still holds a window when the Pattern would need a bigger bitmap than a canvas is safe at, on a dense screen', async () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true })
    try {
      // 1500px across is 4500 device px: 20 million of them, both ways.
      const { wrapper } = await mountSurface(patternOf(75, 75), 1)

      expect(windowOf(wrapper)).toBe('0,0,1146,946')
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true })
    }
  })

  it('cuts what is on screen by whatever clips the Pattern, such as the canvas panel\'s scroll', async () => {
    layout.clip = { left: 0, top: 0, right: 500, bottom: 800 }
    const { wrapper } = await mountSurface(patternOf(250, 250), 1)

    // 500px visible across (less the board's 14px padding), and 160 more on the right; the whole screen's height as before.
    expect(windowOf(wrapper)).toBe('0,0,646,946')
  })

  it('draws it again when scrolling takes the screen out of what it holds, and not before', async () => {
    const { wrapper } = await mountSurface(patternOf(250, 250), 1)
    const before = draws()
    expect(windowOf(wrapper)).toBe('0,0,1146,946')

    // Scrolled 100px: still inside the margin. Nothing to draw.
    layout.surface.top = -100
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    await nextTick()
    expect(draws()).toBe(before)

    // Scrolled 400px: the bottom of the screen is past what was drawn.
    layout.surface.top = -400
    window.dispatchEvent(new Event('scroll'))

    await nextTick()
    await nextTick()
    expect(windowOf(wrapper)).toBe('0,226,1146,1120')
    expect(draws()).toBe(before + 1)
  })

  it('listens for scrolling anywhere, since the panel and the page each scroll on their own', async () => {
    const add = vi.spyOn(window, 'addEventListener')

    await mountSurface(patternOf(20, 10))

    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), expect.objectContaining({ capture: true }))
  })

  it('stops listening when it goes away', async () => {
    const { wrapper } = await mountSurface(patternOf(20, 10))
    const remove = vi.spyOn(window, 'removeEventListener')

    wrapper.unmount()

    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), expect.objectContaining({ capture: true }))
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('starts again from what is on screen when the zoom changes', async () => {
    const { wrapper } = await mountSurface(patternOf(250, 250), 1)
    expect(windowOf(wrapper)).toBe('0,0,1146,946')

    await wrapper.setProps({ zoom: 1.5 })
    await nextTick()
    await nextTick()

    // At 150% the Pattern is 7,500 px across and tall: the screen's 1000 × 800 (less the board's 21px padding), and 160 more.
    expect(windowOf(wrapper)).toBe('0,0,1139,939')
    expect(wrapper.find('[data-testid="pattern-surface"]').attributes('style')).toContain('width: 7542px')
  })

  describe('when the Pattern is edited', () => {
    /** The Pattern with one bead of one row painted. */
    function painted(pattern: Pattern, row: number, column: number): Pattern {
      return {
        ...pattern,
        grid: pattern.grid.map((cells, index) => (index === row ? cells.map((cell, at) => (at === column ? { color: '#e63746' } : cell)) : cells)),
      }
    }

    it('draws only the rows it changed, and their neighbours, and does not move the window', async () => {
      const pattern = patternOf(20, 30)
      const { wrapper } = await mountSurface(pattern)
      context.calls.length = 0

      await wrapper.setProps({ pattern: painted(pattern, 12, 4) })

      // Row 12 is y 240 to 260, across the whole 400px width: one band, cut to it.
      expect(context.named('rect').map((call) => call.args)).toEqual([[0, 240, 400, 20]])
      expect(windowOf(wrapper)).toBe('0,0,400,600')
    })

    it('draws a band for each cluster of changed rows, as a Mirror stroke changes rows far apart', async () => {
      const pattern = patternOf(20, 30)
      const { wrapper } = await mountSurface(pattern)
      context.calls.length = 0

      await wrapper.setProps({ pattern: painted(painted(pattern, 3, 4), 26, 4) })

      expect(context.named('rect').map((call) => call.args[1])).toEqual([60, 520])
    })

    it('draws no cells at all when nothing on screen changed, and only redraws the overlay', async () => {
      const pattern = patternOf(20, 30)
      const { wrapper } = await mountSurface(pattern)
      context.calls.length = 0

      await wrapper.setProps({ pattern: { ...pattern, updatedAt: pattern.updatedAt + 1 } })

      expect(context.named('rect')).toHaveLength(0)
      expect(context.named('fillRect')).toHaveLength(0)
      expect(context.named('clearRect')).toHaveLength(1) // the overlay's
    })

    it('draws everything again when so much changed that bands would cost more, such as an Undo', async () => {
      const pattern = patternOf(20, 60)
      const { wrapper } = await mountSurface(pattern)
      context.calls.length = 0

      await wrapper.setProps({
        pattern: { ...pattern, grid: pattern.grid.map((cells) => cells.map(() => ({ color: '#e63746' }))) },
      })

      expect(context.named('rect')).toHaveLength(0)
      expect(context.named('clearRect')[0]!.args).toEqual([0, 0, 400, 1200])
    })

    it('draws everything again when Row progress moves, since rows are faded by it', async () => {
      const pattern = patternOf(20, 10, { rowProgress: { enabled: true, direction: 'rows', currentRow: 2, currentColumn: 0 } })
      const { wrapper } = await mountSurface(pattern)
      context.calls.length = 0

      await wrapper.setProps({ pattern: { ...pattern, rowProgress: { ...pattern.rowProgress, currentRow: 3 } } })

      expect(context.named('rect')).toHaveLength(0)
      expect(context.named('clearRect')[0]!.args).toEqual([0, 0, 400, 200])
    })

    it('keeps the window and the canvases: an edit never sends them away', async () => {
      const pattern = patternOf(20, 30)
      const { wrapper } = await mountSurface(pattern)
      const canvas = wrapper.find('[data-testid="pattern-surface-cells"]').element

      await wrapper.setProps({ pattern: painted(pattern, 12, 4) })

      expect(wrapper.find('[data-testid="pattern-surface-cells"]').element).toBe(canvas)
      expect(wrapper.find('[data-testid="pattern-surface-cells"]').attributes('style')).not.toContain('display: none')
    })
  })

  it('takes the turned shape of a rotated Pattern: as tall as the Pattern is wide', async () => {
    const { wrapper } = await mountSurface(patternOf(20, 10, { rotated: true }), 1)

    const style = wrapper.find('[data-testid="pattern-surface"]').attributes('style')
    expect(style).toContain('width: 228px')
    expect(style).toContain('height: 428px')
    expect(windowOf(wrapper)).toBe('0,0,200,400')
  })

  it('draws the Row progress marker on the overlay, and no marker while it is off', async () => {
    const progress = (enabled: boolean): RowProgress => ({ enabled, direction: 'rows', currentRow: 2, currentColumn: 0 })

    await mountSurface(patternOf(20, 10, { rowProgress: progress(false) }))
    expect(context.named('fill').some((call) => call.fillStyle === DEFAULT_THEME.marker)).toBe(false)

    context.calls.length = 0
    await mountSurface(patternOf(20, 10, { rowProgress: progress(true) }))
    expect(context.named('fill').some((call) => call.fillStyle === DEFAULT_THEME.marker)).toBe(true)
  })

  it('makes a bitmap as dense as the screen: twice the pixels on a 2× display', async () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    try {
      const { wrapper } = await mountSurface(patternOf(20, 10), 1)

      const canvas = wrapper.find<HTMLCanvasElement>('[data-testid="pattern-surface-cells"]').element
      expect([canvas.width, canvas.height]).toEqual([800, 400])
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true })
    }
  })

  describe('the pointer', () => {
    /** Where on the screen a bead's centre is, for a Pattern whose surface is at the screen's corner, at a zoom. */
    function centreOf(pattern: Pattern, row: number, column: number, zoom = 1): { clientX: number; clientY: number } {
      const shiftX = pattern.technique !== 'loom' && row % 2 === 1 ? 10 : 0
      const pitch = pattern.technique === 'peyote' ? 15 : pattern.technique === 'brick' ? 21 : 20
      const x = shiftX + column * 20 + 10
      const y = row * pitch + 10
      const border = GRID_BORDER_PX * zoom
      return pattern.rotated
        ? { clientX: border + (Math.round((pattern.technique === 'loom' ? pattern.rows * 20 : pattern.rows * pitch + (20 - pitch)) - y) * zoom), clientY: border + x * zoom }
        : { clientX: border + x * zoom, clientY: border + y * zoom }
    }

    const events = (wrapper: Awaited<ReturnType<typeof mountSurface>>['wrapper']) =>
      wrapper.emitted() as Record<string, unknown[][]>

    it('says which bead a press landed on, hovering it first as its own pointerenter did', async () => {
      const pattern = patternOf(20, 10)
      const { wrapper } = await mountSurface(pattern)

      await wrapper.find('[data-testid="pattern-surface"]').trigger('pointerdown', { ...centreOf(pattern, 3, 5), button: 0, buttons: 1 })

      expect(events(wrapper)['cell-hover']).toEqual([[3, 5]])
      expect(events(wrapper)['cell-primary-down']).toEqual([[3, 5]])
    })

    it('does not hover again for a press on the bead the pointer was already over', async () => {
      const pattern = patternOf(20, 10)
      const { wrapper } = await mountSurface(pattern)
      const surface = wrapper.find('[data-testid="pattern-surface"]')

      await surface.trigger('pointermove', { ...centreOf(pattern, 3, 5), buttons: 0 })
      await surface.trigger('pointerdown', { ...centreOf(pattern, 3, 5), button: 0, buttons: 1 })

      expect(events(wrapper)['cell-hover']).toEqual([[3, 5]])
    })

    it('says a right press is a secondary one', async () => {
      const pattern = patternOf(20, 10)
      const { wrapper } = await mountSurface(pattern)

      await wrapper.find('[data-testid="pattern-surface"]').trigger('pointerdown', { ...centreOf(pattern, 1, 2), button: 2, buttons: 2 })

      expect(events(wrapper)['cell-secondary-down']).toEqual([[1, 2]])
      expect(events(wrapper)['cell-primary-down']).toBeUndefined()
    })

    it('ignores a press with any other button', async () => {
      const pattern = patternOf(20, 10)
      const { wrapper } = await mountSurface(pattern)

      await wrapper.find('[data-testid="pattern-surface"]').trigger('pointerdown', { ...centreOf(pattern, 1, 2), button: 1, buttons: 4 })

      expect(events(wrapper)['cell-primary-down']).toBeUndefined()
      expect(events(wrapper)['cell-secondary-down']).toBeUndefined()
    })

    it('hovers each bead it moves onto, once, and continues a stroke with the button held', async () => {
      const pattern = patternOf(20, 10)
      const { wrapper } = await mountSurface(pattern)
      const surface = wrapper.find('[data-testid="pattern-surface"]')

      await surface.trigger('pointermove', { ...centreOf(pattern, 0, 0), buttons: 0 })
      await surface.trigger('pointermove', { clientX: centreOf(pattern, 0, 0).clientX + 3, clientY: centreOf(pattern, 0, 0).clientY, buttons: 0 })
      await surface.trigger('pointermove', { ...centreOf(pattern, 0, 1), buttons: 1 })
      await surface.trigger('pointermove', { ...centreOf(pattern, 0, 2), buttons: 2 })

      expect(events(wrapper)['cell-hover']).toEqual([[0, 0], [0, 1], [0, 2]])
      expect(events(wrapper)['cell-primary-move']).toEqual([[0, 1]])
      expect(events(wrapper)['cell-secondary-move']).toEqual([[0, 2]])
    })

    it('drags a touch or pen stroke across beads the same way a held mouse button does (ticket 60)', async () => {
      const pattern = patternOf(20, 10)
      const { wrapper } = await mountSurface(pattern)
      const surface = wrapper.find('[data-testid="pattern-surface"]')

      for (const pointerType of ['touch', 'pen']) {
        await surface.trigger('pointerdown', { ...centreOf(pattern, 0, 0), pointerType, pointerId: 1, button: 0, buttons: 1 })
        await surface.trigger('pointermove', { ...centreOf(pattern, 0, 1), pointerType, pointerId: 1, buttons: 1 })
        await surface.trigger('pointermove', { ...centreOf(pattern, 0, 2), pointerType, pointerId: 1, buttons: 1 })
        await surface.trigger('pointerleave')
      }

      expect(events(wrapper)['cell-primary-down']).toEqual([[0, 0], [0, 0]])
      expect(events(wrapper)['cell-primary-move']).toEqual([[0, 1], [0, 2], [0, 1], [0, 2]])
    })

    it('never hovers for a finger touch (ticket 166: no hover paint preview on a coarse pointer), but still hovers for a Pencil', async () => {
      const pattern = patternOf(20, 10)
      const { wrapper } = await mountSurface(pattern)
      const surface = wrapper.find('[data-testid="pattern-surface"]')

      await surface.trigger('pointerdown', { ...centreOf(pattern, 0, 0), pointerType: 'touch', pointerId: 1, button: 0, buttons: 1 })
      await surface.trigger('pointermove', { ...centreOf(pattern, 0, 1), pointerType: 'touch', pointerId: 1, buttons: 1 })
      expect(events(wrapper)['cell-hover']).toBeUndefined()

      await surface.trigger('pointerdown', { ...centreOf(pattern, 1, 0), pointerType: 'pen', pointerId: 2, button: 0, buttons: 1 })
      expect(events(wrapper)['cell-hover']).toEqual([[1, 0]])
    })

    it('says nothing for a move in a gap, and hovers the bead again on coming back to it', async () => {
      const pattern = patternOf(20, 10, {}, 'peyote')
      const { wrapper } = await mountSurface(pattern)
      const surface = wrapper.find('[data-testid="pattern-surface"]')

      await surface.trigger('pointermove', { ...centreOf(pattern, 1, 0), buttons: 0 })
      // Left of a shifted row there is no bead.
      await surface.trigger('pointermove', { clientX: 3 + 4, clientY: 3 + 25, buttons: 0 })
      await surface.trigger('pointermove', { ...centreOf(pattern, 1, 0), buttons: 0 })

      expect(events(wrapper)['cell-hover']).toEqual([[1, 0], [1, 0]])
    })

    it('says nothing for the Pattern\'s outline, which is on no bead', async () => {
      const pattern = patternOf(20, 10)
      const { wrapper } = await mountSurface(pattern)

      await wrapper.find('[data-testid="pattern-surface"]').trigger('pointerdown', { clientX: 1, clientY: 1, button: 0, buttons: 1 })

      expect(events(wrapper)['cell-hover']).toBeUndefined()
      expect(events(wrapper)['cell-primary-down']).toBeUndefined()
    })

    it('says the hover is over when the pointer leaves', async () => {
      const pattern = patternOf(20, 10)
      const { wrapper } = await mountSurface(pattern)
      const surface = wrapper.find('[data-testid="pattern-surface"]')

      await surface.trigger('pointermove', { ...centreOf(pattern, 0, 0), buttons: 0 })
      await surface.trigger('pointerleave')
      await surface.trigger('pointermove', { ...centreOf(pattern, 0, 0), buttons: 0 })

      expect(events(wrapper)['hover-end']).toHaveLength(1)
      // Back over the same bead after leaving: a fresh hover.
      expect(events(wrapper)['cell-hover']).toEqual([[0, 0], [0, 0]])
    })

    it('works out the bead at any zoom, on peyote\'s shifted rows and brick stitch\'s seams', async () => {
      for (const technique of ['peyote', 'brick'] as const) {
        const pattern = patternOf(20, 10, {}, technique)
        const { wrapper } = await mountSurface(pattern, 2)

        await wrapper.find('[data-testid="pattern-surface"]').trigger('pointerdown', { ...centreOf(pattern, 5, 7, 2), button: 0, buttons: 1 })

        expect(events(wrapper)['cell-primary-down']).toEqual([[5, 7]])
      }
    })

    it('works out the bead of a rotated Pattern', async () => {
      const pattern = patternOf(20, 10, { rotated: true })
      const { wrapper } = await mountSurface(pattern)

      await wrapper.find('[data-testid="pattern-surface"]').trigger('pointerdown', { ...centreOf(pattern, 2, 15), button: 0, buttons: 1 })

      expect(events(wrapper)['cell-primary-down']).toEqual([[2, 15]])
    })

    it('does not open the browser\'s menu on a right press', async () => {
      const { wrapper } = await mountSurface(patternOf(20, 10))
      const event = new Event('contextmenu', { cancelable: true, bubbles: true })

      wrapper.find('[data-testid="pattern-surface"]').element.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
    })

    it('shows a crosshair over a bead, and the ordinary cursor elsewhere', async () => {
      const pattern = patternOf(20, 10)
      const { wrapper } = await mountSurface(pattern)
      const surface = wrapper.find('[data-testid="pattern-surface"]')

      await surface.trigger('pointermove', { ...centreOf(pattern, 0, 0), buttons: 0 })
      expect(surface.classes()).toContain('pattern-surface--over-bead')

      await surface.trigger('pointerleave')
      expect(surface.classes()).not.toContain('pattern-surface--over-bead')
    })
  })

  describe('the hover preview', () => {
    it('is drawn on the overlay: the paint color faintly on each bead named', async () => {
      const { wrapper } = await mountSurface(patternOf(20, 10))
      context.calls.length = 0

      await wrapper.setProps({ previewCells: [{ row: 1, column: 2 }, { row: 1, column: 17 }], previewColor: '#e63746' })

      const faint = context.named('fillRect').filter((call) => call.globalAlpha === 0.6)
      expect(faint.map((call) => call.args)).toEqual([[41, 21, 18, 18], [341, 21, 18, 18]])
      // The cells were not drawn again for it.
      expect(context.named('rect')).toHaveLength(0)
    })

    it('is gone from the overlay when the cells are cleared', async () => {
      const { wrapper } = await mountSurface(patternOf(20, 10), 1)
      await wrapper.setProps({ previewCells: [{ row: 1, column: 2 }], previewColor: '#e63746' })
      context.calls.length = 0

      await wrapper.setProps({ previewCells: [] })

      expect(context.named('fillRect')).toHaveLength(0)
      expect(context.named('clearRect')).toHaveLength(1)
    })

    it('follows the zoom and the window of a Pattern much bigger than the screen', async () => {
      const { wrapper } = await mountSurface(patternOf(250, 250), 3)
      context.calls.length = 0

      await wrapper.setProps({ previewCells: [{ row: 0, column: 0 }], previewColor: null })

      // A neutral outline: filled even-odd in the dark ink, through the transform that scales it by 3.
      expect(context.named('fill').at(-1)!.args).toEqual(['evenodd'])
      expect(context.named('setTransform').at(-1)!.args).toEqual([3, 0, 0, 3, -0, -0])
    })
  })

  describe('the other overlays', () => {
    it('draws the Selection over the beads when one is marked out, and takes it away again', async () => {
      const { wrapper } = await mountSurface(patternOf(20, 10))
      context.calls.length = 0

      await wrapper.setProps({ selection: { top: 1, left: 1, rows: 2, columns: 3 } })

      expect(context.named('fillRect').filter((call) => call.globalAlpha === 0.3)).toHaveLength(6)
      expect(context.named('rect')).toHaveLength(0) // the cells were left alone

      context.calls.length = 0
      await wrapper.setProps({ selection: undefined })
      expect(context.named('fillRect')).toHaveLength(0)
    })

    it('draws Mirror\'s axis lines when a direction has an axis', async () => {
      const { wrapper } = await mountSurface(patternOf(20, 10))
      context.calls.length = 0

      await wrapper.setProps({ mirrorAxisCounts: { columns: 1, rows: 0 } })

      expect(context.named('fillRect').map((call) => call.args)).toEqual([[199, 0, 2, 200]])
    })

    it('draws the beads a "Mirror current" hover would overwrite, faded', async () => {
      const { wrapper } = await mountSurface(patternOf(20, 10))
      context.calls.length = 0

      await wrapper.setProps({ dimmedCells: [{ row: 0, column: 0 }, { row: 0, column: 1 }] })

      // A faded bead is a bitmap, made once for both (two rectangles on the bitmap's own canvas) and blitted for each.
      expect(context.named('drawImage')).toHaveLength(2)
      expect(context.named('rect')).toHaveLength(0)
    })
  })
})

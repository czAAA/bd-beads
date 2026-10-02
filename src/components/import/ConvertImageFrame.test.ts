import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ConvertImageFrame from './ConvertImageFrame.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { CELL_SIZE_PX, gridWidthPx } from '../../domain/grid'
import { DEFAULT_MAX_IMAGE_COLORS, MIN_IMAGE_COLORS, type PixelData } from '../../domain/imageConversion'
import { CENTERED_PAN } from '../../domain/imageFraming'
import { installFakeCanvas } from '../../testUtils/fakeCanvas'

// Whether a block is too big to draw bead by bead is the draft renderer's own rule (tested there); here it is made to
// answer as a huge one would, and what is drawn is what is watched.
const draft = vi.hoisted(() => ({ big: false, rendered: [] as unknown[] }))
vi.mock('../../rendering/draftRenderer', () => ({
  usesDraftLook: () => draft.big,
  renderDraft: (_context: unknown, input: unknown) => draft.rendered.push(input),
}))

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

/** A picture of flat color blocks: the left half red, the right half blue. */
function twoBlocks(width = 8, height = 8): PixelData {
  const rgba: number[][] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      rgba.push(x < width / 2 ? [255, 0, 0, 255] : [0, 0, 255, 255])
    }
  }
  return { width, height, data: new Uint8ClampedArray(rgba.flat()) }
}

/** The canvas the beads are drawn on, and the beads drawn on it: jsdom has none, so a fake one is installed for each test. */
let canvas: ReturnType<typeof installFakeCanvas>

beforeEach(() => {
  canvas = installFakeCanvas()
  draft.big = false
  draft.rendered = []
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** How the drawn lattice is laid out: its size in beads, as the canvas states it. */
function latticeSize(wrapper: ReturnType<typeof mountFrame>): { columns: number; rows: number } {
  const canvasEl = wrapper.find('[data-testid="convert-image-canvas"]')
  return { columns: Number(canvasEl.attributes('data-columns')), rows: Number(canvasEl.attributes('data-rows')) }
}

function mountFrame(overrides: Partial<InstanceType<typeof ConvertImageFrame>['$props']> = {}) {
  return mount(ConvertImageFrame, {
    props: {
      drawBead: canvas.drawBead,
      image: twoBlocks(),
      technique: 'loom',
      bead: cubeBead,
      dimensions: { columns: 4, rows: 4 },
      zoom: 1,
      pan: { ...CENTERED_PAN },
      maxColors: DEFAULT_MAX_IMAGE_COLORS,
      availableWidth: 900,
      ...overrides,
    },
  })
}

describe('ConvertImageFrame', () => {
  it('draws the picture as beads, on a canvas', () => {
    const wrapper = mountFrame()

    expect(latticeSize(wrapper)).toEqual({ columns: 4, rows: 4 })
    expect(canvas.latest()).toHaveLength(16)
    expect(canvas.latest().slice(0, 4).map(({ x, y }) => [x, y])).toEqual([[0, 0], [20, 0], [40, 0], [60, 0]])
  })

  it('draws the frame over exactly the Pattern own cells', () => {
    const wrapper = mountFrame({ dimensions: { columns: 4, rows: 6 } })

    const outline = wrapper.find('[data-testid="convert-image-frame-outline"]')
    expect(outline.attributes('style')).toContain(`width: ${gridWidthPx('loom', 4)}px`)
  })

  it('reaches out past the frame when the picture hangs over it, and offsets the frame accordingly', () => {
    // Twice as wide as tall against a square frame: half the picture's width hangs off each side.
    const wrapper = mountFrame({ image: twoBlocks(16, 8) })

    expect(latticeSize(wrapper).columns).toBeGreaterThan(4)

    const outline = wrapper.find('[data-testid="convert-image-frame-outline"]')
    expect(outline.attributes('style')).not.toContain('left: 0px')
  })

  it('reflows the beads when the picture is zoomed, without moving the frame', () => {
    const wrapper = mountFrame()
    const before = wrapper.find('[data-testid="convert-image-frame-outline"]').attributes('style')

    const zoomed = mountFrame({ zoom: 4 })

    const columns = (mounted: typeof wrapper) => latticeSize(mounted).columns
    expect(columns(zoomed)).toBeGreaterThan(columns(wrapper))
    // The frame is still 4 x 4 cells at 4 x 4 cells: zoom moves the picture, not the frame.
    expect(zoomed.find('[data-testid="convert-image-frame-outline"]').attributes('style')).toContain(
      `width: ${gridWidthPx('loom', 4)}px`,
    )
    expect(before).toContain(`width: ${gridWidthPx('loom', 4)}px`)
  })

  it('follows the Technique own geometry, staggering peyote rows and rounding its beads', () => {
    mountFrame({ technique: 'peyote' })

    const beads = canvas.latest()
    // Row 1 is half a bead across and tucked up under row 0, as in the Pattern itself.
    expect(beads.filter(({ y }) => y === 0).map(({ x }) => x)).toEqual([0, 20, 40, 60])
    expect(beads.filter(({ y }) => y === 15).map(({ x }) => x)).toEqual([10, 30, 50, 70])
    expect(beads.every(({ cornerRadius }) => Math.abs(cornerRadius - 4.4) < 1e-9)).toBe(true)
  })

  it('draws brick stitch a seam apart, where the frame outline follows the rows it draws', () => {
    // A picture that hangs over the frame, so the frame sits below the first lattice rows and must land on a bead row.
    const wrapper = mountFrame({ technique: 'brick', image: twoBlocks(8, 24) })

    const beads = canvas.latest()
    const { rows } = latticeSize(wrapper)
    const rowTops = [...new Set(beads.map(({ y }) => y))]
    expect(rowTops).toEqual(Array.from({ length: rows }, (_row, row) => row * (CELL_SIZE_PX + 1)))

    const top = Number.parseFloat(
      /top: ([\d.]+)px/.exec(wrapper.find('[data-testid="convert-image-frame-outline"]').attributes('style')!)![1]!,
    )
    expect(rowTops).toContain(top)
  })

  it('emits the converted Pattern when Create is pressed', async () => {
    const wrapper = mountFrame()

    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')

    const created = wrapper.emitted('create')!
    expect(created).toHaveLength(1)
    const converted = created[0]![0] as { grid: { color: string | null }[][]; imageColors: string[] }
    expect(converted.grid).toHaveLength(4)
    expect(converted.grid[0]).toHaveLength(4)
    expect(new Set(converted.imageColors)).toEqual(new Set(['#e63746', '#2f6fed']))
    // The left half of the picture is red, the right half blue, and the frame covers all of it.
    expect(converted.grid[0]!.map((cell) => cell.color)).toEqual(['#e63746', '#e63746', '#2f6fed', '#2f6fed'])
  })

  it('shows what is inside the frame, so the beads on screen are the Pattern that Create makes', async () => {
    const wrapper = mountFrame()

    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')
    const converted = wrapper.emitted('create')![0]![0] as { grid: { color: string | null }[][] }

    // The frame is the whole 4 × 4 lattice here: the first row of beads on screen is the first row of the Pattern.
    expect(canvas.latest().slice(0, 4).map(({ color }) => color)).toEqual(['#e63746', '#e63746', '#2f6fed', '#2f6fed'])
    expect(converted.grid[0]!.map((cell) => cell.color)).toEqual(['#e63746', '#e63746', '#2f6fed', '#2f6fed'])
  })

  it('emits cancel without creating anything', async () => {
    const wrapper = mountFrame()

    await wrapper.find('[data-testid="convert-image-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('create')).toBeUndefined()
  })

  it('shows the adjustable color ceiling and how many colors the conversion found', () => {
    const wrapper = mountFrame()

    expect(wrapper.find('[data-testid="convert-image-max-colors"]').text()).toContain(
      String(DEFAULT_MAX_IMAGE_COLORS),
    )
    expect(wrapper.find('[data-testid="convert-image-found-colors"]').text()).toContain('2')
  })

  it('asks for a different color count from its steppers', async () => {
    const wrapper = mountFrame({ maxColors: 6 })

    await wrapper.find('[data-testid="convert-image-colors-increase"]').trigger('click')
    await wrapper.find('[data-testid="convert-image-colors-decrease"]').trigger('click')

    expect(wrapper.emitted('set-max-colors')).toEqual([[7], [5]])
  })

  it('stops the color count from going below the minimum', () => {
    const wrapper = mountFrame({ maxColors: MIN_IMAGE_COLORS })

    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="convert-image-colors-decrease"]').element.disabled,
    ).toBe(true)
  })

  it('reduces a busier picture to the count asked for', async () => {
    const busy: PixelData = {
      width: 8,
      height: 8,
      data: new Uint8ClampedArray(
        Array.from({ length: 64 }, (_unused, index) => [index * 3, 255 - index * 3, 90, 255]).flat(),
      ),
    }

    const wrapper = mountFrame({ image: busy, maxColors: 3 })
    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')

    const converted = wrapper.emitted('create')![0]![0] as { imageColors: string[] }
    expect(converted.imageColors.length).toBeLessThanOrEqual(3)
  })

  it('moves the picture under the frame when it is dragged', async () => {
    const wrapper = mountFrame({ image: twoBlocks(16, 8), pan: { x: 0.5, y: 0.5 } })

    await wrapper.find('[data-testid="convert-image-frame"] .convert-image-frame__box').trigger('mousedown', {
      button: 0,
      clientX: 100,
      clientY: 100,
    })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 140, clientY: 100 }))

    const panned = wrapper.emitted('pan')!
    expect(panned).toHaveLength(1)
    // Dragging the picture to the right shows more of its left-hand side, which is a smaller pan fraction.
    expect((panned[0]![0] as { x: number }).x).toBeLessThan(0.5)

    window.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('leaves a picture that covers the frame exactly where it is when dragged', async () => {
    const wrapper = mountFrame({ image: twoBlocks(8, 8), pan: { x: 0.5, y: 0.5 } })

    await wrapper.find('.convert-image-frame__box').trigger('mousedown', { button: 0, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }))

    expect(wrapper.emitted('pan')![0]![0]).toEqual({ x: 0.5, y: 0.5 })

    window.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('stops following the pointer once the button is released', async () => {
    const wrapper = mountFrame({ image: twoBlocks(16, 8) })

    await wrapper.find('.convert-image-frame__box').trigger('mousedown', { button: 0, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('mouseup'))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 0 }))

    expect(wrapper.emitted('pan')).toBeUndefined()
  })

  describe('while the picture is being dragged (ticket 104)', () => {
    /** Three colors side by side, each as wide as the frame: which one is under the frame depends only on the pan. */
    function threeBlocks(): PixelData {
      const rgba: number[][] = []
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 24; x += 1) {
          rgba.push(x < 8 ? [255, 0, 0, 255] : x < 16 ? [0, 255, 0, 255] : [0, 0, 255, 255])
        }
      }
      return { width: 24, height: 8, data: new Uint8ClampedArray(rgba.flat()) }
    }

    /** The distinct colors drawn, leaving out the empty beads where the lattice reaches past the picture. */
    const colorsOnScreen = () => [...new Set(canvas.latest().map(({ color }) => color))].filter((color) => color !== null)
    const foundColors = (wrapper: ReturnType<typeof mountFrame>) =>
      wrapper.find('[data-testid="convert-image-found-colors"]').text()

    async function startDragAt(wrapper: ReturnType<typeof mountFrame>) {
      await wrapper.find('.convert-image-frame__box').trigger('mousedown', { button: 0, clientX: 0, clientY: 0 })
    }

    it('shows the colors it had when the drag began, whatever the picture moves onto', async () => {
      const wrapper = mountFrame({ image: threeBlocks(), pan: { x: 0, y: 0.5 } })
      expect(colorsOnScreen()).toEqual(['#e63746'])

      await startDragAt(wrapper)
      await wrapper.setProps({ pan: { x: 1, y: 0.5 } })

      // Blue is under the frame now, but the beads keep to the red they began with, and so does the count.
      expect(colorsOnScreen()).toEqual(['#e63746'])
      expect(foundColors(wrapper)).toContain('1')
      window.dispatchEvent(new MouseEvent('mouseup'))
    })

    it('draws a block too big for beads coarsely while the picture moves, and as beads again once it is at rest (ticket 122)', async () => {
      draft.big = true
      const wrapper = mountFrame({ image: threeBlocks(), pan: { x: 0, y: 0.5 } })
      expect(draft.rendered).toHaveLength(0)
      expect(canvas.latest()).not.toHaveLength(0)

      await startDragAt(wrapper)
      await wrapper.setProps({ pan: { x: 1, y: 0.5 } })

      expect(draft.rendered).toHaveLength(1)
      expect(draft.rendered[0]).toMatchObject({ technique: 'loom' })
      const beadsBefore = canvas.renders()

      window.dispatchEvent(new MouseEvent('mouseup'))
      await nextTick()

      expect(canvas.renders()).toBe(beadsBefore + 1)
      expect(colorsOnScreen()).toEqual(['#2f6fed'])
    })

    it('draws beads all through a drag of a block that is not too big', async () => {
      const wrapper = mountFrame({ image: threeBlocks(), pan: { x: 0, y: 0.5 } })

      await startDragAt(wrapper)
      await wrapper.setProps({ pan: { x: 1, y: 0.5 } })

      expect(draft.rendered).toHaveLength(0)
      window.dispatchEvent(new MouseEvent('mouseup'))
    })

    it('works out the exact colors again when the drag ends', async () => {
      const wrapper = mountFrame({ image: threeBlocks(), pan: { x: 0, y: 0.5 } })
      await startDragAt(wrapper)
      await wrapper.setProps({ pan: { x: 1, y: 0.5 } })

      window.dispatchEvent(new MouseEvent('mouseup'))
      await nextTick()

      expect(colorsOnScreen()).toEqual(['#2f6fed'])
    })

    it('works out the exact colors when the pointer pauses, and holds those from then on', async () => {
      vi.useFakeTimers()
      const wrapper = mountFrame({ image: threeBlocks(), pan: { x: 0, y: 0.5 } })
      await startDragAt(wrapper)

      await wrapper.setProps({ pan: { x: 0.5, y: 0.5 } })
      expect(colorsOnScreen()).toEqual(['#e63746'])
      await vi.advanceTimersByTimeAsync(200)
      expect(colorsOnScreen()).toEqual(['#27ae60'])

      // Still dragging: the beads now hold the green the pause settled on.
      await wrapper.setProps({ pan: { x: 1, y: 0.5 } })
      expect(colorsOnScreen()).toEqual(['#27ae60'])

      window.dispatchEvent(new MouseEvent('mouseup'))
    })

    it('does not wait for a pause while the pointer keeps moving', async () => {
      vi.useFakeTimers()
      const wrapper = mountFrame({ image: threeBlocks(), pan: { x: 0, y: 0.5 } })
      await startDragAt(wrapper)

      for (const x of [0.2, 0.5, 0.8, 1]) {
        await wrapper.setProps({ pan: { x, y: 0.5 } })
        await vi.advanceTimersByTimeAsync(100)
      }

      expect(colorsOnScreen()).toEqual(['#e63746'])
      window.dispatchEvent(new MouseEvent('mouseup'))
    })

    it('creates exactly what a picture at rest in that place creates, however it got there', async () => {
      const dragged = mountFrame({ image: threeBlocks(), pan: { x: 0, y: 0.5 } })
      await startDragAt(dragged)
      await dragged.setProps({ pan: { x: 0.7, y: 0.5 } })
      window.dispatchEvent(new MouseEvent('mouseup'))
      await nextTick()
      const still = mountFrame({ image: threeBlocks(), pan: { x: 0.7, y: 0.5 } })

      await dragged.find('[data-testid="convert-image-create"]').trigger('click')
      await still.find('[data-testid="convert-image-create"]').trigger('click')

      expect(dragged.emitted('create')![0]![0]).toEqual(still.emitted('create')![0]![0])
      expect(foundColors(dragged)).toBe(foundColors(still))
    })

    it('shows the exact colors for a pan that arrives with no drag, such as Reset', async () => {
      const wrapper = mountFrame({ image: threeBlocks(), pan: { x: 0, y: 0.5 } })

      await wrapper.setProps({ pan: { x: 1, y: 0.5 } })

      expect(colorsOnScreen()).toEqual(['#2f6fed'])
    })
  })

  it('draws on a bitmap as big as the screen\'s density needs, so beads stay crisp', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    try {
      const wrapper = mountFrame()

      const canvasEl = wrapper.find<HTMLCanvasElement>('[data-testid="convert-image-canvas"]').element
      const cssWidth = Number.parseFloat(canvasEl.style.width)
      expect(canvasEl.width).toBe(Math.round(cssWidth * 2))
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true })
    }
  })
})

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ConvertImageFrame from './ConvertImageFrame.vue'
import { BEAD_CATALOG } from '../domain/beads'
import { CELL_SIZE_PX, gridWidthPx, rowHeightPx } from '../domain/grid'
import { DEFAULT_MAX_IMAGE_COLORS, MIN_IMAGE_COLORS, type PixelData } from '../domain/imageConversion'
import { CENTERED_PAN } from '../domain/imageFraming'

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

function mountFrame(overrides: Partial<InstanceType<typeof ConvertImageFrame>['$props']> = {}) {
  return mount(ConvertImageFrame, {
    props: {
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
  it('renders the picture as beads', () => {
    const wrapper = mountFrame()

    const rows = wrapper.findAll('[data-testid="convert-image-row"]')
    expect(rows).toHaveLength(4)
    expect(rows[0]!.findAll('[data-testid="convert-image-bead"]')).toHaveLength(4)
  })

  it('draws the frame over exactly the Pattern own cells', () => {
    const wrapper = mountFrame({ dimensions: { columns: 4, rows: 6 } })

    const outline = wrapper.find('[data-testid="convert-image-frame-outline"]')
    expect(outline.attributes('style')).toContain(`width: ${gridWidthPx('loom', 4)}px`)
  })

  it('reaches out past the frame when the picture hangs over it, and offsets the frame accordingly', () => {
    // Twice as wide as tall against a square frame: half the picture's width hangs off each side.
    const wrapper = mountFrame({ image: twoBlocks(16, 8) })

    const rows = wrapper.findAll('[data-testid="convert-image-row"]')
    expect(rows[0]!.findAll('[data-testid="convert-image-bead"]').length).toBeGreaterThan(4)

    const outline = wrapper.find('[data-testid="convert-image-frame-outline"]')
    expect(outline.attributes('style')).not.toContain('left: 0px')
  })

  it('reflows the beads when the picture is zoomed, without moving the frame', () => {
    const wrapper = mountFrame()
    const before = wrapper.find('[data-testid="convert-image-frame-outline"]').attributes('style')

    const zoomed = mountFrame({ zoom: 4 })

    expect(zoomed.findAll('[data-testid="convert-image-bead"]').length).toBeGreaterThan(
      wrapper.findAll('[data-testid="convert-image-bead"]').length,
    )
    // The frame is still 4 x 4 cells at 4 x 4 cells: zoom moves the picture, not the frame.
    expect(zoomed.find('[data-testid="convert-image-frame-outline"]').attributes('style')).toContain(
      `width: ${gridWidthPx('loom', 4)}px`,
    )
    expect(before).toContain(`width: ${gridWidthPx('loom', 4)}px`)
  })

  it('follows the Technique own geometry, staggering peyote rows', () => {
    const wrapper = mountFrame({ technique: 'peyote' })

    const rows = wrapper.findAll('[data-testid="convert-image-row"]')
    expect(rows[0]!.attributes('style')).toContain('margin-left: 0px')
    expect(rows[1]!.attributes('style')).toContain(`margin-left: ${CELL_SIZE_PX / 2}px`)
    expect(rows[1]!.attributes('style')).toContain(`margin-top: ${rowHeightPx('peyote') - CELL_SIZE_PX}px`)
  })

  it('emits the converted Pattern when Create is pressed', async () => {
    const wrapper = mountFrame()

    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')

    const created = wrapper.emitted('create')!
    expect(created).toHaveLength(1)
    const converted = created[0]![0] as { grid: { color: string | null }[][]; imageColors: string[] }
    expect(converted.grid).toHaveLength(4)
    expect(converted.grid[0]).toHaveLength(4)
    expect(new Set(converted.imageColors)).toEqual(new Set(['#ff0000', '#0000ff']))
    // The left half of the picture is red, the right half blue, and the frame covers all of it.
    expect(converted.grid[0]!.map((cell) => cell.color)).toEqual(['#ff0000', '#ff0000', '#0000ff', '#0000ff'])
  })

  it('shows what is inside the frame, so the beads on screen are the Pattern that Create makes', async () => {
    const wrapper = mountFrame()

    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')
    const converted = wrapper.emitted('create')![0]![0] as { grid: { color: string | null }[][] }

    const onScreen = wrapper
      .findAll('[data-testid="convert-image-row"]')
      .map((row) =>
        row.findAll('[data-testid="convert-image-bead"]').map((bead) => bead.attributes('style') ?? ''),
      )

    // rgb(255, 0, 0) is how a browser reports #ff0000 back through an inline style.
    expect(onScreen[0]![0]).toContain('rgb(255, 0, 0)')
    expect(onScreen[0]![3]).toContain('rgb(0, 0, 255)')
    expect(converted.grid[0]!.map((cell) => cell.color)).toEqual(['#ff0000', '#ff0000', '#0000ff', '#0000ff'])
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
})

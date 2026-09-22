import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PatternCanvas from './PatternCanvas.vue'
import { hoverBead, leaveSurface, pressBead, previewedBeads } from '../testUtils/beads'
import { createPattern, type Pattern, type Technique } from '../domain/pattern'
import { BEAD_CATALOG } from '../domain/beads'
import { GRID_BORDER_PX, RULER_GUTTER_PX, gridHeightPx, gridWidthPx } from '../domain/grid'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function pattern(widthMm: number, heightMm: number, technique: Technique = 'loom'): Pattern {
  return createPattern({
    technique,
    beadId: cubeBead.id,
    size: { width: widthMm, height: heightMm, unit: 'mm' },
  })
}

function boxSize(wrapper: ReturnType<typeof mount>) {
  const style = wrapper.find('[data-testid="pattern-canvas-viewport"]').attributes('style')!
  const [width, height] = [/width: ([\d.]+)px/, /height: ([\d.]+)px/].map(
    (pattern) => Number(style.match(pattern)![1]),
  )
  return { width: width!, height: height! }
}

describe('PatternCanvas', () => {
  it('turns the rotated/scaled element 90° as a plain view transform, without touching its own box size (ticket 28)', () => {
    const wrapper = mount(PatternCanvas, {
      props: { pattern: { ...pattern(30, 7.5), rotated: true }, zoom: 1 },
    })

    expect(wrapper.find('.pattern-canvas__rotate').attributes('style')).toContain('rotate(90deg)')
    // The box's own reserved footprint swaps to match the turned picture (contentWidth/contentHeight), while the
    // rotated element itself keeps the Pattern's unrotated width/height and is turned about its own center.
    const { width, height } = boxSize(wrapper)
    expect(height).toBeGreaterThan(width)
  })

  it('sizes its box to the Pattern rather than padding it out to a fixed square', () => {
    // 20 columns x 5 rows: a wide, short Pattern that a square box would band above and below.
    const wide = pattern(30, 7.5)

    const { width, height } = boxSize(mount(PatternCanvas, { props: { pattern: wide, zoom: 1 } }))

    expect(width).toBeGreaterThan(height)
    expect(width / height).toBeCloseTo(
      (RULER_GUTTER_PX * 2 + gridWidthPx('loom', wide.columns) + GRID_BORDER_PX * 2) /
        (RULER_GUTTER_PX * 2 + gridHeightPx('loom', wide.rows) + GRID_BORDER_PX * 2),
      1,
    )
  })

  it('leaves no unused space around the Pattern: the box is exactly the content it holds', () => {
    const { width, height } = boxSize(mount(PatternCanvas, { props: { pattern: pattern(15, 30), zoom: 1 } }))

    expect(width).toBe(RULER_GUTTER_PX * 2 + gridWidthPx('loom', 10) + GRID_BORDER_PX * 2)
    expect(height).toBe(RULER_GUTTER_PX * 2 + gridHeightPx('loom', 20) + GRID_BORDER_PX * 2)
  })

  it('has no ceiling of its own: a high zoom just grows the box, however large (ticket 27)', () => {
    // Fitting the Pattern to the real canvas area is usePatternZoom's job now, not a constant PatternCanvas enforces
    // itself; here it's handed a zoom that would never come out of a fit calculation, and it grows to match anyway.
    // (Containing that within the actual available screen space is CSS's max-width:100% + overflow:auto, not this.)
    const { width, height } = boxSize(mount(PatternCanvas, { props: { pattern: pattern(15, 15), zoom: 5 } }))

    expect(width).toBe(RULER_GUTTER_PX * 2 + (gridWidthPx('loom', 10) + GRID_BORDER_PX * 2) * 5)
    expect(height).toBe(RULER_GUTTER_PX * 2 + (gridHeightPx('loom', 10) + GRID_BORDER_PX * 2) * 5)
  })

  it('makes room for the grid outline on all four sides, at every zoom level', () => {
    for (const zoom of [0.25, 1, 3]) {
      const { width } = boxSize(mount(PatternCanvas, { props: { pattern: pattern(15, 15), zoom } }))

      expect(width).toBe(RULER_GUTTER_PX * 2 + (gridWidthPx('loom', 10) + GRID_BORDER_PX * 2) * zoom)
    }
  })

  it('rules the grid on all four edges', () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: pattern(15, 15), zoom: 1 } })

    for (const edge of ['row-start', 'row-end', 'column-start', 'column-end']) {
      expect(wrapper.find(`[data-testid="pattern-ruler-${edge}"]`).exists()).toBe(true)
    }
  })

  it('forwards a grid cell mousedown as its own cell-primary-down event', async () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: pattern(15, 15), zoom: 1 } })

    await pressBead(wrapper, 5)

    expect(wrapper.emitted('cell-primary-down')).toEqual([[0, 5]])
  })

  it('forwards a right mousedown as its own cell-secondary-down event', async () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: pattern(15, 15), zoom: 1 } })

    await pressBead(wrapper, 5, { button: 2 })

    expect(wrapper.emitted('cell-secondary-down')).toEqual([[0, 5]])
  })

  it('forwards hover and hover-end, and passes the preview props down to the grid', async () => {
    const wrapper = mount(PatternCanvas, {
      props: {
        pattern: pattern(15, 15),
        zoom: 1,
        previewCells: [{ row: 0, column: 5 }],
        previewColor: '#e63746',
      },
    })

    expect(previewedBeads(wrapper)).toEqual([{ row: 0, column: 5, color: '#e63746' }])

    await hoverBead(wrapper, 5)
    expect(wrapper.emitted('cell-hover')).toEqual([[0, 5]])

    await leaveSurface(wrapper)
    expect(wrapper.emitted('hover-end')).toHaveLength(1)
  })
})

describe('PatternCanvas drawing the Pattern on a Drawing surface (ticket 105)', () => {
  it('draws on a surface by default, and makes no element per bead', () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: pattern(30, 7.5), zoom: 1 } })

    expect(wrapper.find('[data-testid="pattern-surface-cells"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pattern-surface-overlay"]').exists()).toBe(true)
    // A handful of elements (the outline, the clip, two canvases), however many beads there are: none for a bead.
    expect(wrapper.find('[data-testid="pattern-surface"]').findAll('*').length).toBeLessThan(10)
  })

  it('keeps the four rulers around the Pattern, and the zoom box that scales them', () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: pattern(30, 7.5), zoom: 2 } })

    expect(wrapper.findAll('.pattern-ruler')).toHaveLength(4)
    expect(wrapper.find('.pattern-canvas__scaled').attributes('style')).toContain('scale(2)')
  })

  it('leaves the space the DOM grid took, so the rulers sit where they did', () => {
    const wide = pattern(30, 7.5)

    const wrapper = mount(PatternCanvas, { props: { pattern: wide, zoom: 1 } })

    const slot = wrapper.find('.pattern-canvas__grid-slot').attributes('style')
    expect(slot).toContain(`width: ${gridWidthPx('loom', wide.columns) + GRID_BORDER_PX * 2}px`)
    expect(slot).toContain(`height: ${gridHeightPx('loom', wide.rows) + GRID_BORDER_PX * 2}px`)
  })

  it('puts the surface one ruler gutter in from the box\'s corner, outside the transform that zooms and turns the rulers', () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: { ...pattern(30, 7.5), rotated: true }, zoom: 1 } })

    const layer = wrapper.find('.pattern-canvas__surface-layer')
    expect(layer.attributes('style')).toContain(`left: ${RULER_GUTTER_PX}px`)
    expect(layer.attributes('style')).toContain(`top: ${RULER_GUTTER_PX}px`)
    expect(wrapper.find('.pattern-canvas__scaled').find('[data-testid="pattern-surface-cells"]').exists()).toBe(false)
    // The renderer turns and scales the beads itself, so the surface is not inside the element that does it by CSS.
    expect(wrapper.find('.pattern-canvas__rotate').find('[data-testid="pattern-surface"]').exists()).toBe(false)
  })

  it('hands the Selection, Mirror\'s axes, the dimmed beads and the hover preview to the surface', () => {
    const selection = { top: 1, left: 1, rows: 2, columns: 2 }
    const mirrorAxisCounts = { columns: 1, rows: 0 }
    const dimmedCells = [{ row: 0, column: 0 }]
    const previewCells = [{ row: 2, column: 2 }]

    const wrapper = mount(PatternCanvas, {
      props: { pattern: pattern(30, 7.5), zoom: 1, selection, mirrorAxisCounts, dimmedCells, previewCells, previewColor: '#e63746' },
    })

    const surface = wrapper.findComponent({ name: 'PatternSurface' })
    expect(surface.props()).toMatchObject({ selection, mirrorAxisCounts, dimmedCells, previewCells, previewColor: '#e63746' })
  })

  it('re-emits the surface\'s pointer events as the DOM grid\'s, so its parent need not know which draws', async () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: pattern(30, 7.5), zoom: 1 } })
    const surface = wrapper.findComponent({ name: 'PatternSurface' })

    surface.vm.$emit('cell-primary-down', 1, 2)
    surface.vm.$emit('cell-primary-move', 1, 3)
    surface.vm.$emit('cell-secondary-down', 2, 2)
    surface.vm.$emit('cell-secondary-move', 2, 3)
    surface.vm.$emit('cell-hover', 3, 3)
    surface.vm.$emit('hover-end')

    expect(wrapper.emitted()).toMatchObject({
      'cell-primary-down': [[1, 2]],
      'cell-primary-move': [[1, 3]],
      'cell-secondary-down': [[2, 2]],
      'cell-secondary-move': [[2, 3]],
      'cell-hover': [[3, 3]],
      'hover-end': [[]],
    })
  })
})

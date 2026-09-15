import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PatternCanvas from './PatternCanvas.vue'
import { createPattern, type Pattern, type Technique } from '../domain/pattern'
import { BEAD_CATALOG } from '../domain/beads'
import {
  CANVAS_MAX_PX,
  GRID_BORDER_PX,
  RULER_GUTTER_PX,
  gridHeightPx,
  gridWidthPx,
} from '../domain/grid'

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
  it('leaves the zoom controls to the above-canvas panel', () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: pattern(15, 15), zoom: 1 } })

    expect(wrapper.find('[data-testid="zoom-in"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="zoom-level"]').exists()).toBe(false)
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

  it('stops growing at the screen-bounded maximum and scrolls instead', () => {
    const { width, height } = boxSize(mount(PatternCanvas, { props: { pattern: pattern(15, 15), zoom: 3 } }))

    expect(width).toBe(CANVAS_MAX_PX)
    expect(height).toBe(CANVAS_MAX_PX)
  })

  it('makes room for the grid outline on all four sides, at every zoom level', () => {
    for (const zoom of [0.25, 1, 3]) {
      const wrapper = mount(PatternCanvas, { props: { pattern: pattern(15, 15), zoom } })
      const frame = wrapper.find('.pattern-canvas__frame').attributes('style')!
      const frameWidth = Number(frame.match(/width: ([\d.]+)px/)![1])

      expect(frameWidth).toBe(
        RULER_GUTTER_PX * 2 + (gridWidthPx('loom', 10) + GRID_BORDER_PX * 2) * zoom,
      )
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

    await wrapper.findAll('[data-testid="grid-cell"]')[5]!.trigger('mousedown')

    expect(wrapper.emitted('cell-primary-down')).toEqual([[0, 5]])
  })

  it('forwards a right mousedown as its own cell-secondary-down event', async () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: pattern(15, 15), zoom: 1 } })

    await wrapper.findAll('[data-testid="grid-cell"]')[5]!.trigger('mousedown', { button: 2 })

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

    expect(wrapper.find('[data-testid="cell-preview"]').exists()).toBe(true)

    await wrapper.findAll('[data-testid="grid-cell"]')[5]!.trigger('mouseenter')
    expect(wrapper.emitted('cell-hover')).toEqual([[0, 5]])

    await wrapper.find('.pattern-grid').trigger('mouseleave')
    expect(wrapper.emitted('hover-end')).toHaveLength(1)
  })
})

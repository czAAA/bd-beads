import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PatternRuler from './PatternRuler.vue'
import { createPattern, type Pattern, type Technique } from '../domain/pattern'
import { BEAD_CATALOG } from '../domain/beads'
import {
  CELL_SIZE_PX,
  GRID_BORDER_PX,
  gridWidthPx,
  rowHeightPx,
  rowOffsetPx,
} from '../domain/grid'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

/** 10 columns x 20 rows. */
function pattern(technique: Technique = 'loom'): Pattern {
  return createPattern({
    technique,
    beadId: cubeBead.id,
    size: { width: 15, height: 30, unit: 'mm' },
  })
}

function mountRuler(options: {
  axis: 'row' | 'column'
  edge?: 'start' | 'end'
  zoom?: number
  technique?: Technique
}) {
  return mount(PatternRuler, {
    props: {
      pattern: pattern(options.technique),
      axis: options.axis,
      edge: options.edge ?? 'start',
      zoom: options.zoom ?? 1,
    },
  })
}

function labels(wrapper: ReturnType<typeof mountRuler>) {
  return wrapper.findAll('[data-testid="ruler-label"]')
}

describe('PatternRuler', () => {
  it('numbers every row from one, down the side of the grid', () => {
    const numbers = labels(mountRuler({ axis: 'row' })).map((label) => label.text())

    expect(numbers).toHaveLength(20)
    expect(numbers[0]).toBe('1')
    expect(numbers.at(-1)).toBe('20')
  })

  it('numbers every column from one, across the top of the grid', () => {
    const numbers = labels(mountRuler({ axis: 'column' })).map((label) => label.text())

    expect(numbers).toHaveLength(10)
    expect(numbers[0]).toBe('1')
    expect(numbers.at(-1)).toBe('10')
  })

  it('places each row number against its own row', () => {
    const rendered = labels(mountRuler({ axis: 'row' }))

    expect(rendered[0]!.attributes('style')).toContain(`top: ${GRID_BORDER_PX}px`)
    expect(rendered[3]!.attributes('style')).toContain(
      `top: ${GRID_BORDER_PX + 3 * CELL_SIZE_PX}px`,
    )
  })

  it("follows peyote's tighter row packing rather than assuming a plain rectangular grid", () => {
    const rendered = labels(mountRuler({ axis: 'row', technique: 'peyote' }))

    expect(rendered[3]!.attributes('style')).toContain(
      `top: ${GRID_BORDER_PX + 3 * rowHeightPx('peyote')}px`,
    )
  })

  it('shifts the bottom column numbers by the half-bead offset of the row they run along', () => {
    // 20 rows, so the last row is an odd one — shifted right by half a bead under peyote.
    const top = labels(mountRuler({ axis: 'column', edge: 'start', technique: 'peyote' }))
    const bottom = labels(mountRuler({ axis: 'column', edge: 'end', technique: 'peyote' }))

    expect(top[0]!.attributes('style')).toContain(`left: ${GRID_BORDER_PX}px`)
    expect(bottom[0]!.attributes('style')).toContain(
      `left: ${GRID_BORDER_PX + rowOffsetPx('peyote', 19)}px`,
    )
  })

  it('keeps row numbers in a straight column rather than staggering them row by row', () => {
    // Every row's number lines up on the same edge; the technique shows through the spacing, not a sideways jitter.
    const rendered = labels(mountRuler({ axis: 'row', edge: 'end', technique: 'peyote' }))

    expect(rendered.every((label) => label.attributes('style')!.includes('left: 0px'))).toBe(true)
  })

  it('keeps every column number inside the grid it rules, at any zoom', () => {
    for (const zoom of [0.25, 1, 3]) {
      for (const technique of ['loom', 'peyote', 'brick'] as const) {
        const rendered = labels(mountRuler({ axis: 'column', edge: 'end', zoom, technique }))
        const lastLeft = Number(
          rendered.at(-1)!.attributes('style')!.match(/left: (-?[\d.]+)px/)![1],
        )

        expect(lastLeft + CELL_SIZE_PX).toBeLessThanOrEqual(
          gridWidthPx(technique, 10) + GRID_BORDER_PX * 2,
        )
      }
    }
  })

  it('keeps numbers the same size on screen however far the canvas is zoomed', () => {
    const zoomedOut = mountRuler({ axis: 'row', zoom: 0.5 }).attributes('style')
    const zoomedIn = mountRuler({ axis: 'row', zoom: 2 }).attributes('style')

    // Written at 1/zoom so the canvas scale cancels out: 22px at 50%, 5.5px at 200%.
    expect(zoomedOut).toContain('font-size: 22px')
    expect(zoomedIn).toContain('font-size: 5.5px')
  })

  it('thins out to every other number when zooming out would crowd them', () => {
    const numbers = labels(mountRuler({ axis: 'column', zoom: 0.5 })).map((label) => label.text())

    expect(numbers).toEqual(['2', '4', '6', '8', '10'])
  })

  it('thins out further at the smallest zoom rather than turning into clutter', () => {
    const numbers = labels(mountRuler({ axis: 'row', zoom: 0.25 })).map((label) => label.text())

    expect(numbers).toEqual(['5', '10', '15', '20'])
  })
})

describe('PatternRuler line selection (ticket 123)', () => {
  it('is a real button per number, not hidden from assistive technology like a plain label', () => {
    const wrapper = mountRuler({ axis: 'row' })

    expect(wrapper.attributes('aria-hidden')).toBeUndefined()
    expect(labels(wrapper).every((label) => label.element.tagName === 'BUTTON')).toBe(true)
  })

  it('names each row button for what clicking it does, with its own number', () => {
    const rendered = labels(mountRuler({ axis: 'row' }))

    expect(rendered[0]!.attributes('aria-label')).toBe('Select row 1')
    expect(rendered[3]!.attributes('aria-label')).toBe('Select row 4')
  })

  it('names each column button the same way', () => {
    const rendered = labels(mountRuler({ axis: 'column' }))

    expect(rendered[0]!.attributes('aria-label')).toBe('Select column 1')
  })

  it('emits the whole row as a Selection when a row number is clicked', async () => {
    const wrapper = mountRuler({ axis: 'row' })

    await labels(wrapper)[3]!.trigger('click') // the 4th row, 1-based label "4"

    expect(wrapper.emitted('select')).toEqual([[{ top: 3, left: 0, rows: 1, columns: 10 }]])
  })

  it('emits the whole column as a Selection when a column number is clicked', async () => {
    const wrapper = mountRuler({ axis: 'column' })

    await labels(wrapper)[2]!.trigger('click') // the 3rd column

    expect(wrapper.emitted('select')).toEqual([[{ top: 0, left: 2, rows: 20, columns: 1 }]])
  })

  it('emits the same Selection whichever edge (start/end) the ruler is', async () => {
    const wrapper = mountRuler({ axis: 'row', edge: 'end' })

    await labels(wrapper)[0]!.trigger('click')

    expect(wrapper.emitted('select')).toEqual([[{ top: 0, left: 0, rows: 1, columns: 10 }]])
  })
})

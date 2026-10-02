import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PatternRuler from './PatternRuler.vue'
import { createPattern, type Pattern, type Technique } from '../domain/pattern'
import { BEAD_CATALOG } from '../domain/beads'
import {
  CELL_SIZE_PX,
  GRID_BORDER_PX,
  RULER_GUTTER_PX,
  gridWidthPx,
  rowOffsetPx,
} from '../domain/grid'
import { patternExtentPx, rowPitchPx } from '../rendering/patternRenderer'

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
  technique?: Technique
}) {
  return mount(PatternRuler, {
    props: {
      pattern: pattern(options.technique),
      axis: options.axis,
      edge: options.edge ?? 'start',
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
      `top: ${GRID_BORDER_PX + 3 * rowPitchPx('peyote')}px`,
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

    expect(rendered.every((label) => label.attributes('style')!.includes('left: -8px'))).toBe(true)
  })

  it('tucks the numbers 8px into the board padding, so they sit close to the beads (ticket 225)', () => {
    const left = labels(mountRuler({ axis: 'row', edge: 'start' }))[0]!.attributes('style')
    const top = labels(mountRuler({ axis: 'column', edge: 'start' }))[0]!.attributes('style')
    const bottom = labels(mountRuler({ axis: 'column', edge: 'end' }))[0]!.attributes('style')

    expect(left).toContain('right: -8px')
    expect(top).toContain('bottom: -8px')
    expect(bottom).toContain('top: -8px')
  })

  it('is carried toward the grid by stickPx, from either edge, and sits still without it (ticket 225)', () => {
    const stuck = (axis: 'row' | 'column', edge: 'start' | 'end', stickPx?: number) =>
      mount(PatternRuler, { props: { pattern: pattern(), axis, edge, stickPx } }).get('.pattern-ruler')

    expect(stuck('column', 'start', 40).attributes('style')).toContain('translateY(40px)')
    expect(stuck('column', 'end', 40).attributes('style')).toContain('translateY(-40px)')
    expect(stuck('row', 'start', 40).attributes('style')).toContain('translateX(40px)')
    expect(stuck('row', 'end', 40).attributes('style')).toContain('translateX(-40px)')
    expect(stuck('row', 'start', 40).classes()).toContain('pattern-ruler--stuck')
    expect(stuck('row', 'start', 0).attributes('style')).not.toContain('translate')
    expect(stuck('row', 'start', 0).classes()).not.toContain('pattern-ruler--stuck')
  })

  it('keeps every column number inside the grid it rules', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      const rendered = labels(mountRuler({ axis: 'column', edge: 'end', technique }))
      const lastLeft = Number(rendered.at(-1)!.attributes('style')!.match(/left: (-?[\d.]+)px/)![1])

      expect(lastLeft + CELL_SIZE_PX).toBeLessThanOrEqual(gridWidthPx(technique, 10) + GRID_BORDER_PX * 2)
    }
  })

  it('sizes the numbers and gutter at 100% zoom, leaving the canvas transform to scale them with the beads (ticket 212)', () => {
    const style = mountRuler({ axis: 'row' }).attributes('style')

    expect(style).toContain(`width: ${RULER_GUTTER_PX}px`)
  })

  it('numbers every bead on a Pattern far larger than would fit unthinned on screen', () => {
    const huge = createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 300, height: 600, unit: 'mm' } })
    const row = mount(PatternRuler, { props: { pattern: huge, axis: 'row', edge: 'start' } })
    const column = mount(PatternRuler, { props: { pattern: huge, axis: 'column', edge: 'start' } })

    expect(labels(row).map((label) => label.text())).toEqual(
      Array.from({ length: huge.rows }, (_unused, index) => String(index + 1)),
    )
    expect(labels(column)).toHaveLength(huge.columns)
  })
})

describe('PatternRuler number styling (Rulers card, variant A)', () => {
  it.each([
    ['row', ['5', '10', '15', '20']],
    ['column', ['5', '10']],
  ] as const)('marks every 5th %s number as a landmark', (axis, expected) => {
    const landmarks = labels(mountRuler({ axis }))
      .filter((label) => label.classes('pattern-ruler__label--landmark'))
      .map((label) => label.text())

    expect(landmarks).toEqual(expected)
  })

  it("leaves the current row's and the cursor's style to win over the 5th-number style", () => {
    const base = pattern()
    const wrapper = mount(PatternRuler, {
      props: {
        pattern: { ...base, rowProgress: { ...base.rowProgress, enabled: true, direction: 'rows', currentRow: 4 } },
        axis: 'row',
        edge: 'start',
      },
    })
    const current = labels(wrapper)[4]!

    expect(current.classes()).toContain('pattern-ruler__label--current')
    expect(current.classes()).not.toContain('pattern-ruler__label--landmark')

    const cursor = mount(PatternRuler, { props: { pattern: base, axis: 'row', edge: 'start', cursorIndex: 9 } })
    expect(labels(cursor)[9]!.classes()).toContain('pattern-ruler__label--cursor')
    expect(labels(cursor)[9]!.classes()).not.toContain('pattern-ruler__label--landmark')
  })

  it('keeps column numbers up to 99 horizontal and turns them from 100 (a quarter turn, reading upward)', () => {
    const wide = createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 160, height: 30, unit: 'mm' } })
    const rendered = labels(mount(PatternRuler, { props: { pattern: wide, axis: 'column', edge: 'start' } }))

    expect(wide.columns).toBeGreaterThan(100)
    expect(rendered[98]!.text()).toBe('99')
    expect(rendered[98]!.classes()).not.toContain('pattern-ruler__label--rotated')
    expect(rendered[99]!.text()).toBe('100')
    expect(rendered[99]!.classes()).toContain('pattern-ruler__label--rotated')
  })

  it('never turns row numbers', () => {
    const tall = createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 300, unit: 'mm' } })
    const rendered = labels(mount(PatternRuler, { props: { pattern: tall, axis: 'row', edge: 'start' } }))

    expect(tall.rows).toBeGreaterThan(100)
    expect(rendered.some((label) => label.classes('pattern-ruler__label--rotated'))).toBe(false)
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

  it("puts a brick stitch row's number level with the row it counts, however far down (ticket 121)", () => {
    const tall = createPattern({ technique: 'brick', beadId: cubeBead.id, size: { width: 15, height: 135, unit: 'mm' } })
    const wrapper = mount(PatternRuler, { props: { pattern: tall, axis: 'row', edge: 'start' } })
    const tops = wrapper.findAll('[data-testid="ruler-label"]').map((label) => label.attributes('style')!.match(/top: ([\d.]+)px/)![1])

    expect(tall.rows).toBeGreaterThan(80)
    expect(tops).toHaveLength(tall.rows)
    // Row n (1-based) starts at (n - 1) × rowPitchPx below the outline.
    const shown = wrapper.findAll('[data-testid="ruler-label"]').map((label) => Number(label.text()))
    shown.forEach((number, position) => {
      expect(Number(tops[position])).toBe(GRID_BORDER_PX + (number - 1) * rowPitchPx('brick'))
    })
    expect(wrapper.attributes('style')).toContain(`height: ${patternExtentPx('brick', tall.columns, tall.rows).height + GRID_BORDER_PX * 2}px`)
  })
})

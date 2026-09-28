import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ShrinkCropPicker from './ShrinkCropPicker.vue'
import { createPattern, type Pattern, toggleRotated } from '../domain/pattern'

function pattern(columns: number, rows: number, technique: Pattern['technique'] = 'loom'): Pattern {
  return createPattern({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
}

/**
 * A mount with a default `offset`, reading back whatever it last asked to update through (defineModel keeps its own
 * local value regardless of whether anything is actually listening for `update:offset`, so the component's later
 * pointer moves see it too, exactly as a real v-model binding would).
 */
function mountBound(target: Pattern, targetColumns: number, targetRows: number) {
  const wrapper = mount(ShrinkCropPicker, {
    props: { pattern: target, targetColumns, targetRows, offset: { columns: 0, rows: 0 } },
  })
  const currentOffset = () => wrapper.emitted('update:offset')!.at(-1)![0] as { columns: number; rows: number }
  return { wrapper, currentOffset }
}

const frame = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="crop-picker"]')

describe('ShrinkCropPicker (ticket 173)', () => {
  it('sizes its frame to fit the longer side of the current grid at 240px', () => {
    const { wrapper } = mountBound(pattern(4, 4), 2, 2)
    expect(frame(wrapper).attributes('style')).toContain('width: 240px')
    expect(frame(wrapper).attributes('style')).toContain('height: 240px')
  })

  it('keeps the aspect ratio for a non-square grid', () => {
    const { wrapper } = mountBound(pattern(8, 4), 4, 2)
    expect(frame(wrapper).attributes('style')).toContain('width: 240px')
    expect(frame(wrapper).attributes('style')).toContain('height: 120px')
  })

  it('previews the top-left region when hovered near the top-left corner', async () => {
    const { wrapper, currentOffset } = mountBound(pattern(4, 4), 2, 2)

    await frame(wrapper).trigger('pointermove', { clientX: 0, clientY: 0 })

    expect(currentOffset()).toEqual({ columns: 0, rows: 0 })
  })

  it('previews the bottom-right region when hovered near the bottom-right corner', async () => {
    const { wrapper, currentOffset } = mountBound(pattern(4, 4), 2, 2)

    await frame(wrapper).trigger('pointermove', { clientX: 240, clientY: 240 })

    expect(currentOffset()).toEqual({ columns: 2, rows: 2 })
  })

  it('previews a centered region when hovered over the middle', async () => {
    const { wrapper, currentOffset } = mountBound(pattern(4, 4), 2, 2)

    await frame(wrapper).trigger('pointermove', { clientX: 120, clientY: 120 })

    expect(currentOffset()).toEqual({ columns: 1, rows: 1 })
  })

  it('clamps to the grid, never previewing a region that runs off it', async () => {
    const { wrapper, currentOffset } = mountBound(pattern(4, 4), 2, 2)

    await frame(wrapper).trigger('pointermove', { clientX: -100, clientY: 500 })

    expect(currentOffset()).toEqual({ columns: 0, rows: 2 })
  })

  it('swaps which screen axis drives columns vs. rows once the Pattern is rotated', async () => {
    const upright = pattern(4, 8)
    const { wrapper, currentOffset } = mountBound(toggleRotated(upright), 4, 4)

    // Rotated, across is the grid's rows (8) and down is its columns (4); the frame is 240x120.
    await frame(wrapper).trigger('pointermove', { clientX: 240, clientY: 0 })

    expect(currentOffset()).toEqual({ columns: 0, rows: 4 })
  })

  it('snaps the row offset to an even number on peyote and brick stitch, so the stagger holds', async () => {
    const { wrapper, currentOffset } = mountBound(pattern(4, 8, 'peyote'), 4, 4)

    // displayHeight is 240 for an 8-row grid; clientY 90 works out to a raw offset of 1 before snapping.
    await frame(wrapper).trigger('pointermove', { clientX: 0, clientY: 90 })

    expect(currentOffset().rows % 2).toBe(0)
  })

  it('never restricts columns, which have no stagger to keep', async () => {
    const { wrapper, currentOffset } = mountBound(pattern(8, 4, 'peyote'), 4, 4)

    await frame(wrapper).trigger('pointermove', { clientX: 90, clientY: 0 })

    expect(currentOffset().columns).toBe(1)
  })

  it('re-clamps an already-chosen offset when the typed target grows back past it', async () => {
    const wrapper = mount(ShrinkCropPicker, {
      props: { pattern: pattern(4, 4), targetColumns: 2, targetRows: 2, offset: { columns: 2, rows: 2 } },
    })

    await wrapper.setProps({ targetColumns: 3, targetRows: 3 })

    expect(wrapper.emitted('update:offset')?.at(-1)).toEqual([{ columns: 1, rows: 1 }])
  })

  it('is named for assistive technology, with no keyboard equivalent implied', () => {
    const { wrapper } = mountBound(pattern(4, 4), 2, 2)

    expect(frame(wrapper).attributes('role')).toBe('img')
    expect(frame(wrapper).attributes('aria-label')).toBeTruthy()
  })
})

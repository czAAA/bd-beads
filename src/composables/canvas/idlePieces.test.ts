import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { piecesWhenIdle } from './idlePieces'

/** A solid block over the walk limit's step, so a walk takes several idle moments. */
function block(rows: number, columns: number) {
  return Object.fromEntries(Array.from({ length: rows }, (_row, row) => [row, Object.fromEntries(Array.from({ length: columns }, (_cell, column) => [column, '#000']))]))
}

afterEach(() => vi.useRealTimers())

describe('Pieces walked in idle time (ticket 0716)', () => {
  it('answers nothing at first, then the Pieces once idle moments have walked them, and a computed asking re-runs', async () => {
    vi.useFakeTimers()
    const beads = block(300, 300)
    const asked = computed(() => piecesWhenIdle('test', beads, { technique: 'loom' }, [{ row: 1, column: 1 }]))

    expect(asked.value).toBeUndefined()
    await vi.runAllTimersAsync()

    expect(asked.value?.pieces).toEqual([{ row: 0, column: 0, rows: 300, columns: 300, beads: 90_000 }])
    expect(asked.value?.anchored.size).toBe(1)
  })

  it('drops the walk of beads an edit replaced for the same asker', async () => {
    vi.useFakeTimers()
    const before = block(200, 200)
    const after = block(100, 100)
    piecesWhenIdle('edit', before, { technique: 'loom' })
    piecesWhenIdle('edit', after, { technique: 'loom' })
    await vi.runAllTimersAsync()

    expect(piecesWhenIdle('edit', after, { technique: 'loom' })?.pieces).toHaveLength(1)
    expect(piecesWhenIdle('other', before, { technique: 'loom' })).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { isCapable, testWorkers } from './vite.workers.ts'

// How many workers Vitest runs, by the machine (ticket 1143): two where memory is short, more where there is room.

describe('testWorkers', () => {
  it('keeps two on a machine that is not capable: the Pi, 4 cores and 8 GB with no swap', () => {
    expect(testWorkers({ cores: 4, memoryGb: 5 })).toBe(2)
  })

  it('runs half the cores on a capable machine: the MacBook, 10 cores and 16 GB', () => {
    expect(testWorkers({ cores: 10, memoryGb: 16 })).toBe(5)
  })

  it('runs no more than its memory holds, a worker to 3 GB', () => {
    expect(testWorkers({ cores: 16, memoryGb: 12 })).toBe(4)
  })

  it('runs the count set by hand, on any machine', () => {
    expect(testWorkers({ cores: 4, memoryGb: 5 }, '3')).toBe(3)
    expect(testWorkers({ cores: 10, memoryGb: 16 }, '1')).toBe(1)
  })

  it("keeps the machine's own count when the one set by hand is no count", () => {
    for (const none of ['', '0', '-2', '2.5', 'many']) expect(testWorkers({ cores: 10, memoryGb: 16 }, none)).toBe(5)
  })
})

describe('isCapable', () => {
  it('asks for 8 cores and 8 GB, both', () => {
    expect(isCapable({ cores: 8, memoryGb: 8 })).toBe(true)
    expect(isCapable({ cores: 4, memoryGb: 16 })).toBe(false)
    expect(isCapable({ cores: 12, memoryGb: 7 })).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { EXPORT_QUALITIES, parseExportQuality, shownMegabytes } from './exportQuality'

describe('parseExportQuality', () => {
  it('reads each quality by name', () => {
    for (const quality of EXPORT_QUALITIES) expect(parseExportQuality(quality)).toBe(quality)
  })

  it('reads nothing else', () => {
    expect(parseExportQuality('ultra')).toBeUndefined()
    expect(parseExportQuality('')).toBeUndefined()
  })
})

describe('shownMegabytes', () => {
  it.each([[100_000, 0.1], [100_001, 0.2], [1_400_000, 1.4], [1_400_001, 1.5], [3_150_000, 3.2], [9_950_000, 10], [9_999_999, 10], [10_000_001, 11], [123_000_000, 123]])('reads %s bytes as %s MB, never less', (bytes, mb) => {
    expect(shownMegabytes(bytes)).toBe(mb)
    expect(shownMegabytes(bytes)! * 1_000_000).toBeGreaterThanOrEqual(bytes)
  })

  it('reads nothing under 0.1 MB, where the line says "< 0.1 MB"', () => {
    expect(shownMegabytes(0)).toBeUndefined()
    expect(shownMegabytes(99_999)).toBeUndefined()
  })
})

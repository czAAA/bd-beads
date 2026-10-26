import { describe, expect, it } from 'vitest'
import { EXPORT_QUALITIES, parseExportQuality, roundedMegabytes } from './exportQuality'

describe('parseExportQuality', () => {
  it('reads each quality by name', () => {
    for (const quality of EXPORT_QUALITIES) expect(parseExportQuality(quality)).toBe(quality)
  })

  it('reads nothing else', () => {
    expect(parseExportQuality('ultra')).toBeUndefined()
    expect(parseExportQuality('')).toBeUndefined()
  })
})

describe('roundedMegabytes', () => {
  it.each([[300_000, 1], [4_400_000, 4], [11_800_000, 10], [13_000_000, 15], [123_000_000, 100], [480_000_000, 500]])('reads %s bytes as %s MB', (bytes, mb) => {
    expect(roundedMegabytes(bytes)).toBe(mb)
  })
})

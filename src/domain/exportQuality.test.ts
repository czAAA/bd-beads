import { describe, expect, it } from 'vitest'
import { EXPORT_QUALITIES, parseExportQuality } from './exportQuality'

describe('parseExportQuality', () => {
  it('reads each quality by name', () => {
    for (const quality of EXPORT_QUALITIES) expect(parseExportQuality(quality)).toBe(quality)
  })

  it('reads nothing else', () => {
    expect(parseExportQuality('ultra')).toBeUndefined()
    expect(parseExportQuality('')).toBeUndefined()
  })
})

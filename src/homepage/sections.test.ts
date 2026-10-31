import { describe, expect, it } from 'vitest'
import { SECTIONS, sectionAt } from './sections'

describe('sectionAt', () => {
  it('is the nearest viewport’s section, a viewport of scroll each', () => {
    expect(sectionAt(0, 800)).toBe(0)
    expect(sectionAt(399, 800)).toBe(0)
    expect(sectionAt(401, 800)).toBe(1)
    expect(sectionAt(1600, 800)).toBe(2)
  })

  it('holds to the last section on the page the unrolled free list adds below it, and to the first above the top', () => {
    expect(sectionAt(5000, 800)).toBe(SECTIONS.length - 1)
    expect(sectionAt(-40, 800)).toBe(0)
  })

  it('is the first before the page has a height', () => {
    expect(sectionAt(0, 0)).toBe(0)
  })
})

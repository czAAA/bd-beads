import { describe, expect, it } from 'vitest'
import { sectionAt } from './sections'

describe('sectionAt', () => {
  it('is the nearest viewport’s section, a viewport of scroll each', () => {
    expect(sectionAt(0, 800, 3)).toBe(0)
    expect(sectionAt(399, 800, 3)).toBe(0)
    expect(sectionAt(401, 800, 3)).toBe(1)
    expect(sectionAt(1600, 800, 3)).toBe(2)
  })

  it('holds to the last of however many sections there are, and to the first above the top', () => {
    expect(sectionAt(5000, 800, 3)).toBe(2)
    expect(sectionAt(5000, 800, 5)).toBe(4)
    expect(sectionAt(3200, 800, 5)).toBe(4)
    expect(sectionAt(-40, 800, 3)).toBe(0)
  })

  it('is the first before the page has a height', () => {
    expect(sectionAt(0, 0, 3)).toBe(0)
  })
})

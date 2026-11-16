import { describe, expect, it } from 'vitest'
import { convertLayoutFor } from './convertLayout'

describe('convertLayoutFor', () => {
  it.each([
    [390, 844, 'phone'],
    [360, 640, 'phone'],
    [599, 900, 'phone'],
    [600, 900, 'tablet'],
    [820, 1180, 'tablet'],
    [844, 390, 'side'],
    [1023, 700, 'side'],
    [1024, 700, 'desktop'],
    [1180, 820, 'desktop'],
    [1024, 1024, 'desktop'],
    [700, 700, 'side'],
  ] as const)('%i × %i is %s', (width, height, layout) => {
    expect(convertLayoutFor(width, height)).toBe(layout)
  })

  it('is the Desktop before the page has a size', () => {
    expect(convertLayoutFor(0, 0)).toBe('desktop')
  })
})

import { describe, expect, it } from 'vitest'
import { scrollToShow } from './tabScroll'

describe("What's inside's tabs keep the playing one in view (ticket 0825)", () => {
  const view = { left: 100, width: 400 }

  it('stays where it is while the tab shows whole', () => {
    expect(scrollToShow(view, { left: 200, width: 100 }, 24)).toBe(100)
  })

  it('scrolls on just far enough for a tab past the end, its room clear', () => {
    expect(scrollToShow(view, { left: 450, width: 100 }, 24)).toBe(450 + 100 + 24 - 400)
  })

  it('scrolls back for a tab before the start, never before the first', () => {
    expect(scrollToShow(view, { left: 60, width: 100 }, 24)).toBe(36)
    expect(scrollToShow(view, { left: 10, width: 100 }, 24)).toBe(0)
  })

  it('shows a tab wider than the view from its start', () => {
    expect(scrollToShow(view, { left: 300, width: 390 }, 24)).toBe(276)
  })
})

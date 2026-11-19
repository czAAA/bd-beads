import { afterEach, describe, expect, it } from 'vitest'
import { browserKeptView } from './keptView'

describe('browserKeptView (ticket 1108)', () => {
  afterEach(() => sessionStorage.clear())

  it("keeps a view in the tab's sessionStorage and reads it back", () => {
    const kept = { project: 'p1', view: { zoom: 2, middle: { x: 10, y: 20 } } }
    browserKeptView.write(kept)
    expect(browserKeptView.read()).toEqual(kept)
    expect(localStorage.length).toBe(0)
  })

  it('forgets the kept view when there is none to keep', () => {
    browserKeptView.write({ project: 'p1', view: { zoom: 2, middle: { x: 10, y: 20 } } })
    browserKeptView.write(undefined)
    expect(browserKeptView.read()).toBeUndefined()
  })
})

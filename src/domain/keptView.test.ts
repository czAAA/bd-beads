import { describe, expect, it } from 'vitest'
import { parseKeptView } from './keptView'

describe('parseKeptView (ticket 1108)', () => {
  it('reads a kept view whole', () => {
    const kept = { project: 'p1', view: { zoom: 2.5, middle: { x: 120.5, y: -40 } } }
    expect(parseKeptView(JSON.stringify(kept))).toEqual(kept)
  })

  it.each([
    ['nothing', null],
    ['not JSON', '{'],
    ['no Project', JSON.stringify({ view: { zoom: 1, middle: { x: 0, y: 0 } } })],
    ['a zoom of 0', JSON.stringify({ project: 'p1', view: { zoom: 0, middle: { x: 0, y: 0 } } })],
    ['no middle', JSON.stringify({ project: 'p1', view: { zoom: 1 } })],
    ['a middle that is not a number', JSON.stringify({ project: 'p1', view: { zoom: 1, middle: { x: 'a', y: 0 } } })],
  ])('reads %s as no kept view', (_, raw) => {
    expect(parseKeptView(raw)).toBeUndefined()
  })
})

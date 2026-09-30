import { beforeEach, describe, expect, it } from 'vitest'
import { isEditorChosen, markEditorChosen, overviewUrl, shouldOpenOverview } from './overviewRoute'

describe('shouldOpenOverview', () => {
  it.each([
    ['untouched', true],
    ['running', true],
    ['finished', false],
    ['off', false],
  ] as const)('with an empty library and the Tour %s: %s', (tour, expected) => {
    expect(shouldOpenOverview(true, tour, false)).toBe(expected)
  })

  it('never opens it once Patterns are saved', () => {
    expect(shouldOpenOverview(false, 'untouched', false)).toBe(false)
  })

  it('never opens it after the visitor chose the editor', () => {
    expect(shouldOpenOverview(true, 'untouched', true)).toBe(false)
  })
})

describe('the editor choice', () => {
  beforeEach(() => sessionStorage.clear())

  it('is remembered for the tab', () => {
    expect(isEditorChosen()).toBe(false)
    markEditorChosen()
    expect(isEditorChosen()).toBe(true)
  })
})

it('puts the Overview in a folder under the base path', () => {
  expect(overviewUrl('/bd-beads/')).toBe('/bd-beads/overview/')
  expect(overviewUrl('/')).toBe('/overview/')
})

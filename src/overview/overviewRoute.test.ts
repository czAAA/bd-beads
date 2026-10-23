import { beforeEach, describe, expect, it } from 'vitest'
import { isEditorChosen, markEditorChosen, overviewUrl, shouldOpenOverview } from './overviewRoute'

describe('shouldOpenOverview', () => {
  it('opens it for an empty library', () => {
    expect(shouldOpenOverview(true, false)).toBe(true)
  })

  it('never opens it once Projects are saved', () => {
    expect(shouldOpenOverview(false, false)).toBe(false)
  })

  it('never opens it after the visitor chose the editor', () => {
    expect(shouldOpenOverview(true, true)).toBe(false)
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

import { beforeEach, describe, expect, it } from 'vitest'
import { isEditorChosen, markEditorChosen, homepageUrl, shouldOpenHomepage } from './homepageRoute'

describe('shouldOpenHomepage', () => {
  it('opens it for an empty library', () => {
    expect(shouldOpenHomepage(true, false)).toBe(true)
  })

  it('never opens it once Projects are saved', () => {
    expect(shouldOpenHomepage(false, false)).toBe(false)
  })

  it('never opens it after the visitor chose the editor', () => {
    expect(shouldOpenHomepage(true, true)).toBe(false)
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

it('puts the Homepage in a folder under the base path', () => {
  expect(homepageUrl('/bd-beads/')).toBe('/bd-beads/homepage/')
  expect(homepageUrl('/')).toBe('/homepage/')
})

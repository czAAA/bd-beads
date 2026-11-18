import { beforeEach, describe, expect, it } from 'vitest'
import { editorUrl, hasArrived, homepageUrl, markArrived, shouldOpenEditor } from './homepageRoute'

describe('shouldOpenEditor', () => {
  it("opens it as a tab's first page when Projects are saved", () => {
    expect(shouldOpenEditor(2, false)).toBe(true)
  })

  it('never opens it for an empty library', () => {
    expect(shouldOpenEditor(0, false)).toBe(false)
  })

  it("never opens it for a library that couldn't be opened, which the Homepage explains", () => {
    expect(shouldOpenEditor('unopened', false)).toBe(false)
  })

  it('never opens it once the tab has shown the app', () => {
    expect(shouldOpenEditor(2, true)).toBe(false)
  })
})

describe('the arrival', () => {
  beforeEach(() => sessionStorage.clear())

  it('is remembered for the tab', () => {
    expect(hasArrived()).toBe(false)
    markArrived()
    expect(hasArrived()).toBe(true)
  })
})

it('puts the Homepage at the base path and the editor in a folder under it', () => {
  expect(homepageUrl('/bd-beads/')).toBe('/bd-beads/')
  expect(homepageUrl('/')).toBe('/')
  expect(editorUrl('/bd-beads/')).toBe('/bd-beads/app/')
  expect(editorUrl('/')).toBe('/app/')
})

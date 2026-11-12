import { describe, expect, it } from 'vitest'
import { firstProjectAddress, parseOpeningAddress, projectAddress, savedProjectsAddress } from './openingAddress'

describe('the editor\'s addresses (ticket 0716)', () => {
  it('reads back what each address asks for', () => {
    expect(parseOpeningAddress(new URL(savedProjectsAddress('/app/'), 'https://x.test').search)).toEqual({ savedProjects: true, firstProject: false })
    expect(parseOpeningAddress(new URL(projectAddress('/', 'a b/c'), 'https://x.test').search)).toEqual({ savedProjects: false, firstProject: false, project: 'a b/c' })
    expect(parseOpeningAddress(new URL(firstProjectAddress('/app/'), 'https://x.test').search)).toEqual({ savedProjects: false, firstProject: true })
  })

  it('asks for nothing at the plain address', () => {
    expect(parseOpeningAddress('')).toEqual({ savedProjects: false, firstProject: false })
    expect(parseOpeningAddress('?open=other')).toEqual({ savedProjects: false, firstProject: false })
  })

  it('carries the view a Project opens at once, from What\'s inside\'s Open editor from here (ticket 0879)', () => {
    const view = { zoom: 1.375, at: { row: 12, column: -3 } }
    const search = new URL(projectAddress('/', 'p1', view), 'https://x.test').search
    expect(parseOpeningAddress(search)).toEqual({ savedProjects: false, firstProject: false, project: 'p1', view })
  })

  it('opens at the usual view when the address\'s view is not one', () => {
    for (const search of ['?project=p1&zoom=abc&at=1,2', '?project=p1&zoom=1&at=1', '?project=p1&zoom=0&at=1,2', '?project=p1&at=1,2', '?zoom=1&at=1,2', '?project=p1&zoom=1&at=1.5,2']) {
      expect(parseOpeningAddress(search).view).toBeUndefined()
    }
  })
})

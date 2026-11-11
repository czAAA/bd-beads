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
})

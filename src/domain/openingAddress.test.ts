import { describe, expect, it } from 'vitest'
import { parseOpeningAddress, projectAddress, savedProjectsAddress } from './openingAddress'

describe('the editor\'s addresses (ticket 0716)', () => {
  it('reads back what each address asks for', () => {
    expect(parseOpeningAddress(new URL(savedProjectsAddress('/app/'), 'https://x.test').search)).toEqual({ savedProjects: true })
    expect(parseOpeningAddress(new URL(projectAddress('/', 'a b/c'), 'https://x.test').search)).toEqual({ savedProjects: false, project: 'a b/c' })
  })

  it('asks for nothing at the plain address', () => {
    expect(parseOpeningAddress('')).toEqual({ savedProjects: false })
    expect(parseOpeningAddress('?open=other')).toEqual({ savedProjects: false })
  })
})

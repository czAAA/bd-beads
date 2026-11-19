import { describe, expect, it } from 'vitest'
import { parseAccount, parseSignInReturn, waitOf } from './account'

describe('parseAccount', () => {
  it('reads an email and a plan, and a plan it does not know as the Free account', () => {
    expect(parseAccount({ email: 'ann@example.com', plan: 'free' })).toEqual({ email: 'ann@example.com', plan: 'free' })
    expect(parseAccount({ email: 'ann@example.com', plan: 'pro', name: 'Ann' })).toEqual({ email: 'ann@example.com', plan: 'pro' })
    expect(parseAccount({ email: 'ann@example.com', plan: 'team' })).toEqual({ email: 'ann@example.com', plan: 'free' })
  })

  it('reads nothing from what is not an account', () => {
    for (const value of [null, undefined, 'ann@example.com', {}, { email: 7 }, { email: 'not an address' }]) expect(parseAccount(value)).toBeUndefined()
  })
})

describe('parseSignInReturn', () => {
  it('reads how the sign-in ended from the address, and nothing from any other', () => {
    expect(parseSignInReturn('?account=signed-in')).toBe('signed-in')
    expect(parseSignInReturn('?project=p1&account=paused')).toBe('paused')
    for (const refusal of ['cancelled', 'failed']) expect(parseSignInReturn(`?account=${refusal}`)).toBe(refusal)
    for (const search of ['', '?account=', '?account=admin', '?sign-in']) expect(parseSignInReturn(search)).toBeUndefined()
  })
})

describe('waitOf', () => {
  it('words a wait in seconds up to a minute, then in whole minutes', () => {
    expect(waitOf(60)).toEqual({ unit: 'seconds', count: 60 })
    expect(waitOf(9.2)).toEqual({ unit: 'seconds', count: 10 })
    expect(waitOf(900)).toEqual({ unit: 'minutes', count: 15 })
    expect(waitOf(61)).toEqual({ unit: 'minutes', count: 2 })
  })
})

import { describe, expect, it } from 'vitest'
import { middleCut } from './middleCut'

/** A line that holds `room` characters, each one wide. */
const holds = (room: number) => (candidate: string) => Array.from(candidate).length <= room

describe('middleCut', () => {
  it('keeps a name that fits whole', () => {
    expect(middleCut('holiday.png', holds(11))).toBe('holiday.png')
  })

  it('cuts a long name in the middle, keeping its start and its end', () => {
    expect(middleCut('IMG_20261113_142233_HDR.png', holds(15))).toBe('IMG_202…HDR.png')
  })

  it('keeps as much of the name as the line holds', () => {
    const cut = middleCut('IMG_20261113_142233_HDR.png', holds(20))
    expect(Array.from(cut)).toHaveLength(20)
    expect(cut.startsWith('IMG_')).toBe(true)
    expect(cut.endsWith('HDR.png')).toBe(true)
  })

  it('never splits a character made of two code units', () => {
    expect(middleCut('🦊🦊🦊🦊🦊🦊.png', holds(6))).toBe('🦊🦊🦊…ng')
  })

  it('leaves only the mark when nothing else fits', () => {
    expect(middleCut('holiday.png', holds(1))).toBe('…')
  })
})

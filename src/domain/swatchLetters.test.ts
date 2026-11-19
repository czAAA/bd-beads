import { describe, expect, it } from 'vitest'
import { letterAt, lettersFor, lowestFreeLetter, typedLetter, withLetter } from './swatchLetters'

describe('letterAt', () => {
  it('counts A to Z, then AA, AB and on past AZ', () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(letterAt)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA'])
  })
})

describe('lowestFreeLetter', () => {
  it('is the first letter nobody has, so a freed letter is used again', () => {
    expect(lowestFreeLetter(new Set(['A', 'C']))).toBe('B')
    expect(lowestFreeLetter(new Set())).toBe('A')
  })
})

describe('lettersFor', () => {
  it('lettered in Palette order when nothing is stored (a Project from before letters)', () => {
    expect(lettersFor(['#111111', '#222222', '#333333'], undefined)).toEqual({ '#111111': 'A', '#222222': 'B', '#333333': 'C' })
  })

  it('keeps every stored letter when colors are reordered or one is deleted, and gives a new color the lowest unused', () => {
    const stored = { '#111111': 'A', '#222222': 'B', '#333333': 'C' }
    expect(lettersFor(['#333333', '#111111'], stored)).toEqual({ '#333333': 'C', '#111111': 'A' })
    expect(lettersFor(['#111111', '#333333', '#444444'], stored)).toEqual({ '#111111': 'A', '#333333': 'C', '#444444': 'B' })
  })

  it('goes on past Z', () => {
    const hexes = Array.from({ length: 28 }, (_, index) => `#${String(index).padStart(6, '0')}`)
    const letters = lettersFor(hexes, undefined)
    expect([letters[hexes[25]!], letters[hexes[26]!], letters[hexes[27]!]]).toEqual(['Z', 'AA', 'AB'])
  })

  it('drops an unreadable or repeated stored letter and gives that color another', () => {
    expect(lettersFor(['#111111', '#222222', '#333333'], { '#111111': 'B', '#222222': 'B', '#333333': 7 })).toEqual({ '#111111': 'B', '#222222': 'A', '#333333': 'C' })
  })
})

describe('a letter the maker types (ticket 1092)', () => {
  it('is one or two of A to Z in upper case, whatever else was typed', () => {
    expect(['r', 'Rd', 'red', '2c', ' b ', 'я', ''].map(typedLetter)).toEqual(['R', 'RD', 'RE', 'C', 'B', '', ''])
  })

  it('gives a color a letter nobody has', () => {
    expect(withLetter({ '#111111': 'A', '#222222': 'B' }, '#111111', 'R')).toEqual({ letters: { '#111111': 'R', '#222222': 'B' } })
  })

  it('trades letters with the color that has it, so no two colors share one', () => {
    const changed = withLetter({ '#111111': 'A', '#222222': 'B', '#333333': 'C' }, '#333333', 'A')
    expect(changed).toEqual({ letters: { '#111111': 'C', '#222222': 'B', '#333333': 'A' }, swapped: { hex: '#111111', letter: 'C' } })
  })

  it('changes nothing for the letter a color has, for no letter, and for a color the Palette lacks', () => {
    const letters = { '#111111': 'A' }
    expect([withLetter(letters, '#111111', 'A'), withLetter(letters, '#111111', ''), withLetter(letters, '#111111', '7'), withLetter(letters, '#999999', 'B')]).toEqual([undefined, undefined, undefined, undefined])
  })
})

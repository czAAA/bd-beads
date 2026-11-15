import { describe, expect, it } from 'vitest'
import { chordLine, chordParts, keyParts, MOD_KEY } from './chord'

describe('chordParts and chordLine (ticket 0993)', () => {
  const line = (chord: Parameters<typeof chordParts>[0], keyboard: 'apple' | 'other') => chordLine(chordParts(chord, keyboard))

  it('writes the modifier as ⌘ with no plus on an Apple keyboard, and Ctrl+ on any other', () => {
    expect(line({ key: 's', mod: true, label: 'S' }, 'apple')).toBe('⌘S')
    expect(line({ key: 's', mod: true, label: 'S' }, 'other')).toBe('Ctrl+S')
  })

  it('puts Shift before ⌘ on an Apple keyboard, as macOS writes it, and after Ctrl elsewhere', () => {
    expect(line({ key: 'z', mod: true, shift: true, label: 'Z' }, 'apple')).toBe('Shift+⌘Z')
    expect(line({ key: 'z', mod: true, shift: true, label: 'Z' }, 'other')).toBe('Ctrl+Shift+Z')
  })

  it('names Del ⌫ on an Apple keyboard only', () => {
    expect(line({ key: 'Delete', label: 'Del' }, 'apple')).toBe('⌫')
    expect(line({ key: 'Delete', shift: true, label: 'Del' }, 'apple')).toBe('Shift+⌫')
    expect(line({ key: 'Delete', label: 'Del' }, 'other')).toBe('Del')
  })

  it('keeps Ctrl alone as Ctrl on every keyboard', () => {
    expect(line({ key: 'y', ctrl: true, label: 'Y' }, 'apple')).toBe('Ctrl+Y')
  })

  it('writes a sign key with no separator before it', () => {
    expect(line({ key: '+', mod: true, label: '+' }, 'other')).toBe('Ctrl+')
    expect(line({ key: '-', mod: true, label: '−' }, 'other')).toBe('Ctrl−')
    expect(line({ key: '+', mod: true, label: '+' }, 'apple')).toBe('⌘+')
  })

  it('names a hand-written row\'s modifier for the keyboard and keeps the plus before a word', () => {
    expect(chordLine(keyParts([MOD_KEY, 'wheel'], 'apple'))).toBe('⌘+wheel')
    expect(chordLine(keyParts([MOD_KEY, 'wheel'], 'other'))).toBe('Ctrl+wheel')
    expect(chordLine(keyParts(['Space', 'drag'], 'apple'))).toBe('Space+drag')
  })
})

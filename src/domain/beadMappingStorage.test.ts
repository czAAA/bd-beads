import { beforeEach, describe, expect, it } from 'vitest'
import { loadColorBeadDefaults, saveColorBeadDefault } from './beadMappingStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('beadMappingStorage', () => {
  it('starts with no color mapped to any bead', () => {
    expect(loadColorBeadDefaults()).toEqual({})
  })

  it('remembers the bead a color defaults to', () => {
    saveColorBeadDefault('red', 'toho-cube-1.5mm')

    expect(loadColorBeadDefaults()).toEqual({ red: 'toho-cube-1.5mm' })
  })

  it('keeps one default per color, replacing the previous one', () => {
    saveColorBeadDefault('red', 'toho-cube-1.5mm')
    saveColorBeadDefault('red', 'miyuki-delica-11-0')

    expect(loadColorBeadDefaults()).toEqual({ red: 'miyuki-delica-11-0' })
  })

  it('unmaps a color when saved with no bead', () => {
    saveColorBeadDefault('red', 'toho-cube-1.5mm')
    saveColorBeadDefault('red', null)

    expect(loadColorBeadDefaults()).toEqual({})
  })

  it('ignores junk left in storage rather than breaking the app', () => {
    localStorage.setItem('bd-beads:color-bead-defaults', 'not json')

    expect(loadColorBeadDefaults()).toEqual({})
  })
})

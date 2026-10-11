import { describe, expect, it } from 'vitest'
import { fromHex } from './color'

describe('fromHex', () => {
  it('reads #rrggbb in either case', () => {
    expect(fromHex('#010203')).toEqual({ r: 1, g: 2, b: 3 })
    expect(fromHex('#E63746')).toEqual({ r: 230, g: 55, b: 70 })
  })

  it('reads #rgb as each digit doubled', () => {
    expect(fromHex('#fa0')).toEqual({ r: 255, g: 170, b: 0 })
  })

  it('answers undefined for anything else', () => {
    for (const bad of ['', '#', '#12', '#12345', '#1234567', '123456', '#gggggg', 'rgb(1, 2, 3)', '#ff00ff ']) {
      expect(fromHex(bad)).toBeUndefined()
    }
  })
})

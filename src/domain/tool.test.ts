import { describe, expect, it } from 'vitest'
import { toolCapabilities } from './tool'

describe('toolCapabilities', () => {
  it('lets the Hand tool move the canvas and nothing else', () => {
    expect(toolCapabilities('hand')).toMatchObject({ moves: true, selects: false, nearestOnPress: false, blocksMargin: false })
  })

  it('refuses the Frame margin to Paint and Fill, which place beads, and lands a Fill press on the nearest bead', () => {
    expect(toolCapabilities('paint')).toMatchObject({ blocksMargin: true, nearestOnPress: false, selects: false })
    expect(toolCapabilities('fill')).toMatchObject({ blocksMargin: true, nearestOnPress: true, selects: false })
    expect(toolCapabilities('erase')).toMatchObject({ blocksMargin: false, nearestOnPress: false })
  })

  it('makes Select and Piece select, and only Select reads a press at the nearest bead wherever it lands', () => {
    expect(toolCapabilities('select')).toMatchObject({ selects: true, selectsAnywhere: true, blocksMargin: false })
    expect(toolCapabilities('piece')).toMatchObject({ selects: true, selectsAnywhere: false })
  })

  it('refuses the margin to an armed paste with any tool, but not while a color is being picked', () => {
    expect(toolCapabilities('select', { pasteArmed: true }).blocksMargin).toBe(true)
    expect(toolCapabilities('paint', { picking: true })).toMatchObject({ blocksMargin: false, picking: true })
    expect(toolCapabilities('select', { pasteArmed: true, picking: true }).blocksMargin).toBe(false)
  })

  it('gives no tool any capability when none is in hand', () => {
    expect(toolCapabilities(undefined)).toEqual({
      tool: undefined, moves: false, selects: false, selectsAnywhere: false, nearestOnPress: false,
      blocksMargin: false, picking: false, markerHidden: false, settingFrame: false,
    })
  })
})

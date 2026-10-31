// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { type Technique } from './weave'
import { nearestColor, reducePictureColors } from './imageColors'
import { NO_COLOR, frameColors, sampleLatticePacked, type PixelData } from './imageConversion'
import { convertFrame, matchFoundColors, sourceTargets } from './convertColors'
import { BUILT_IN_COLORS } from './palette'
import { partLattice } from './imageFraming'
import { approximatePreviewColors, exactPreviewColors, heldColorLookup, nearestColorLookup } from './framingPreview'

function pack(hex: string): number {
  return Number.parseInt(hex.slice(1), 16)
}

/** A picture with many colors and some see-through pixels, so the reduction has real work to do. */
function busyImage(width: number, height: number): PixelData {
  const data: number[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.push((x * 37) % 256, (y * 91) % 256, ((x + y) * 13) % 256, (x + 2 * y) % 7 === 0 ? 30 : 255)
    }
  }
  return { width, height, data: new Uint8ClampedArray(data) }
}

describe('nearestColorLookup', () => {
  it('answers what nearestColor answers, for every packed color it is asked', () => {
    const colors = ['#000000', '#ffffff', '#e63746', '#2f6fed', '#27ae60']
    const lookup = nearestColorLookup(colors)

    for (let value = 0; value < 0x1000000; value += 0x30f0b) {
      const hex = `#${value.toString(16).padStart(6, '0')}`
      expect(lookup(value)).toBe(nearestColor(colors, hex))
    }
  })

  it('breaks a tie towards the earlier color, as nearestColor does', () => {
    // A true tie: the same color written twice, so neither is nearer than the other.
    const colors = ['#ff0000', '#FF0000']

    expect(nearestColorLookup(colors)(pack('#fe0000'))).toBe(nearestColor(colors, '#fe0000'))
    expect(nearestColorLookup(colors)(pack('#fe0000'))).toBe('#ff0000')
  })

  it('says nothing for a cell with no color, and for no colors to choose from', () => {
    expect(nearestColorLookup(['#ffffff'])(NO_COLOR)).toBeUndefined()
    expect(nearestColorLookup([])(pack('#123456'))).toBeUndefined()
  })
})

describe('heldColorLookup', () => {
  it('shows the result of the nearest found color, and nothing for an emptied one', () => {
    const held = heldColorLookup([
      { pictureHex: '#ff0000', result: { hex: '#e63746' } },
      { pictureHex: '#ffffff' },
    ])

    expect(held(pack('#ee1111'))).toBe('#e63746')
    expect(held(pack('#f0f0f0'))).toBeUndefined()
    expect(held(NO_COLOR)).toBeUndefined()
  })
})

describe('exactPreviewColors', () => {
  it.each(['loom', 'peyote', 'brick'] as const)(
    'shows the Project inside the frame and the held color around it (%s)',
    (technique: Technique) => {
      const image = busyImage(60, 45)
      const part = { x: 12, y: 20, width: 24, height: 16 }
      const pixelsPerBead = { x: 1.2, y: 1 }
      const dimensions = { columns: 20, rows: 16 }

      for (const maxColors of [3, 7, 14]) {
        const lattice = partLattice({ image, part, pixelsPerBead, dimensions, technique })

        const packed = sampleLatticePacked({ image, part, pixelsPerBead, technique, lattice })
        const { raw, counts } = frameColors(packed, lattice, dimensions)
        const reduced = reducePictureColors(counts, maxColors)
        const found = matchFoundColors(reduced, sourceTargets('default', BUILT_IN_COLORS, []), new Map())
        const grid = convertFrame(raw, reduced, found)
        const held = heldColorLookup(found)
        const expected = Array.from({ length: lattice.rows }, (_row, row) =>
          Array.from({ length: lattice.columns }, (_cell, column) => {
            const inFrame = grid[row - lattice.frameRow]?.[column - lattice.frameColumn]
            return inFrame ? (inFrame.color ?? undefined) : held(packed[row * lattice.columns + column]!)
          }),
        ).flat()

        expect(exactPreviewColors(packed, lattice, dimensions, grid, held)).toEqual(expected)
        expect(lattice.frameColumn).toBeGreaterThan(0)
      }
    },
  )
})

describe('approximatePreviewColors', () => {
  it('puts every bead to its held color, the frame\'s included', () => {
    const held = heldColorLookup([
      { pictureHex: '#ff0000', result: { hex: '#ff0000' } },
      { pictureHex: '#0000ff', result: { hex: '#0000ff' } },
    ])
    const sampled = Int32Array.from([pack('#ee1111'), pack('#2222dd'), NO_COLOR, pack('#ffffff')])

    expect(approximatePreviewColors(sampled, held)).toEqual(['#ff0000', '#0000ff', undefined, '#ff0000'])
  })

  it('keeps to the held colors however the picture has moved, never inventing one', () => {
    const image = busyImage(60, 45)
    const dimensions = { columns: 20, rows: 15 }
    const pixelsPerBead = { x: 1, y: 1 }
    const colors = ['#1a1a1a', '#e63746', '#2f6fed']
    const held = heldColorLookup(colors.map((hex) => ({ pictureHex: hex, result: { hex } })))

    for (const part of [{ x: 0, y: 0, width: 20, height: 15 }, { x: 20, y: 15, width: 20, height: 15 }, { x: 40, y: 30, width: 20, height: 15 }]) {
      const lattice = partLattice({ image, part, pixelsPerBead, dimensions, technique: 'loom' })
      const packed = sampleLatticePacked({ image, part, pixelsPerBead, technique: 'loom', lattice })

      const shown = approximatePreviewColors(packed, held)

      expect(shown).toHaveLength(lattice.rows * lattice.columns)
      expect(shown.every((color) => color === undefined || colors.includes(color))).toBe(true)
    }
  })

  it('leaves a bead empty where there are no held colors', () => {
    expect(approximatePreviewColors(Int32Array.from([pack('#123456')]), heldColorLookup([]))).toEqual([undefined])
  })
})

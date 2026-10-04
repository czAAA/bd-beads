// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Bead } from './beads'
import { computeGridDimensions, type Technique } from './grid'
import { nearestColor } from './imageColors'
import {
  NO_COLOR,
  convertSampledFrame,
  previewColorOutsideFrame,
  sampleLattice,
  sampleLatticePacked,
  type PixelData,
} from './imageConversion'
import { CENTERED_PAN, frameSizeMm, framingView, previewLattice } from './imageFraming'
import { approximatePreviewColors, exactPreviewColors, nearestColorLookup } from './framingPreview'

const bead: Bead = {
  id: 'test-cube',
  brand: 'Test',
  name: 'Cube',
  size: '1.5mm',
  formFactor: 'cube',
  color: null,
  widthMm: 1.5,
  heightMm: 1.5,
}

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
    // #808080 is exactly as far from black as from #ffffff plus one; pick a true tie: 0x00 and 0x02 around 0x01.
    const colors = ['#020000', '#000000']

    expect(nearestColorLookup(colors)(pack('#010000'))).toBe(nearestColor(colors, '#010000'))
    expect(nearestColorLookup(colors)(pack('#010000'))).toBe('#020000')
  })

  it('says nothing for a cell with no color, and for no colors to choose from', () => {
    expect(nearestColorLookup(['#ffffff'])(NO_COLOR)).toBeUndefined()
    expect(nearestColorLookup([])(pack('#123456'))).toBeUndefined()
  })
})

describe('exactPreviewColors', () => {
  it.each(['loom', 'peyote', 'brick'] as const)(
    'is what the preview showed before it was drawn by the renderer: the Project inside the frame, the nearest Image color around it (%s)',
    (technique: Technique) => {
      const image = busyImage(60, 45)
      const dimensions = computeGridDimensions({ widthMm: 30, heightMm: 24 }, bead)
      const frame = frameSizeMm(technique, dimensions, bead)

      for (const maxColors of [3, 7, 14]) {
        const view = framingView(image, frame, 2.5, { x: 0.2, y: 0.7 })
        const lattice = previewLattice({ view, frame, dimensions, bead, technique })

        // The original chain, written out as it was.
        const sampled = sampleLattice({ image, view, technique, bead, lattice })
        const converted = convertSampledFrame(sampled, lattice, dimensions, maxColors)
        const before = Array.from({ length: lattice.rows }, (_row, row) =>
          Array.from({ length: lattice.columns }, (_cell, column) => {
            const inFrame = converted.grid[row - lattice.frameRow]?.[column - lattice.frameColumn]
            return inFrame
              ? (inFrame.color ?? undefined)
              : previewColorOutsideFrame(converted.imageColors, sampled[row]?.[column])
          }),
        ).flat()

        const packed = sampleLatticePacked({ image, view, technique, bead, lattice })

        expect(exactPreviewColors(packed, lattice, dimensions, converted)).toEqual(before)
      }
    },
  )
})

describe('approximatePreviewColors', () => {
  it('puts every bead to the nearest of the held colors, the frame\'s included', () => {
    const held = ['#ff0000', '#0000ff']
    const sampled = Int32Array.from([pack('#ee1111'), pack('#2222dd'), NO_COLOR, pack('#ffffff')])

    expect(approximatePreviewColors(sampled, held)).toEqual(['#ff0000', '#0000ff', undefined, '#ff0000'])
  })

  it('keeps to the held colors however the picture has moved, never inventing one', () => {
    const image = busyImage(60, 45)
    const dimensions = computeGridDimensions({ widthMm: 30, heightMm: 24 }, bead)
    const frame = frameSizeMm('loom', dimensions, bead)
    const held = ['#1a1a1a', '#e63746', '#2f6fed']

    for (const pan of [{ x: 0, y: 0 }, CENTERED_PAN, { x: 1, y: 1 }]) {
      const view = framingView(image, frame, 3, pan)
      const lattice = previewLattice({ view, frame, dimensions, bead, technique: 'loom' })
      const packed = sampleLatticePacked({ image, view, technique: 'loom', bead, lattice })

      const colors = approximatePreviewColors(packed, held)

      expect(colors).toHaveLength(lattice.rows * lattice.columns)
      expect(colors.every((color) => color === undefined || held.includes(color))).toBe(true)
    }
  })

  it('leaves a bead empty where the picture is, and where the held colors are none', () => {
    expect(approximatePreviewColors(Int32Array.from([pack('#123456')]), [])).toEqual([undefined])
  })
})

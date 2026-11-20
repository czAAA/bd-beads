import { describe, expect, it } from 'vitest'
import { fromHex, luma } from './color'
import { BLACK_TONE, printTones } from './printTones'

// Black and white's tones (ticket 1096; PrintBlackAndWhite card): each color of the piece on paper, a 10, 20 or 30% tint,
// or solid black, by how dark it is.

const grey = (value: number) => `#${value.toString(16).padStart(2, '0').repeat(3)}`
const counted = (...colors: [string, number][]) => colors.map(([hex, count]) => ({ hex, count }))

describe('printTones', () => {
  it('prints a piece of one color on paper', () => {
    expect(printTones(counted(['#e63746', 100]))).toEqual({ '#e63746': 0 })
  })

  it('gives each color its own tone from paper to solid black when there are no more colors than tones', () => {
    const tones = printTones(counted([grey(250), 40], [grey(200), 30], [grey(130), 20], [grey(10), 10]))

    expect(tones).toEqual({ [grey(250)]: 0, [grey(200)]: 0.1, [grey(130)]: 0.3, [grey(10)]: BLACK_TONE })
  })

  it('prints the darkest colors solid black only while they cover no more than a quarter of the beads', () => {
    expect(printTones(counted(['#ffffff', 75], ['#000000', 25]))).toEqual({ '#ffffff': 0, '#000000': BLACK_TONE })
    // A large dark ground takes the darkest tint instead of a sheet of toner.
    expect(printTones(counted(['#ffffff', 74], ['#000000', 26]))).toEqual({ '#ffffff': 0, '#000000': 0.3 })
  })

  it('prints no solid black when the darkest color is not dark, its letter black on the color pages', () => {
    expect(printTones(counted(['#ffffff', 95], ['#909090', 5]))).toEqual({ '#ffffff': 0, '#909090': 0.3 })
  })

  it('shares a tone among the colors closest in grey when there are more colors than tones, cut at the widest gaps', () => {
    const tones = printTones(counted([grey(255), 10], [grey(250), 10], [grey(190), 10], [grey(185), 10], [grey(120), 10], [grey(60), 10], [grey(55), 10], [grey(5), 5]))

    expect(tones).toEqual({
      [grey(255)]: 0,
      [grey(250)]: 0,
      [grey(190)]: 0.1,
      [grey(185)]: 0.1,
      [grey(120)]: 0.2,
      [grey(60)]: 0.3,
      [grey(55)]: 0.3,
      [grey(5)]: BLACK_TONE,
    })
  })

  it('never prints a lighter color darker than a darker one, and uses only paper, the three tints and black', () => {
    let state = 11
    const random = () => (state = (state * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648
    const colors = Array.from({ length: 40 }, () => ({ hex: `#${Math.floor(random() * 0xffffff).toString(16).padStart(6, '0')}`, count: 1 + Math.floor(random() * 100) }))
    const tones = printTones(colors)
    const byGrey = [...colors].sort((a, b) => luma(fromHex(b.hex)!) - luma(fromHex(a.hex)!))

    for (let index = 1; index < byGrey.length; index += 1) expect(tones[byGrey[index]!.hex]).toBeGreaterThanOrEqual(tones[byGrey[index - 1]!.hex]!)
    expect(Object.values(tones).every((tone) => [0, 0.1, 0.2, 0.3, BLACK_TONE].includes(tone))).toBe(true)
  })
})

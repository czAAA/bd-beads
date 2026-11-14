import { afterEach, describe, expect, it, vi } from 'vitest'
import { contrastRatio, fromHex, luma } from '../domain/color'
import { recordingContext } from '../testUtils/recordingContext'
import { blendOver, DARK_THEME, drawFlatBead, fadeOver, flatLook, LIGHT_THEME, ownRim, parseColor, PRINT_THEME, PROJECT_THEMES, type BeadShape } from './beadLook'

// The own-color rim and satin light (ticket 1003, BeadBoard card, Canvas look): how one bead is drawn on screen in light
// and dark. The flat bead of exports and high contrast is in projectRenderer.dom.test.ts.

const bead = (overrides: Partial<BeadShape> = {}): BeadShape => ({
  x: 40,
  y: 20,
  size: 20,
  cornerRadius: 0,
  color: '#f2c94c',
  dimmed: false,
  deviceScale: 1,
  theme: LIGHT_THEME,
  ...overrides,
})

/** The gradient stops of the satin light drawn, as [offset, color]. */
function satinStops(named: ReturnType<typeof recordingContext>['named']): [number, string][] {
  return named('createRadialGradient')[0]!.args.at(-1) as [number, string][]
}

const opacityOf = (rgba: string) => Number(/,\s*([\d.e-]+)\)$/.exec(rgba)![1])

describe('the own-color rim', () => {
  it('is the bead\'s color 18% toward black, or 11% toward white where that stands under 1.3:1 off it', () => {
    expect(ownRim('#f2c94c')).toBe('rgb(198, 165, 62)')
    expect(ownRim('#ffffff')).toBe('rgb(209, 209, 209)')
    // Near-black and a deep navy take the lighter rim: the darker one would vanish on them.
    expect(ownRim('#1a1a1a')).toBe('rgb(51, 51, 51)')
    expect(ownRim('#1f3a7a')).toBe('rgb(56, 80, 137)')
  })

  it('stands about 1.5:1 off a yellow bead and 1.4:1 off a black one, the same in light and dark', () => {
    const ratio = (color: string) => contrastRatio(fromHex(color)!, parseColor(ownRim(color))!)
    expect(ratio('#f2c94c')).toBeCloseTo(1.5, 1)
    expect(ratio('#1a1a1a')).toBeCloseTo(1.4, 1)
  })

  it.each([['light', LIGHT_THEME], ['dark', DARK_THEME]] as const)('fills the whole cell in %s, so no Canvas shows between two beads, and the body half a pixel in', (_name, theme) => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ theme }))

    expect(named('fillRect').map((call) => [call.fillStyle, ...call.args])).toEqual([[ownRim('#f2c94c'), 40, 20, 20, 20]])
    expect(named('roundRect').map((call) => call.args)).toEqual([[40.5, 20.5, 19, 19, 1.25]])
    expect(named('fill')[0]!.fillStyle).toBe('#f2c94c')
  })

  it('keeps the Technique\'s corner on the body, less the inset', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ cornerRadius: 6 }))

    expect(named('roundRect').map((call) => call.args)).toEqual([[40.5, 20.5, 19, 19, 5.5]])
  })

  it('is made from the color the bead is drawn in: a finished row\'s faded one', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ dimmed: true }))

    const faded = fadeOver('#f2c94c', LIGHT_THEME.background, 0.5)
    expect(named('fillRect')[0]!.fillStyle).toBe(ownRim(faded))
    expect(named('fill')[0]!.fillStyle).toBe(faded)
  })

  it('leaves an empty position as it is, in the faint `bead-rim` a gap in from its cell', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ color: null }))

    expect(named('fillRect').map((call) => [call.fillStyle, ...call.args])).toEqual([
      [blendOver(LIGHT_THEME.rim, LIGHT_THEME.emptyBead), 40.5, 20.5, 19, 19],
      [LIGHT_THEME.emptyBead, 41.25, 21.25, 17.5, 17.5],
    ])
    expect(named('createRadialGradient')).toHaveLength(0)
  })

  it.each([['exports', PRINT_THEME], ['high contrast', PROJECT_THEMES.contrast]] as const)('is not drawn in %s, which keep the flat bead', (_name, theme) => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ theme }))

    expect(named('fillRect').map((call) => call.fillStyle)).toEqual([blendOver(theme.rim, '#f2c94c'), '#f2c94c'])
    expect(named('createRadialGradient')).toHaveLength(0)
  })
})

describe('the satin light', () => {
  it('is one ellipse centred 50% across and 46% down the body, 40% of its width and 44% of its height in radius', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead())

    expect(named('translate').map((call) => call.args)).toEqual([[40.5 + 19 * 0.5, 20.5 + 19 * 0.46]])
    expect(named('scale').map((call) => call.args)).toEqual([[19 * 0.4, 19 * 0.44]])
    expect(named('createRadialGradient')[0]!.args.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 1])
    expect(named('arc')[0]!.args.slice(0, 3)).toEqual([0, 0, 1])
  })

  it('is the bead\'s color halfway to white, 38% at its centre, 21% at 45% of its radius and gone at its edge', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead())

    // Yellow is light enough to take the whole light: its lift is under 3 plus 7.5% of its luma.
    expect(satinStops(named)).toEqual([
      [0, 'rgba(249, 228, 166, 0.38)'],
      [0.45, 'rgba(249, 228, 166, 0.21)'],
      [1, 'rgba(249, 228, 166, 0)'],
    ])
  })

  it('is held to the bead\'s own lightness: a black bead\'s lifts its centre by 3 plus 7.5% of its luma, no more', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ color: '#1a1a1a' }))

    const [centre, middle] = satinStops(named)
    const own = luma(fromHex('#1a1a1a')!)
    const light = luma(parseColor(centre![1].replace(/rgba\((\d+), (\d+), (\d+), .*\)/, 'rgb($1, $2, $3)'))!)
    expect((light - own) * opacityOf(centre![1])).toBeCloseTo(3 + 0.075 * own, 5)
    expect(opacityOf(middle![1]) / opacityOf(centre![1])).toBeCloseTo(0.21 / 0.38, 5)
  })
})

describe('the flat look of a theme', () => {
  it('is the theme in the flat bead, one object per theme, and a flat theme itself', () => {
    expect(flatLook(DARK_THEME)).toEqual({ ...DARK_THEME, ownColorRim: false })
    expect(flatLook(DARK_THEME)).toBe(flatLook(DARK_THEME))
    expect(flatLook(PRINT_THEME)).toBe(PRINT_THEME)
  })
})

describe('the own-color bead as a bitmap', () => {
  afterEach(() => vi.restoreAllMocks())
  // Bitmaps are kept for the whole run, by color: each test takes a color of its own so it makes its own.

  it('is made once per color and blitted for every bead that looks the same, square ones too', () => {
    const sprite = recordingContext()
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(sprite.context as unknown as CanvasRenderingContext2D)
    const main = recordingContext()

    for (const x of [0, 20, 40]) drawFlatBead(main.context, bead({ x, color: '#f2c94d' }))

    expect(getContext).toHaveBeenCalledTimes(1)
    expect(main.named('drawImage').map((call) => call.args.slice(1))).toEqual([[0, 20, 20, 20], [20, 20, 20, 20], [40, 20, 20, 20]])
    expect(main.named('fillRect')).toHaveLength(0)
  })

  it('is blitted at a Bead\'s own width and height, on a bitmap of that shape', () => {
    const sprite = recordingContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(sprite.context as unknown as CanvasRenderingContext2D)
    const created: HTMLCanvasElement[] = []
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = createElement(tag)
      if (tag === 'canvas') created.push(element as HTMLCanvasElement)
      return element
    })
    const main = recordingContext()

    drawFlatBead(main.context, bead({ color: '#f2c94e', width: 20, height: 30, deviceScale: 2 }))

    expect(main.named('drawImage')[0]!.args.slice(1)).toEqual([40, 20, 20, 30])
    expect([created[0]!.width, created[0]!.height]).toEqual([40, 60])
  })
})

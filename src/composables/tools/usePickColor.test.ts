import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import { findBead, type Bead } from '../../domain/beads'
import { withColors } from '../../domain/canvas'
import type { ColorCatalog } from '../../domain/colorCatalog'
import { nearestTarget, sourceTargets } from '../../domain/convertColors'
import { createProject } from '../../domain/createProject'
import { NO_COLOR, type PixelData } from '../../domain/imageConversion'
import { defaultPalette } from '../../domain/palette'
import type { Project } from '../../domain/project'
import { withLayers } from '../../testUtils/layerFields'
import { usePickColor, type PickColorDeps } from './usePickColor'

const GREEN = '#00aa00'
const RED = '#e63746'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** A 4 x 6 Frame at (20, 20) with a red bead at its first position, over a Canvas holding a green bead at (2, 2) and
 * another under the Frame at (21, 21). */
const framed: Project = withLayers(base, {
  frame: { technique: 'loom' as const, row: 20, column: 20, rows: 4, columns: 6, beads: withColors({}, [{ row: 0, column: 0, color: RED }]) },
  beads: withColors({}, [{ row: 2, column: 2, color: GREEN }, { row: 21, column: 21, color: '#0000ff' }]),
})

function setup(picking = false, project: Project | null = framed) {
  const deps = { picking: ref(picking), currentProject: () => project, onSelectCustomColor: vi.fn() }
  return { deps, ...usePickColor(deps) }
}

describe('usePickColor', () => {
  describe('pickColorAt (the armed press)', () => {
    it('lets a press through while nothing is armed', () => {
      const { deps, pickColorAt } = setup()
      expect(pickColorAt(2, 2)).toBe(false)
      expect(deps.onSelectCustomColor).not.toHaveBeenCalled()
    })

    it('takes the pressed bead\'s colour, on the Canvas or in the Frame, and ends the pick', () => {
      const canvas = setup(true)
      expect(canvas.pickColorAt(2, 2)).toBe(true)
      expect(canvas.deps.onSelectCustomColor).toHaveBeenCalledExactlyOnceWith(GREEN)
      expect(canvas.deps.picking.value).toBe(false)
      const frame = setup(true)
      expect(frame.pickColorAt(20, 20)).toBe(true)
      expect(frame.deps.onSelectCustomColor).toHaveBeenCalledExactlyOnceWith(RED)
      expect(frame.deps.picking.value).toBe(false)
    })

    it('takes the colour of the layer it is told, where the two lie over each other', () => {
      const { deps, pickColorAt } = setup(true)
      pickColorAt(21, 21, 'canvas')
      expect(deps.onSelectCustomColor).toHaveBeenCalledExactlyOnceWith('#0000ff')
    })

    it('takes nothing with no Project', () => {
      const { deps, pickColorAt } = setup(true, null)
      expect(pickColorAt(2, 2)).toBe(true)
      expect(deps.onSelectCustomColor).not.toHaveBeenCalled()
    })

    it('takes nothing from an empty position, keeps the pick armed and still consumes the press', () => {
      const { deps, pickColorAt } = setup(true)
      expect(pickColorAt(0, 0)).toBe(true)
      expect(deps.onSelectCustomColor).not.toHaveBeenCalled()
      expect(deps.picking.value).toBe(true)
    })
  })

  describe('from the reference image (ticket 1119)', () => {
    const catalog: ColorCatalog = {
      id: 'test',
      codes: [
        { code: 'TR1', family: ['Red'], finish: 'opaque', wording: 'Opaque', sizes: ['1.5mm'], hex: '#c01020' },
        { code: 'TR2', family: ['Blue'], finish: 'opaque', wording: 'Opaque', sizes: ['1.5mm'], hex: '#1020c0' },
        { code: 'TR3', family: ['Red'], finish: 'opaque', wording: 'Opaque', sizes: ['1.5mm'], hex: '#ff0000', discontinued: true },
      ],
    }
    const cube = findBead('toho-cube-1.5mm')! as Bead
    /** A picture of one color, its alpha full or none, laid far over the whole Canvas and Frame. */
    const onePixel = (color: number): PixelData => ({ width: 1, height: 1, data: color === NO_COLOR ? [0, 0, 0, 0] : [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, 255] })
    type PickedPicture = NonNullable<ReturnType<NonNullable<PickColorDeps['picture']>>>
    const everywhere: PickedPicture = { blob: new Blob(['picture']), place: { x: 0, y: 0, width: 100000, angle: 0 }, height: 100000 }

    /** `null` stands for none: a hidden picture, a Bead with no catalog. */
    function pictureSetup({ pixels = onePixel(0xee0000), picture = everywhere as PickedPicture | null, catalogOf = catalog as ColorCatalog | null, picking = true } = {}) {
      const decodePixels = vi.fn(async () => pixels)
      const loaded = shallowRef<ColorCatalog>()
      const load = vi.fn(async () => void (loaded.value = catalogOf ?? undefined))
      const deps = { picking: ref(picking), currentProject: () => framed, onSelectCustomColor: vi.fn(), picture: () => picture ?? undefined, decodePixels, beadColors: { load, catalog: loaded, bead: shallowRef(cube) } }
      return { deps, decodePixels, load, ...usePickColor(deps) }
    }
    const settled = () => new Promise((resolve) => setTimeout(resolve))

    it("takes the stored picture's color on an empty position as the nearest code of the Bead, with its code, and ends the pick", async () => {
      // The opacity is not among what the pick is handed: the picture is read from its bytes, never as drawn.
      const { deps, decodePixels, pickColorAt } = pictureSetup()
      expect(pickColorAt(0, 0)).toBe(true)
      await settled()
      expect(decodePixels).toHaveBeenCalledWith(everywhere.blob)
      expect(deps.onSelectCustomColor).toHaveBeenCalledExactlyOnceWith('#c01020', 'TR1')
      expect(deps.picking.value).toBe(false)
    })

    it("takes a bead's own color over the picture's", async () => {
      const { deps, decodePixels, pickColorAt } = pictureSetup()
      pickColorAt(2, 2)
      await settled()
      expect(deps.onSelectCustomColor).toHaveBeenCalledExactlyOnceWith(GREEN)
      expect(decodePixels).not.toHaveBeenCalled()
    })

    it('takes nothing from a hidden picture, off the picture or where it lets the Canvas through, and keeps the pick armed', async () => {
      const cases = [
        pictureSetup({ picture: null }),
        pictureSetup({ picture: { ...everywhere, place: { x: -5000, y: -5000, width: 10, angle: 0 }, height: 10 } }),
        pictureSetup({ pixels: onePixel(NO_COLOR) }),
      ]
      for (const { pickColorAt } of cases) expect(pickColorAt(0, 0)).toBe(true)
      await settled()
      for (const { deps } of cases) {
        expect(deps.onSelectCustomColor).not.toHaveBeenCalled()
        expect(deps.picking.value).toBe(true)
      }
    })

    it("matches to the Bead's default colors when it has no catalog", async () => {
      const { deps, pickColorAt } = pictureSetup({ catalogOf: null })
      pickColorAt(0, 0)
      await settled()
      const match = nearestTarget('#ee0000', sourceTargets('default', defaultPalette(cube.id), []))
      expect(deps.onSelectCustomColor).toHaveBeenCalledExactlyOnceWith(match.hex, match.code)
    })

    it('keeps the pick armed when the picture fails to decode, and reads it again on the next press', async () => {
      const { deps, decodePixels, pickColorAt } = pictureSetup()
      decodePixels.mockRejectedValueOnce(new Error('not a picture'))
      pickColorAt(0, 0)
      await settled()
      expect(deps.onSelectCustomColor).not.toHaveBeenCalled()
      expect(deps.picking.value).toBe(true)
      pickColorAt(0, 0)
      await settled()
      expect(decodePixels).toHaveBeenCalledTimes(2)
      expect(deps.onSelectCustomColor).toHaveBeenCalledExactlyOnceWith('#c01020', 'TR1')
    })

    it('takes nothing once the pick was ended before the picture was read', async () => {
      const { deps, pickColorAt } = pictureSetup()
      pickColorAt(0, 0)
      deps.picking.value = false
      await settled()
      expect(deps.onSelectCustomColor).not.toHaveBeenCalled()
    })

    it('reads the picture and the catalog as soon as the pick is armed over it, once a picture', async () => {
      const { deps, decodePixels, load, pickColorAt } = pictureSetup({ picking: false })
      deps.picking.value = true
      await nextTick()
      expect(decodePixels).toHaveBeenCalledOnce()
      expect(load).toHaveBeenCalled()
      pickColorAt(0, 0)
      await settled()
      expect(decodePixels).toHaveBeenCalledOnce()
    })
  })
})

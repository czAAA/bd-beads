import { describe, expect, it } from 'vitest'
import { withColors } from '../domain/canvas'
import { createProject } from '../domain/createProject'
import { canvasOf } from '../domain/layerRecord'
import { canvasWeave, weaveOf } from '../domain/layerWeave'
import type { Project } from '../domain/project'
import { withLayers } from '../testUtils/layerFields'
import { PROJECT_THEMES, type ProjectTheme } from './beadLook'
import { renderProject } from './projectRenderer'
import type { DrawnReference } from './referenceImage'
import { spaceOf } from './space'
import { gridToRegion, positionBoxPx } from './surfaceView'

// Showing a reference image leaves the grid as it is (ticket 1008): the tonal tiles stay, in their color, on the whole
// Canvas and in the Frame, and the picture lies over them. Real pixels, as the bug was in what the screen shows.

const REGION = { x: 0, y: 0, width: 400, height: 400 }
const ZOOM = 1

/** A 4 × 3 Frame at row 2, column 2, its first row painted and the others left empty. */
function framedProject(): Project {
  const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 12, height: 12, unit: 'beads' } })
  const cells = [0, 1, 2].map((column) => ({ row: 0, column, color: '#1a1a1a' }))
  const frame = { ...weaveOf(canvasOf(project)), row: 2, column: 2, rows: 4, columns: 3, beads: withColors({}, cells) }
  return withLayers(project, { frame })
}

/** A picture all one color, laid over grid px `x`, `y` to `x + size`, `y + size` at an opacity step. */
function pictureAt(x: number, y: number, size: number, opacity: DrawnReference['opacity'] = 100): DrawnReference {
  const image = document.createElement('canvas')
  image.width = image.height = 4
  const context = image.getContext('2d')!
  context.fillStyle = '#ff0000'
  context.fillRect(0, 0, 4, 4)
  return { image, place: { x: x + size / 2, y: y + size / 2, width: size, angle: 0 }, height: size, opacity }
}

function rendered(project: Project, theme: ProjectTheme, reference?: DrawnReference) {
  const canvas = document.createElement('canvas')
  canvas.width = REGION.width
  canvas.height = REGION.height
  const context = canvas.getContext('2d')!
  renderProject(context, { project, space: spaceOf(project, true), region: REGION, zoom: ZOOM, theme, frameTheme: theme, opaque: true, reference })
  const [a, , , d, e, f] = gridToRegion(spaceOf(project, true).extent, REGION, ZOOM, 0)
  /** The pixels across a Canvas position's middle row, as `r/g/b` strings. */
  const across = (row: number, column: number) => {
    const box = positionBoxPx(canvasWeave(project), row, column)
    const [x, y, width] = [Math.round(a * box.x + e), Math.round(d * (box.y + box.height / 2) + f), Math.round(a * box.width)]
    // A row off the bitmap reads as nothing, which would compare equal with and without the picture.
    expect(x >= 0 && y >= 0 && x + width <= REGION.width && y < REGION.height).toBe(true)
    const data = context.getImageData(x, y, width, 1).data
    return Array.from({ length: data.length / 4 }, (_, at) => `${data[at * 4]}/${data[at * 4 + 1]}/${data[at * 4 + 2]}`)
  }
  return { across }
}

const RED = '255/0/0'

describe('the grid under a reference image (ticket 1008)', () => {
  for (const look of ['light', 'dark'] as const) {
    it(`keeps the Canvas's and the Frame's tiles away from the picture, in ${look}`, () => {
      const project = framedProject()
      const theme = PROJECT_THEMES[look]
      const shown = rendered(project, theme, pictureAt(0, 0, 10))
      const hidden = rendered(project, theme)
      // On the open Canvas far from the picture, and on the Frame's empty row.
      expect(shown.across(9, 9)).toEqual(hidden.across(9, 9))
      expect(shown.across(5, 3)).toEqual(hidden.across(5, 3))
    })
  }

  it('lays the picture over the tiles, and the painted beads over the picture', () => {
    const project = framedProject()
    const { across } = rendered(project, PROJECT_THEMES.light, pictureAt(0, 0, 1000))
    // An empty position at 100% is the picture: nothing is drawn over it, on the Canvas or in the Frame (the row
    // just under the painted one takes their Lifted piece's shadow).
    expect(new Set(across(9, 9))).toEqual(new Set([RED]))
    expect(new Set(across(5, 3))).toEqual(new Set([RED]))
    // A painted bead still covers it.
    expect(across(2, 3).filter((pixel) => pixel !== RED).length).toBeGreaterThan(across(2, 3).length / 2)
  })

  it('keeps high contrast\'s outlines over the picture', () => {
    const { across } = rendered(framedProject(), PROJECT_THEMES.contrast, pictureAt(0, 0, 1000))
    expect(across(9, 9).some((pixel) => pixel !== RED)).toBe(true)
  })
})

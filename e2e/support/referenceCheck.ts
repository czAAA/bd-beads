import { beadColorAt } from '../../src/domain/layerBeads'
import { writeFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { PNG } from 'pngjs'
import type { Project } from '../../src/domain/project'
import { isInCurrentRow, isInFinishedRow } from '../../src/domain/rowProgress'
import { projectFrame } from '../../src/domain/projectExtent'
import { OPEN_SPACE } from '../../src/rendering/space'
import { surfaceView } from '../../src/rendering/surfaceView'
import { LIGHT_THEME } from '../../src/rendering/beadLook'
import { differingBlocks } from './imageDiff'
import { beadCentre } from './projects'
import { type Region } from '../../src/rendering/surfaceView'
import { canvasOf, frameOf, orientationOf } from '../../src/domain/layerRecord'

// Holds the drawing to the reference screenshots in e2e/visual/__screenshots__ (one element per bead; ticket 103,
// ADR 0018). A canvas never matches DOM pixels exactly, so two comparisons: the look (block-averaged colors, a share
// of blocks may differ) and the content (every bead's centre color).

// Share of blocks that may differ before the look counts as different: loom and square stitch 2.5%, brick 3.6%, peyote 5.5%
// (anti-aliased rounded corners). A 2 px rim instead of 1 moves loom and brick by 4-8% at 100% and 300%, so it shows;
// not in peyote or at 50%: the content check holds there.
export const MAX_DIFFERING_BLOCKS = { loom: 0.03, brick: 0.04, peyote: 0.06, square: 0.03 }
const BLOCK_TOLERANCE = 48
/** How far a bead's centre pixel may be from its expected color, per channel. */
const CENTRE_TOLERANCE = 10

/** A block is 8 px at 100% and follows the zoom, so it stays a fraction of a bead (a bead is 20 px there); never
 * under 4, or one anti-aliased corner pixel of a 5 px bead counts as a difference. */
export const blockFor = (zoom: number) => Math.max(4, Math.round((8 * zoom) / 100))

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** How much of its own color a finished bead keeps in every theme, over the Canvas (50%, ticket 375). */
const FINISHED_SHARE = 0.5

/** How far the current row's beads are lifted toward white (10%, ticket 352). */
const CURRENT_ROW_LIFT = 0.1

/** The color a bead should show at its centre, from the Project alone. A finished row's beads are their own color at
 * 50% over the Canvas; the current row's are 10% brighter. */
function expectedCentre(project: Project, row: number, column: number): [number, number, number] {
  const color = beadColorAt(project, row, column)
  const own = rgb(color ?? LIGHT_THEME.emptyBead)
  if (isInCurrentRow(project, { row, column })) {
    return own.map((channel) => channel + (255 - channel) * CURRENT_ROW_LIFT) as [number, number, number]
  }
  if (!isInFinishedRow(project, { row, column })) {
    return own
  }
  const board = rgb(LIGHT_THEME.canvas)
  return own.map((channel, index) => FINISHED_SHARE * channel + (1 - FINISHED_SHARE) * board[index]!) as [number, number, number]
}

// The beads whose centre is not the right color in a screenshot taken from `origin` (page position of its top-left
// pixel). "Centre" is any pixel within one of it: at 50% a bead is 10 px, and the centre falls between pixels
// differently in reference and canvas.
export function wrongBeads(
  image: Buffer,
  project: Project,
  zoom: number,
  box: { x: number; y: number; width: number; height: number },
  origin: { x: number; y: number },
  /** Beads not to check: ones a hover preview is drawn on, whose centre is meant to differ from the bead's color. */
  ignore: ReadonlySet<string> = new Set(),
): string[] {
  const png = PNG.sync.read(image)
  const wrong: string[] = []
  for (let row = 0; row < frameOf(project)!.rows; row += 1) {
    for (let column = 0; column < frameOf(project)!.columns; column += 1) {
      if (ignore.has(`(${row}, ${column})`)) {
        continue
      }
      const centre = beadCentre(project, box, zoom, { row, column })
      const x = Math.floor(centre.x - origin.x)
      const y = Math.floor(centre.y - origin.y)
      const expected = expectedCentre(project, row, column)
      const found = [-1, 0, 1].some((dy) =>
        [-1, 0, 1].some((dx) => {
          const at = ((y + dy) * png.width + (x + dx)) * 4
          return expected.every((channel, index) => Math.abs(channel - png.data[at + index]!) <= CENTRE_TOLERANCE)
        }),
      )
      if (!found) {
        wrong.push(`(${row}, ${column})`)
      }
    }
  }
  return wrong
}

/** What a screenshot of the drawn Project (the `actual`) is judged on against a reference: the share of blocks that
 * differ in look, and the beads whose centre is the wrong color. */
export function compareToReference(
  actual: Buffer,
  expected: Buffer,
  project: Project,
  zoom: number,
  box: { x: number; y: number; width: number; height: number },
  origin: { x: number; y: number },
  ignore: ReadonlySet<string> = new Set(),
): { look: number | string; wrong: string[] } {
  const { width, height } = PNG.sync.read(expected)
  const differing = differingBlocks(actual, expected, blockFor(zoom), BLOCK_TOLERANCE)
  return {
    look: typeof differing === 'number' ? differing / Math.ceil((width * height) / blockFor(zoom) ** 2) : differing,
    wrong: wrongBeads(actual, project, zoom / 100, box, origin, ignore),
  }
}

/** `UPDATE_REFERENCES=1 npm run visual` redraws the references from the app: only when the look is meant to change
 * (ticket 140), never to pass. */
export const UPDATING_REFERENCES = process.env.UPDATE_REFERENCES === '1'

/** The pixels the Project's Frame covers on screen, from the Project's corner: turned and zoomed, to whole pixels. */
export function shownRegion(corner: { x: number; y: number }, project: Project, zoom: number): Region {
  const shown = surfaceView({ space: OPEN_SPACE, technique: canvasOf(project).technique, rotation: orientationOf(project), zoom }).beadBox(projectFrame(project))
  return { x: Math.floor(corner.x + shown.x), y: Math.floor(corner.y + shown.y), width: Math.ceil(shown.width), height: Math.ceil(shown.height) }
}

/** Writes a new reference: the pixels the Project's Frame covers. */
export async function writeReference(page: Page, path: string, region: Region): Promise<void> {
  writeFileSync(path, await page.screenshot({ clip: region }))
}

/** The zooms a reference exists for: rotation and zoom are independent in the renderer, so rotated at 100% and
 * upright at both. */
export function zoomsFor(rotated: boolean): number[] {
  return rotated ? [100] : [100, 300]
}

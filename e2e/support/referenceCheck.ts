import { beadColorAt } from '../../src/domain/project'
import { writeFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { PNG } from 'pngjs'
import type { Project } from '../../src/domain/project'
import { isInCurrentRow, isInFinishedRow, projectFrame } from '../../src/domain/project'
import { OPEN_SPACE } from '../../src/rendering/space'
import { surfaceView } from '../../src/rendering/surfaceView'
import { LIGHT_THEME } from '../../src/rendering/beadLook'
import { differingBlocks } from './imageDiff'
import { beadCentre } from './projects'
import { type Region } from '../../src/rendering/surfaceView'

/**
 * The comparisons that hold the app's drawing of a Project to the reference screenshots in e2e/visual/__screenshots__.
 * Those were made from the one-element-per-bead grid the renderer replaced (ticket 103), and stay as the reference the
 * renderer is held to (ADR 0018: "visually indistinguishable"). A canvas never lands on exactly the same pixels as the
 * DOM did (that snapped a scaled box's inside to whole pixels its own way, and rasterized a 0.25px rim its own way), so
 * there are two comparisons, one for the look and one for the content:
 *
 *  - The look: both images reduced to the average color of blocks a fraction of a bead wide, and at most a share of the
 *    blocks may differ. Averaging ignores where an edge falls within a pixel or two, and still sees a rim, a gap, a
 *    corner or an overlay that is really different.
 *  - The content: every bead's centre must be its color, within a few levels: a bead in the wrong color, missing, or in
 *    the wrong place fails however small it is drawn. Finished rows' greys are worked out here independently.
 */

/**
 * The share of blocks that may differ from the reference before the look counts as different, measured on the renderer
 * as it is: loom comes out within 2.5% and brick stitch within 3.6% at worst, and peyote, whose rounded corners the two engines
 * anti-alias differently (and whose rotated box lands on half a pixel), within 5.5%. A rim drawn 2 px instead of 1
 * moves loom and brick stitch by 4–8% at 100% and 300% zoom, so those show; it does not show in peyote's, nor at 50%,
 * where a bead is 10 px and a block can't be smaller than 4 — the content check below is what holds there.
 */
export const MAX_DIFFERING_BLOCKS = { loom: 0.03, brick: 0.04, peyote: 0.06 }
const BLOCK_TOLERANCE = 48
/** How far a bead's centre pixel may be from its expected color, per channel. */
const CENTRE_TOLERANCE = 10

/** A block is 8 px at 100% and follows the zoom, so it stays a fraction of a bead (a bead is 20 px there); never under 4, or one anti-aliased corner pixel of a 5 px bead counts as a difference. */
export const blockFor = (zoom: number) => Math.max(4, Math.round((8 * zoom) / 100))

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** How much of its own color a finished bead keeps in every theme, over the open canvas (60%, ticket 352). */
const FINISHED_SHARE = 0.6

/** How far the current row's beads are lifted toward white (10%, ticket 352). */
const CURRENT_ROW_LIFT = 0.1

/** The color a bead should show at its centre, from the Project alone. A finished row's beads are their own color at 60% over the open canvas; the current row's are 10% brighter. */
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

/**
 * The beads whose centre is not the color it should be, in a screenshot of the grid taken from `origin` (the page
 * position of its top-left pixel). "The centre" is any pixel within one of it: at 50% a bead is 10 px across, and where
 * its centre falls between pixels differs by a pixel between the reference and a canvas.
 */
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
  for (let row = 0; row < project.frame!.rows; row += 1) {
    for (let column = 0; column < project.frame!.columns; column += 1) {
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

/** What a screenshot of the drawn Project (the `actual`) is judged on against a reference: the share of blocks that differ in look, and the beads whose centre is the wrong color. */
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

/**
 * `UPDATE_REFERENCES=1 npm run visual` redraws the reference screenshots from the app as it is: only right when the
 * look is meant to change (ticket 140 redrew them for the design system's board and colors), never to make a failing
 * run pass. Each scenario's reference is then the surface as drawn, and its comparison passes against itself.
 */
export const UPDATING_REFERENCES = process.env.UPDATE_REFERENCES === '1'

/** The pixels the Project's Frame covers on screen, from the Project's corner: turned and zoomed, to whole pixels. */
export function shownRegion(corner: { x: number; y: number }, project: Project, zoom: number): Region {
  const shown = surfaceView({ space: OPEN_SPACE, technique: project.technique, rotation: project.rotation, zoom }).beadBox(projectFrame(project))
  return { x: Math.floor(corner.x + shown.x), y: Math.floor(corner.y + shown.y), width: Math.ceil(shown.width), height: Math.ceil(shown.height) }
}

/** Writes a new reference: the pixels the Project's Frame covers. */
export async function writeReference(page: Page, path: string, region: Region): Promise<void> {
  writeFileSync(path, await page.screenshot({ clip: region }))
}

/**
 * The zooms a reference exists for. Rotation and zoom are independent in the renderer, so rotated is checked at 100%
 * (catches a wrong rotation) and upright at both (catches a wrong zoom); rotated at 300% would only repeat those two.
 */
export function zoomsFor(rotated: boolean): number[] {
  return rotated ? [100] : [100, 300]
}

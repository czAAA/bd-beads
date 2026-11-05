import type { GridPosition } from '../../domain/grid'
import type { InsideRowId } from '../../i18n/translations'
import type { Hand } from './hand'
import { frameOf } from '../../domain/layerRecord'
import { TECHNIQUES } from '../../domain/weave'
import { DEMO_COLORS, DEMO_DRAWINGS, DEMO_FRAME, type DemoColor, type DemoDrawing } from './demoProjects'
import { landscapeFile } from './landscape'

// What the ghost does for each row of What's inside (Homepage card, ticket 0797), in the demo editor, each row picking
// up where the one before it left the editor.

/** The Palette swatch of each color the tour draws with: Miyuki's color families. */
const SWATCH_IDS: Record<DemoColor, string> = { W: 'white', Y: 'yellow', O: 'orange', R: 'red', B: 'blue', G: 'green', P: 'pink' }

/** Picks a color on the Tool pill: a recent swatch, or the color popover for one that isn't recent. */
async function pickColor(hand: Hand, color: DemoColor): Promise<void> {
  const hex = DEMO_COLORS[color]
  const recent = () => [...hand.root.querySelectorAll('[data-testid="pill-recent"]')].find((button) => button.getAttribute('aria-label')?.toLowerCase().includes(hex))
  if (recent()) {
    await hand.press(recent)
    return
  }
  await hand.press('pill-color')
  await hand.press(() => hand.root.querySelector(`[data-testid="palette-swatch"][data-color-id="${SWATCH_IDS[color]}"]`))
  if (hand.root.querySelector('[data-testid="color-popover"]')) await hand.press('color-popover-close')
}

/** The beads of one color in a drawing, as strokes: each run along a row, every other row turning back. */
function strokesOf(drawing: DemoDrawing, color: DemoColor): GridPosition[][] {
  const strokes: GridPosition[][] = []
  drawing.rows.forEach((letters, down) => {
    const runs: GridPosition[][] = []
    let run: GridPosition[] = []
    ;[...letters].forEach((letter, across) => {
      if (letter === color) run.push({ row: drawing.row + down, column: drawing.column + across })
      else if (run.length) (runs.push(run), (run = []))
    })
    if (run.length) runs.push(run)
    const turned = down % 2 === 1
    strokes.push(...(turned ? runs.reverse().map((each) => each.reverse()) : runs))
  })
  return strokes
}

/** A drawing's colors from its middle out: the order the ghost draws them in. */
function colorsOf(drawing: DemoDrawing): DemoColor[] {
  const middle = { down: (drawing.rows.length - 1) / 2, across: (drawing.rows[0].length - 1) / 2 }
  const nearest = new Map<DemoColor, number>()
  drawing.rows.forEach((letters, down) =>
    [...letters].forEach((letter, across) => {
      if (letter === '.') return
      const away = Math.max(Math.abs(down - middle.down), Math.abs(across - middle.across))
      nearest.set(letter as DemoColor, Math.min(away, nearest.get(letter as DemoColor) ?? Infinity))
    }),
  )
  return [...nearest.keys()].sort((a, b) => nearest.get(a)! - nearest.get(b)!)
}

/** Draws a drawing with Paint, one color at a time, from its middle out. */
async function draw(hand: Hand, drawing: DemoDrawing): Promise<void> {
  const colors = colorsOf(drawing)
  for (const color of colors) {
    await pickColor(hand, color)
    for (const cells of strokesOf(drawing, color)) await hand.stroke(cells)
  }
}

/** A bead of the Frame, by its place in the Frame. */
function inFrame(row: number, column: number): GridPosition {
  return { row: DEMO_FRAME.row + row, column: DEMO_FRAME.column + column }
}

/** The Frame's corners, for a drag over the whole of it. */
const FRAME_FIRST = inFrame(0, 0)
const FRAME_LAST = inFrame(DEMO_FRAME.rows - 1, DEMO_FRAME.columns - 1)

/** The landscape the ghost traces over the Reference image, in the Frame: the sun and the hills' edge painted, the sky
 * and the grass filled from one bead each, two rows of ground. */
const LANDSCAPE = {
  sun: [inFrame(1, 7), inFrame(1, 8), inFrame(2, 8), inFrame(2, 7)],
  hills: [inFrame(7, 0), inFrame(7, 1), inFrame(6, 2), inFrame(6, 3), inFrame(5, 4), inFrame(5, 5), inFrame(5, 6), inFrame(6, 7), inFrame(6, 8), inFrame(7, 9), inFrame(7, 10)],
  ground: [Array.from({ length: 11 }, (_, column) => inFrame(9, column)), Array.from({ length: 11 }, (_, column) => inFrame(10, 10 - column))],
  sky: inFrame(0, 2),
  grass: inFrame(8, 5),
  flowers: [inFrame(8, 2), inFrame(7, 5), inFrame(8, 8)],
}

/** The swatch the sky is filled with: Miyuki's Iridescent, a pale blue. */
const SKY_SWATCH = 'iridescent'
/** The ground's swatch. */
const GROUND_SWATCH = 'brown'
/** The catalog color the meadow's flowers are painted in (Homepage card, Colors built in). */
const FLOWER_CODE = 'DB55'

/** Picks a Palette swatch by its id through the color popover, as `pickColor` does a demo color. */
async function pickSwatch(hand: Hand, id: string): Promise<void> {
  await hand.press('pill-color')
  await hand.press(() => hand.root.querySelector(`[data-testid="palette-swatch"][data-color-id="${id}"]`))
  if (hand.root.querySelector('[data-testid="color-popover"]')) await hand.press('color-popover-close')
}

/** Opens the Frame panel, if it isn't open, and closes it after `work`. */
async function inFramePanel(hand: Hand, work: () => Promise<void>): Promise<void> {
  if (!hand.root.querySelector('[data-testid="frame-panel"]')) await hand.press('strip-frame')
  await work()
  if (hand.root.querySelector('[data-testid="frame-panel"]')) await hand.press('strip-frame')
}

/** A picker's own button: the one that opens its list. */
function pickerButton(hand: Hand, testid: string) {
  return () => hand.root.querySelector(`[data-testid="${testid}"] .panel-picker__button`) ?? hand.root.querySelector(`[data-testid="${testid}"]`)
}

/** The Technique picker's choice of `technique`, once its list is open. */
function techniqueOption(hand: Hand, technique: string) {
  return () => hand.root.querySelector(`.panel-picker__option[data-value="${technique}"]`)
}

/** Each row's script. */
export const TOUR_SCRIPTS: Record<InsideRowId, (hand: Hand) => Promise<void>> = {
  /** The open Canvas: three drawings with Paint, then a Selection round the middle one becomes the Frame. */
  async canvas(hand) {
    await hand.press('pill-tool-paint')
    for (const drawing of DEMO_DRAWINGS) await draw(hand, drawing)
    await hand.press('pill-tool-select')
    await hand.drag(FRAME_FIRST, FRAME_LAST)
    await hand.hover('context-bar-frame', 1200)
    await hand.press('context-bar-frame')
  },
  /** The Frame's Technique, each of the others in turn and back to the first, each held a moment with the panel shut so
   * the beads show how they sit. */
  async techniques(hand) {
    for (const technique of [...TECHNIQUES.slice(1), TECHNIQUES[0]]) {
      await inFramePanel(hand, async () => {
        await hand.press(pickerButton(hand, 'frame-technique'))
        await hand.press(techniqueOption(hand, technique))
      })
      await hand.wait(1150)
    }
  },
  /** Paint, three beads, then Undo. */
  async editing(hand) {
    await hand.press('pill-tool-paint')
    await pickColor(hand, 'P')
    await hand.stroke([inFrame(5, 0), inFrame(5, 1), inFrame(5, 2)])
    await hand.wait(500)
    await hand.press('strip-undo')
  },
  /** Mirror over the whole Frame, Radial with 4 folds: a few beads, each followed by its counterparts, then blue. */
  async mirror(hand) {
    await hand.press('margin-frame-tools')
    await hand.press('margin-frame-tools-mirror')
    await hand.press(() => hand.root.querySelector('[data-testid="mirror-bar-axis-radial"]') ?? hand.root.querySelector('[data-testid="mirror-bar-chip-radial"] button'))
    for (let presses = 0; presses < 2 && !foldIs(hand, 4); presses++) await hand.press('mirror-bar-radial-more')
    await hand.press('pill-tool-paint')
    await pickColor(hand, 'P')
    for (const bead of [inFrame(0, 4), inFrame(2, 2)]) await hand.stroke([bead])
    await pickColor(hand, 'B')
    for (const bead of [inFrame(1, 5), inFrame(4, 4)]) await hand.stroke([bead])
  },
  /** The Frame emptied, a picture laid under the beads, made a little smaller from its corner, then traced. */
  async reference(hand) {
    await hand.press('pill-tool-mirror')
    await hand.press('mirror-bar-close')
    await hand.press('pill-tool-select')
    await hand.drag(FRAME_FIRST, FRAME_LAST)
    await hand.press('context-bar-clear')
    const picture = await landscapeFile()
    await hand.pressWith('strip-reference-image', () => hand.canvas.referenceImage.pick(picture, 'strip'))
    await shrinkReference(hand)
    await hand.press('reference-adjust-done')
    await hand.press('pill-tool-paint')
    await pickColor(hand, 'Y')
    await hand.stroke(LANDSCAPE.sun)
    await pickColor(hand, 'G')
    await hand.stroke(LANDSCAPE.hills)
    await pickSwatch(hand, GROUND_SWATCH)
    for (const row of LANDSCAPE.ground) await hand.stroke(row)
    await hand.press('pill-tool-fill')
    await pickSwatch(hand, SKY_SWATCH)
    await hand.stroke([LANDSCAPE.sky])
    await pickColor(hand, 'G')
    await hand.stroke([LANDSCAPE.grass])
  },
  /** Convert image from the Menu, at its first step, then closed. */
  async convert(hand) {
    await hand.press('strip-menu')
    await hand.press('menu-convert-image')
    await hand.wait(3400)
    await hand.press('convert-close')
  },
  /** The color popover's Miyuki Delica palette, a catalog color picked, a few flowers in the meadow. */
  async colors(hand) {
    await hand.press('pill-tool-paint')
    await hand.press('pill-color')
    await hand.press('bead-colors-toggle')
    await hand.press(() => hand.root.querySelector(`[data-testid="bead-color"][data-code="${FLOWER_CODE}"]`))
    if (hand.root.querySelector('[data-testid="color-popover"]')) await hand.press('color-popover-close')
    for (const flower of LANDSCAPE.flowers) await hand.stroke([flower])
  },
  /** Letters: each color's letter on its beads. */
  async letters(hand) {
    await inFramePanel(hand, async () => {
      await hand.press('frame-letters')
      await hand.wait(1200)
    })
  },
  /** Replace Frame from the Starter gallery: Earrings, V fringe, its setup looked through, Replace. */
  async starters(hand) {
    await hand.press('strip-frame')
    await hand.press('frame-replace-from-starter')
    await hand.press('starter-category-earrings')
    await hand.press('starter-card-vFringe')
    await hand.scroll(() => hand.root.querySelector('[data-testid="panel-body"]'), 240, 1400)
    await hand.press('create-starter-project')
    if (await present(hand, 'replace-frame-modal')) await hand.press('confirm-modal-confirm')
    await moveFrameAside(hand)
  },
  /** Row done for each of the earring's steps, the first three slower; Pattern done at the end. */
  async rowProgress(hand) {
    for (let step = 0; ; step++) {
      const next = hand.root.querySelector('[data-testid="progress-bar-next"]')
      if (!next || next.getAttribute('aria-disabled') === 'true' || (next as HTMLButtonElement).disabled) break
      await hand.press('progress-bar-next')
      await hand.wait(step < 3 ? 700 : 240)
    }
    await hand.wait(1200)
  },
  /** The Frame panel opened on Beads needed. */
  async beadsNeeded(hand) {
    await inFramePanel(hand, async () => {
      await hand.hover('bead-quantities', 3000, 'start')
    })
  },
  /** The Frame panel's Export: the printable chart, shown and not downloaded. */
  async exports(hand) {
    await inFramePanel(hand, async () => {
      await hand.hover('export-pdf', 3800)
    })
  },
  /** Saved Projects in the Menu: the demo's own three. */
  async savedProjects(hand) {
    await hand.press('strip-menu')
    await hand.press('menu-saved-projects')
    await hand.wait(3200)
    await hand.press('strip-menu')
  },
}

/** The beads kept clear between the Frame's sheet and a drawing beside it. */
const SHEET_ROOM = 4

/** The new Frame lands where the old one was, in the view's middle: the ghost moves it left, between the rhombus and the
 * landscape, so the landscape stays on the Canvas beside it. */
async function moveFrameAside(hand: Hand): Promise<void> {
  const project = hand.canvas.activeProject.value
  const frame = project && frameOf(project)
  if (!frame) return
  const [rhombus] = DEMO_DRAWINGS.slice(1)
  const room = DEMO_FRAME.column - SHEET_ROOM - (rhombus.column + rhombus.rows[0].length + SHEET_ROOM)
  const column = rhombus.column + rhombus.rows[0].length + SHEET_ROOM + Math.max(0, Math.floor((room - frame.columns) / 2))
  if (column === frame.column) return
  const from = { row: frame.row, column: frame.column }
  await hand.dragFrame('frame-move-handle', from, { row: frame.row, column })
}

/** Whether the Fold of the radial Mirror is `fold`. */
function foldIs(hand: Hand, fold: number): boolean {
  const value = hand.root.querySelector('[data-testid="mirror-bar-radial-value"]')
  return value?.textContent?.trim() === String(fold)
}

/** Whether a dialog or control shows up within a moment. */
async function present(hand: Hand, testid: string): Promise<boolean> {
  for (let frames = 0; frames < 10; frames++) {
    if (hand.root.querySelector(`[data-testid="${testid}"]`)) return true
    await hand.frame()
  }
  return false
}

/** The reference image made a little smaller from its bottom-right corner, its top-left staying, as a drag would. */
async function shrinkReference(hand: Hand): Promise<void> {
  const flow = hand.canvas.referenceImage
  await hand.find('reference-adjust')
  const corner = await hand.find(() => [...hand.root.querySelectorAll('.reference-adjust__corner')].at(-1))
  const image = flow.image.value
  if (!image) return
  const from = hand.middleOf(corner)
  await hand.moveTo(from)
  const { place, picture } = image
  const width = place.width * 0.86
  const shrunk = { ...place, width, x: place.x - (place.width - width) / 2, y: place.y - ((place.width - width) * (picture.height / picture.width)) / 2 }
  const box = corner.closest('[data-testid="reference-adjust"]')!.getBoundingClientRect()
  await hand.moveTo({ x: from.x - box.width * 0.14, y: from.y - box.height * 0.14 })
  flow.commit(shrunk)
}

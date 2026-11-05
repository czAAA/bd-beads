import type { GridPosition } from '../../domain/grid'
import type { InsideRowId } from '../../i18n/translations'
import type { Hand } from './hand'
import { frameOf } from '../../domain/layerRecord'
import { TECHNIQUES } from '../../domain/weave'
import { DEMO_COLORS, DEMO_DRAWING, DEMO_FRAME, DEMO_MIRROR_BEADS, type DemoColor, type DemoDrawing } from './demoProjects'
import { landscapeFile } from './landscape'

// What the ghost does for each row of What's inside (Homepage card, ticket 0797), in the demo editor, each row picking
// up where the one before it left the editor.

/** The Palette swatch of each color the tour draws with: Miyuki's color families. */
const SWATCH_IDS: Record<DemoColor, string> = { W: 'white', Y: 'yellow', O: 'orange', R: 'red', B: 'blue', G: 'green', P: 'pink' }

/** Picks a Palette swatch by its id through the color popover. */
async function pickSwatch(hand: Hand, id: string): Promise<void> {
  await hand.press('pill-color')
  await hand.press(() => hand.root.querySelector(`[data-testid="palette-swatch"][data-color-id="${id}"]`))
  if (hand.root.querySelector('[data-testid="color-popover"]')) await hand.press('color-popover-close')
}

/** Picks a color on the Tool pill: a recent swatch, or the color popover for one that isn't recent. */
async function pickColor(hand: Hand, color: DemoColor): Promise<void> {
  const hex = DEMO_COLORS[color]
  const recent = () => [...hand.root.querySelectorAll('[data-testid="pill-recent"]')].find((button) => button.getAttribute('aria-label')?.toLowerCase().includes(hex))
  if (recent()) await hand.press(recent)
  else await pickSwatch(hand, SWATCH_IDS[color])
}

/** The beads of one color in a drawing, as strokes: each run along a row, every other row turning back. */
function strokesOf(drawing: DemoDrawing, color: DemoColor): GridPosition[][] {
  const strokes: GridPosition[][] = []
  drawing.rows.forEach((letters, down) => {
    const runs: GridPosition[][] = []
    let run: GridPosition[] = []
    ;[...letters].forEach((letter, across) => {
      if (letter === color) {
        run.push({ row: drawing.row + down, column: drawing.column + across })
      } else if (run.length) {
        runs.push(run)
        run = []
      }
    })
    if (run.length) runs.push(run)
    const turned = down % 2 === 1
    strokes.push(...(turned ? runs.reverse().map((each) => each.reverse()) : runs))
  })
  return strokes
}

/** A drawing's colors from its middle out: the order the ghost draws them in. */
function drawingOrder(drawing: DemoDrawing): DemoColor[] {
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
  const colors = drawingOrder(drawing)
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

/** How long a row holds what it shows, in ms (Homepage card, the tour): 1.2 times its first pace (ticket 0802). Every
 * wait of a script is one of these.
 * @internal Its test checks the scripts wait by these alone. */
export const HOLD = {
  /** Set Frame, its Tooltip shown, before it is pressed. */
  setFrame: 1440,
  /** Each Technique, the panel shut. */
  technique: 1380,
  /** Project editing's three beads, before Undo. */
  undo: 600,
  /** Convert image's picture converted, then its found colors. */
  convertPicture: 1800,
  convertColors: 2400,
  /** Letters on the beads. */
  letters: 1440,
  /** Scrolling through the Starter's setup. */
  starterScroll: 1680,
  /** Row done's passes: the first three slower, then quicker; Pattern done at the end. */
  rowDoneSlow: 840,
  rowDoneQuick: 288,
  patternDone: 1440,
  beadsNeeded: 3600,
  exports: 4560,
  savedProjects: 3840,
} as const
/** How many of Row done's passes are slower. */
const ROW_DONE_SLOW = 3

/** The swatch the sky is filled with: Miyuki's Iridescent, a pale blue. */
const SKY_SWATCH = 'iridescent'
/** The ground's swatch. */
const GROUND_SWATCH = 'brown'
/** The catalog color the meadow's flowers are painted in (Homepage card, Colors built in). */
const FLOWER_CODE = 'DB55'


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
  /** The open Canvas: a kaleidoscope with Paint, then a Selection round it becomes the Frame. */
  async canvas(hand) {
    await hand.press('pill-tool-paint')
    await draw(hand, DEMO_DRAWING)
    await hand.press('pill-tool-select')
    await hand.drag(FRAME_FIRST, FRAME_LAST)
    await hand.hover('context-bar-frame', HOLD.setFrame)
    await pressSelectionBar(hand, 'frame', () => hand.canvas.onFrameFromSelection())
  },
  /** The Frame's Technique, each of the others in turn and back to the first, each held a moment with the panel shut so
   * the beads show how they sit. */
  async techniques(hand) {
    for (const technique of [...TECHNIQUES.slice(1), TECHNIQUES[0]]) {
      await inFramePanel(hand, async () => {
        await hand.press(pickerButton(hand, 'frame-technique'))
        await hand.press(techniqueOption(hand, technique))
      })
      await hand.wait(HOLD.technique)
    }
  },
  /** Paint, three beads under the kaleidoscope, then Undo. */
  async editing(hand) {
    await hand.press('pill-tool-paint')
    await pickColor(hand, 'P')
    await hand.stroke([inFrame(9, 4), inFrame(9, 5), inFrame(9, 6)])
    await hand.wait(HOLD.undo)
    await hand.press('strip-undo')
  },
  /** Mirror over the whole Frame, Radial with 4 folds: a few beads round the kaleidoscope, each followed by its
   * counterparts, then another color and a few more, completing it. */
  async mirror(hand) {
    await mirrorWholeFrame(hand)
    await hand.press(() => hand.root.querySelector('[data-testid="mirror-bar-axis-radial"]') ?? hand.root.querySelector('[data-testid="mirror-bar-chip-radial"] button'))
    for (let presses = 0; presses < 2 && !foldIs(hand, 4); presses++) await hand.press('mirror-bar-radial-more')
    await hand.press('pill-tool-paint')
    for (const { color, beads } of DEMO_MIRROR_BEADS) {
      await pickColor(hand, color)
      for (const [row, column] of beads) await hand.stroke([inFrame(row, column)])
    }
  },
  /** The Frame emptied, a picture laid under the beads, made a little smaller from its corner, then traced. */
  async reference(hand) {
    await hand.press('pill-tool-mirror')
    await hand.press('mirror-bar-close')
    await hand.press('pill-tool-select')
    await hand.drag(FRAME_FIRST, FRAME_LAST)
    await pressSelectionBar(hand, 'clear', () => hand.canvas.onClearSelection())
    // The kaleidoscope is all there is on the Canvas, so Delete asks first.
    if (await present(hand, 'delete-all-modal')) await hand.press('confirm-modal-confirm')
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
  /** Convert image from the Menu: the landscape chosen as its file picker would hand it over, the picture converted, its
   * found colors, then left, nothing made. */
  async convert(hand) {
    await hand.press('strip-menu')
    await hand.press('menu-convert-image')
    const picture = await landscapeFile()
    await hand.pressWith('convert-choose-file', () => hand.canvas.convertSession.value?.setFile(picture))
    await hand.find('convert-image-canvas')
    await hand.wait(HOLD.convertPicture)
    await hand.press('convert-step-colors')
    const colorByColor = await hand.find('convert-color-by-color')
    if (colorByColor.getAttribute('aria-expanded') !== 'true') await hand.press('convert-color-by-color')
    await hand.hover('convert-found-colors', HOLD.convertColors)
    await hand.press('convert-close')
    if (await present(hand, 'leave-converter-modal')) await hand.press('confirm-modal-confirm')
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
      await hand.wait(HOLD.letters)
    })
  },
  /** Replace Frame from the Starter gallery: Earrings, V fringe, its setup looked through, Replace. */
  async starters(hand) {
    await hand.press('strip-frame')
    await hand.press('frame-replace-from-starter')
    await hand.press('starter-category-earrings')
    await hand.press('starter-card-vFringe')
    await hand.scroll(() => hand.root.querySelector('[data-testid="panel-body"]'), 240, HOLD.starterScroll)
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
      await hand.wait(step < ROW_DONE_SLOW ? HOLD.rowDoneSlow : HOLD.rowDoneQuick)
    }
    await hand.wait(HOLD.patternDone)
  },
  /** The Frame panel opened on Beads needed. */
  async beadsNeeded(hand) {
    await inFramePanel(hand, async () => {
      await hand.hover('bead-quantities', HOLD.beadsNeeded, 'start')
    })
  },
  /** The Frame panel's Export: the printable chart, shown and not downloaded. */
  async exports(hand) {
    await inFramePanel(hand, async () => {
      await hand.hover('export-pdf', HOLD.exports)
    })
  },
  /** Saved Projects in the Menu: the demo's own three. */
  async savedProjects(hand) {
    await hand.press('strip-menu')
    await hand.press('menu-saved-projects')
    await hand.wait(HOLD.savedProjects)
    await hand.press('strip-menu')
  },
}

/** The beads kept clear between the Frame's sheet and a drawing beside it. */
const SHEET_ROOM = 4

/** The Canvas columns left of the landscape the Starter's Frame is moved into, its sheet clear of the landscape. */
const ASIDE = { left: DEMO_FRAME.column - 12, right: DEMO_FRAME.column - SHEET_ROOM }

/** The new Frame lands where the old one was, in the view's middle: the ghost moves it left, so the landscape stays on
 * the Canvas beside it. */
async function moveFrameAside(hand: Hand): Promise<void> {
  const project = hand.canvas.activeProject.value
  const frame = project && frameOf(project)
  if (!frame) return
  const column = ASIDE.left + Math.max(0, Math.floor((ASIDE.right - ASIDE.left - frame.columns) / 2))
  if (column === frame.column) return
  const from = { row: frame.row, column: frame.column }
  await hand.dragFrame('frame-move-handle', from, { row: frame.row, column })
}

/** A Selection bar button. The bar arms itself a moment after a Selection (ticket 499), so a stylus tap that selects
 * doesn't press it too; applied at once there is no tap to guard against, so the hand does what the button does through
 * the handler it reaches, rather than wait for it to arm (ticket 0802). */
async function pressSelectionBar(hand: Hand, id: 'frame' | 'clear', run: () => void): Promise<void> {
  if (!hand.instant) {
    await hand.press(`context-bar-${id}`)
    return
  }
  run()
  await hand.wait(0)
}

/** Mirror over the whole Frame from the Margin sheet's band: its own button where the band has room for it (`full`,
 * `compact`), else the Frame tools menu that holds it (`folded`, `narrow`; MarginSheet card, Zoom forms). */
async function mirrorWholeFrame(hand: Hand): Promise<void> {
  if (hand.root.querySelector('[data-testid="margin-mirror-frame"]')) {
    await hand.press('margin-mirror-frame')
    return
  }
  await hand.press('margin-frame-tools')
  await hand.press('margin-frame-tools-mirror')
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

/** How much of its width the reference image keeps when the ghost makes it a little smaller. */
const REFERENCE_SHRINK = 0.86

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
  const width = place.width * REFERENCE_SHRINK
  const shrunk = { ...place, width, x: place.x - (place.width - width) / 2, y: place.y - ((place.width - width) * (picture.height / picture.width)) / 2 }
  const box = corner.closest('[data-testid="reference-adjust"]')!.getBoundingClientRect()
  await hand.moveTo({ x: from.x - box.width * (1 - REFERENCE_SHRINK), y: from.y - box.height * (1 - REFERENCE_SHRINK) })
  flow.commit(shrunk)
}

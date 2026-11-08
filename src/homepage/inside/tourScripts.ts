import type { GridPosition } from '../../domain/grid'
import type { InsideRowId } from '../../i18n/translations'
import type { Hand } from './hand'
import { TECHNIQUES } from '../../domain/weave'
import { DEMO_COLORS, DEMO_FRAME, DEMO_LETTERING, DEMO_MIRROR_BEADS, DEMO_REPEAT_AXES, DEMO_STARTER, DEMO_TECHNIQUE, PANORAMA, RIDGE, SUN, type DemoColor } from './demoProjects'
import { landscapeFile } from './landscape'

// What the ghost does for each row of What's inside (Homepage card, ticket 0797), in the demo editor, each row picking
// up where the one before it left the editor.

/** The Palette swatch of each color the tour draws with: Miyuki's color families. */
const SWATCH_IDS: Record<DemoColor, string> = { W: 'white', Y: 'yellow', O: 'orange', R: 'red', B: 'blue', G: 'green', P: 'pink', K: 'black', D: 'gold' }

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

/** A bead of the Frame, by its place in the Frame. */
function inFrame(row: number, column: number): GridPosition {
  return { row: DEMO_FRAME.row + row, column: DEMO_FRAME.column + column }
}

/** The Frame's corners, for a drag over the whole of it. */
const FRAME_FIRST = inFrame(0, 0)
const FRAME_LAST = inFrame(DEMO_FRAME.rows - 1, DEMO_FRAME.columns - 1)

/** The panorama the ghost traces over the Reference image, in the band: the sun and the ridge's snow line painted, the
 * ground's row, the sky and the slopes filled from one bead each; flowers at the mountains' foot. */
const LANDSCAPE = {
  sun: [inFrame(SUN.row, SUN.column), inFrame(SUN.row, SUN.column + 1), inFrame(SUN.row + 1, SUN.column + 1), inFrame(SUN.row + 1, SUN.column)],
  ridge: RIDGE.flatMap((row, column) => {
    const next = RIDGE[column + 1] ?? row
    const down = next > row ? 1 : -1
    return Array.from({ length: Math.abs(next - row) + 1 }, (_, step) => inFrame(row + step * down, column))
  }),
  ground: Array.from({ length: PANORAMA.columns }, (_, column) => inFrame(PANORAMA.rows - 1, column)),
  sky: inFrame(0, 0),
  slopes: inFrame(PANORAMA.rows - 2, 9),
  flowers: [inFrame(5, 6), inFrame(5, 16), inFrame(5, 28)],
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
  /** Row done's passes: the first three slower, then quicker; then a rest, the ring's other rounds left undone. */
  rowDoneSlow: 840,
  rowDoneQuick: 288,
  rowProgressRest: 1440,
  beadsNeeded: 3600,
  exports: 4560,
  savedProjects: 3840,
} as const
/** How many of Row done's passes are slower. */
const ROW_DONE_SLOW = 3

/** The swatch the sky is filled with: Miyuki's Iridescent, a pale blue. */
const SKY_SWATCH = 'iridescent'
/** The ground's swatch, and the mountains' slopes'. */
const GROUND_SWATCH = 'brown'
const SLOPES_SWATCH = 'grey'
/** How many of Row done's passes the tour shows of the ring's rounds, before it rests.
 * @internal Its browser test checks the tour ends there. */
export const ROW_DONE_PASSES = 10
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
  /** The open Canvas: a ring's lettering in gold with Paint, a Selection round it becomes the Frame, then Fill makes its
   * ground black. */
  async canvas(hand) {
    await hand.press('pill-tool-paint')
    await pickColor(hand, 'D')
    for (const stroke of DEMO_LETTERING) await hand.stroke(stroke.map(([row, column]) => inFrame(row, column)))
    await hand.press('pill-tool-select')
    await hand.drag(FRAME_FIRST, FRAME_LAST)
    await hand.hover('context-bar-frame', HOLD.setFrame)
    await pressSelectionBar(hand, 'frame', () => hand.canvas.onFrameFromSelection())
    await hand.press('pill-tool-fill')
    await pickColor(hand, 'K')
    await hand.stroke([inFrame(0, 0)])
  },
  /** The Frame's Technique, each of the others in turn and back to the ring's peyote, each held a moment with the panel
   * shut so the beads show how they sit. */
  async techniques(hand) {
    for (const technique of [...TECHNIQUES.filter((each) => each !== DEMO_TECHNIQUE), DEMO_TECHNIQUE]) {
      await inFramePanel(hand, async () => {
        await hand.press(pickerButton(hand, 'frame-technique'))
        await hand.press(techniqueOption(hand, technique))
      })
      await hand.wait(HOLD.technique)
    }
  },
  /** Paint, three gold beads above the lettering, then Undo. */
  async editing(hand) {
    await hand.press('pill-tool-paint')
    await pickColor(hand, 'D')
    await hand.stroke([inFrame(0, 16), inFrame(0, 17), inFrame(0, 18)])
    await hand.wait(HOLD.undo)
    await hand.press('strip-undo')
  },
  /** Mirror over the whole Frame in Repeat, its band cut into strips a letter wide: a dot above and below the first gap,
   * and the ring has them all round. */
  async mirror(hand) {
    await mirrorWholeFrame(hand)
    await hand.press('mirror-bar-mode-repeat')
    for (let presses = 0; presses < 6 && !axesAre(hand, DEMO_REPEAT_AXES); presses++) await hand.press('mirror-bar-leftRight-more')
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
    // The ring is all there is on the Canvas, so Delete asks first.
    if (await present(hand, 'delete-all-modal')) await hand.press('confirm-modal-confirm')
    const picture = await landscapeFile()
    await hand.pressWith('strip-reference-image', () => hand.canvas.referenceImage.pick(picture, 'strip'))
    await shrinkReference(hand)
    await hand.press('reference-adjust-done')
    await hand.press('pill-tool-paint')
    await pickColor(hand, 'Y')
    await hand.stroke(LANDSCAPE.sun)
    await pickColor(hand, 'W')
    await hand.stroke(LANDSCAPE.ridge)
    await pickSwatch(hand, GROUND_SWATCH)
    await hand.stroke(LANDSCAPE.ground)
    await hand.press('pill-tool-fill')
    await pickSwatch(hand, SKY_SWATCH)
    await hand.stroke([LANDSCAPE.sky])
    await pickSwatch(hand, SLOPES_SWATCH)
    await hand.stroke([LANDSCAPE.slopes])
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
  /** The color popover's Miyuki Delica palette, a catalog color picked, a few flowers at the mountains' foot. */
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
  /** Replace Frame from the Starter gallery: Rings, Chevrons, its setup looked through (the ring's size inside), Replace.
   * A ring the same size as the band, it lands where the band was. */
  async starters(hand) {
    await hand.press('strip-frame')
    await hand.press('frame-replace-from-starter')
    await hand.press('starter-category-rings')
    await hand.press(`starter-card-${DEMO_STARTER}`)
    await hand.scroll(() => hand.root.querySelector('[data-testid="panel-body"]'), 240, HOLD.starterScroll)
    await hand.press('create-starter-project')
    if (await present(hand, 'replace-frame-modal')) await hand.press('confirm-modal-confirm')
  },
  /** Row done for the ring's first rounds, the first three slower, then a rest: a ring has too many to show them all. */
  async rowProgress(hand) {
    for (let step = 0; step < ROW_DONE_PASSES; step++) {
      const next = hand.root.querySelector('[data-testid="progress-bar-next"]')
      if (!next || next.getAttribute('aria-disabled') === 'true' || (next as HTMLButtonElement).disabled) break
      await hand.press('progress-bar-next')
      await hand.wait(step < ROW_DONE_SLOW ? HOLD.rowDoneSlow : HOLD.rowDoneQuick)
    }
    await hand.wait(HOLD.rowProgressRest)
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

/** Whether the Mirror has `count` Left–right Axes. */
function axesAre(hand: Hand, count: number): boolean {
  const value = hand.root.querySelector('[data-testid="mirror-bar-leftRight-value"]')
  return value?.textContent?.trim() === String(count)
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

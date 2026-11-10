import type { GridPosition } from '../../domain/grid'
import type { InsideRowId } from '../../i18n/translations'
import type { Hand } from './hand'
import type { ReferencePlace } from '../../domain/referenceImage'
import { addedColorId } from '../../domain/palette'
import { watch } from 'vue'
import { TECHNIQUES } from '../../domain/weave'
import { DEMO_COLORS, DEMO_CUFF, DEMO_CUFF_AXES, DEMO_EDIT_BEADS, DEMO_FIRST_STRIP, DEMO_FRAME, DEMO_MIRROR_STRIP, DEMO_RING_AXES, DEMO_STARTER, DEMO_TECHNIQUE, PEACOCK_COLORS, onCanvas, type DemoColor, type DemoFrame } from './demoProjects'
import { balloonFile } from './balloon'
import { PEACOCK_CUFF } from './peacock'
import { peacockFile } from './peacockPicture'
import { eyeByHand, eyeTrace, pupilMiddle, ringGroundFills, type TraceBead, type TraceStep } from './peacockTrace'

// What the ghost does for each row of What's inside (Homepage card, ticket 0797), in the demo editor, each row picking
// up where the one before it left the editor.

/** The Palette swatch of each color the tour draws with: Miyuki's color families, and Ring's own three, named as Custom
 * color names what it adds. */
const SWATCH_IDS: Record<DemoColor, string> = {
  W: 'white',
  Y: 'yellow',
  R: 'red',
  B: 'blue',
  G: 'green',
  D: 'gold',
  T: addedColorId(DEMO_COLORS.T),
  N: addedColorId(DEMO_COLORS.N),
  E: addedColorId(DEMO_COLORS.E),
}

/** Picks a Palette swatch by its id through the color popover. */
async function pickSwatch(hand: Hand, id: string): Promise<void> {
  await hand.press('pill-color')
  await hand.press(() => hand.root.querySelector(`[data-testid="palette-swatch"][data-color-id="${id}"]`))
  if (hand.root.querySelector('[data-testid="color-popover"]')) await hand.press('color-popover-close')
}

/** A catalog color the tour picks: its code, and the color family whose filter brings it into the list, which shows
 * the catalog's first colors only. */
interface CatalogPick {
  code: string
  family: string
}

/** The Palette swatch of a catalog color, from the color popover's open catalog list: added to the Palette first unless
 * it is there already. Adding leaves the paint color as it was, so the swatch is what makes it the paint color. */
async function catalogSwatch(hand: Hand, { code, family }: CatalogPick): Promise<() => Element | undefined> {
  const row = () => hand.root.querySelector(`[data-testid="bead-color"][data-code="${code}"]`)
  await hand.find('bead-colors-count')
  if (!row()) {
    const filter = () => hand.root.querySelector<HTMLElement>(`[data-testid="bead-colors-family"][data-value="${family}"]`)
    // A narrow popover folds its filters behind their button.
    if (!filter()?.offsetParent) await hand.press('bead-colors-filters-toggle')
    await hand.press(filter)
    await present(hand, row)
  }
  if (!row()?.hasAttribute('data-taken')) await hand.press(row)
  return () => {
    const hex = Object.entries(hand.canvas.activeProject.value?.paletteCodes ?? {}).find(([, each]) => each === code)?.[0]
    return hex ? (hand.root.querySelector(`[data-testid="palette-swatch"][data-color-id="${addedColorId(hex)}"]`) ?? undefined) : undefined
  }
}

/** Picks a color on the Tool pill: a recent swatch, or the color popover for one that isn't recent. */
async function pickColor(hand: Hand, color: DemoColor): Promise<void> {
  const hex = DEMO_COLORS[color]
  const recent = () => [...hand.root.querySelectorAll('[data-testid="pill-recent"]')].find((button) => button.getAttribute('aria-label')?.toLowerCase().includes(hex))
  if (recent()) await hand.press(recent)
  else await pickSwatch(hand, SWATCH_IDS[color])
}

/** The beads of a drawing on Ring's Canvas, in `frame`. */
function beadsOn(frame: DemoFrame, beads: readonly TraceBead[]): GridPosition[] {
  return beads.map(([line, along]) => onCanvas(frame, line, along))
}

/** A Frame's corners, for a drag over the whole of it. */
function cornersOf(frame: DemoFrame): [GridPosition, GridPosition] {
  return [onCanvas(frame, 0, 0), onCanvas(frame, frame.columns - 1, frame.rows - 1)]
}

/** A bead to the next along a line traced over the picture, in ms: half a bead drawn by hand, as the line is there to
 * follow (a Selection's drag is quicker still). It takes 13s off Reference image, the longest row (about 72s). */
const TRACE_MS = 70

/** Draws `steps` in `frame`: each color picked, its strokes painted (`ms` a bead; the hand's own pace unless given),
 * then Fill pressed where it fills. The tool is pressed only when it changes. */
async function draw(hand: Hand, frame: DemoFrame, steps: readonly TraceStep[], ms?: number): Promise<void> {
  let tool: 'paint' | 'fill' | undefined
  const take = async (next: 'paint' | 'fill') => {
    if (tool !== next) await hand.press(`pill-tool-${next}`)
    tool = next
  }
  for (const { part, strokes, fills } of steps) {
    if (strokes.length > 0) await take('paint')
    await pickColor(hand, PEACOCK_COLORS[part])
    for (const stroke of strokes) await hand.stroke(beadsOn(frame, stroke), ms)
    if (fills.length > 0) await take('fill')
    for (const press of fills) await hand.stroke(beadsOn(frame, [press]))
  }
}

/** The cuff's strip the ghost traces its eye in: the middle one. */
const CUFF_TRACE_STRIP = 1

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

/** How many of Row done's passes the tour shows of the cuff's rows, before it rests.
 * @internal Its browser test checks the tour ends there. */
export const ROW_DONE_PASSES = 10
/** The catalog color the cuff's pupils are painted in (Homepage card, Colors built in): DB799, a matte purple. Not an
 * opaque one such as DB660: the catalog draws those in their family's color, which Miyuki's Palette holds from the
 * start, so the list reads them In Palette and adds nothing. */
const PUPIL_COLOR: CatalogPick = { code: 'DB799', family: 'Purple' }

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
  /** The open Canvas: one eye of the feather with Paint, color by color from its green ring in, a Selection round the
   * band becomes the Frame, then Fill makes its ground deep green, either side of the eye. */
  async canvas(hand) {
    await draw(hand, DEMO_FRAME, eyeByHand(DEMO_FIRST_STRIP))
    await hand.press('pill-tool-select')
    await hand.drag(...cornersOf(DEMO_FRAME))
    await hand.hover('context-bar-frame', HOLD.setFrame)
    await pressSelectionBar(hand, 'frame', () => hand.canvas.onFrameFromSelection())
    await hand.press('pill-tool-fill')
    await pickColor(hand, 'E')
    for (const press of ringGroundFills(DEMO_FIRST_STRIP)) await hand.stroke(beadsOn(DEMO_FRAME, [press]))
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
  /** Paint, three gold beads on the ground beside the eye, then Undo. */
  async editing(hand) {
    await hand.press('pill-tool-paint')
    await pickColor(hand, 'D')
    await hand.stroke(beadsOn(DEMO_FRAME, DEMO_EDIT_BEADS))
    await hand.wait(HOLD.undo)
    await hand.press('strip-undo')
  },
  /** Mirror over the whole Frame in Repeat, its band cut into strips an eye long: the eye drawn again in the second
   * strip, and the ring has it all round. */
  async mirror(hand) {
    await repeatAlong(hand, DEMO_RING_AXES)
    await draw(hand, DEMO_FRAME, eyeByHand(DEMO_MIRROR_STRIP))
  },
  /** The Mirror closed, then Replace Frame from the Starter gallery: Rings, Chevrons, its setup looked through (the
   * ring's size inside), Replace. A ring the same size as the band, it lands where the band was (fifth since 0830). */
  async starters(hand) {
    await closeMirror(hand)
    await hand.press('strip-frame')
    await hand.press('frame-replace-from-starter')
    await hand.press('starter-category-rings')
    await hand.press(`starter-card-${DEMO_STARTER}`)
    await hand.scroll(() => hand.root.querySelector('[data-testid="panel-body"]'), 240, HOLD.starterScroll)
    await hand.press('create-starter-project')
    if (await present(hand, 'replace-frame-modal')) await hand.press('confirm-modal-confirm')
  },
  /** The Starter's ring deleted, a cuff's Frame set from a new Selection in place of the ring's (nothing is asked: it
   * holds nothing now), a picture of the feather landed smaller than the Frame and grown to fit it, then one eye traced
   * in Repeat: each ring's edge painted and its inside filled, the ground filled, the barbs painted over it. */
  async reference(hand) {
    await hand.press('pill-tool-select')
    await hand.drag(...cornersOf(DEMO_FRAME))
    await pressSelectionBar(hand, 'clear', () => hand.canvas.onClearSelection())
    // The Starter's ring is all there is on the Canvas, so Delete asks first.
    if (await present(hand, 'delete-all-modal')) await hand.press('confirm-modal-confirm')
    await hand.drag(...cornersOf(DEMO_CUFF))
    await pressSelectionBar(hand, 'frame', () => hand.canvas.onFrameFromSelection())
    await growReference(hand, await peacockFile())
    await hand.press('reference-adjust-done')
    await repeatAlong(hand, DEMO_CUFF_AXES)
    await draw(hand, DEMO_CUFF, eyeTrace(PEACOCK_CUFF, CUFF_TRACE_STRIP), TRACE_MS)
    await closeMirror(hand)
  },
  /** Convert image from the Menu: a balloon chosen as its file picker would hand it over (another picture than the
   * Reference image's feather), the picture converted, its found colors, then left, nothing made. */
  async convert(hand) {
    await hand.press('strip-menu')
    await hand.press('menu-convert-image')
    const picture = await balloonFile()
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
  /** The color popover's Miyuki Delica palette, a catalog purple found among its purples and picked, the middle line of each eye's pupil painted
   * in it, from the left as the cuff lies. */
  async colors(hand) {
    await hand.press('pill-tool-paint')
    await hand.press('pill-color')
    await hand.press('bead-colors-toggle')
    await hand.press(await catalogSwatch(hand, PUPIL_COLOR))
    if (hand.root.querySelector('[data-testid="color-popover"]')) await hand.press('color-popover-close')
    for (let strip = DEMO_CUFF_AXES; strip >= 0; strip--) await hand.stroke(beadsOn(DEMO_CUFF, pupilMiddle(strip)))
  },
  /** Letters: each color's letter on its beads. */
  async letters(hand) {
    await inFramePanel(hand, async () => {
      await hand.press('frame-letters')
      await hand.wait(HOLD.letters)
    })
  },
  /** Row done for the traced cuff's first rows, the first three slower, then a rest: too many to show them all. */
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

/** The Mirror's axis that cuts a piece along its length: on Ring's turned Canvas the Frame's rows run along the piece,
 * and the Mirror names its axes by the Frame's rows and columns, so it is Top–bottom. */
const ALONG = 'topBottom'
/** The Mirror's other axis, which the tour keeps off: it would cut the piece across its width. */
const ACROSS = 'leftRight'

/** Whether a Mirror axis is on. */
function axisOn(hand: Hand, axis: string): boolean {
  return !!hand.root.querySelector(`[data-testid="mirror-bar-chip-${axis}"]`)?.classList.contains('mirror-bar__chip--on')
}

/** How many Axes the Mirror has along the piece. */
function axesAlong(hand: Hand): number {
  return Number(hand.root.querySelector(`[data-testid="mirror-bar-${ALONG}-value"]`)?.textContent?.trim())
}

/** Mirror over the whole Frame in Repeat, `axes` Axes cutting the piece along its length into strips. */
async function repeatAlong(hand: Hand, axes: number): Promise<void> {
  await mirrorWholeFrame(hand)
  await hand.press('mirror-bar-mode-repeat')
  await hand.find('mirror-bar-chips')
  if (!axisOn(hand, ALONG)) await hand.press(`mirror-bar-axis-${ALONG}`)
  if (axisOn(hand, ACROSS)) await hand.press(`mirror-bar-axis-${ACROSS}`)
  for (let presses = 0; presses < 8 && axesAlong(hand) !== axes; presses++) await hand.press(`mirror-bar-${ALONG}-${axesAlong(hand) < axes ? 'more' : 'fewer'}`)
}

/** Closes the Mirror from its bar, which the Tool pill's Mirror tile brings back while another tool is in hand. */
async function closeMirror(hand: Hand): Promise<void> {
  if (!hand.root.querySelector('[data-testid="mirror-bar-close"]')) await hand.press('pill-tool-mirror')
  await hand.press('mirror-bar-close')
}

/** Whether a dialog or control shows up within a moment. */
async function present(hand: Hand, target: string | (() => Element | null)): Promise<boolean> {
  const there = () => (typeof target === 'string' ? hand.root.querySelector(`[data-testid="${target}"]`) : target())
  for (let frames = 0; frames < 10; frames++) {
    if (there()) return true
    await hand.frame()
  }
  return false
}

/** How much of the Frame's width the reference image lands at, before the ghost makes it fit. */
const REFERENCE_LANDS_AT = 0.7

/** The picture laid under the beads smaller than the Frame, its top-left where its fit's is, then grown from its
 * bottom-right corner to fit the Frame, as a drag would. It is made smaller the moment it lands, so it never shows at
 * its fit first. */
async function growReference(hand: Hand, picture: File): Promise<void> {
  const flow = hand.canvas.referenceImage
  let fit: ReferencePlace | undefined
  const landing = watch(() => flow.image.value, (image) => {
    if (!image) return
    landing()
    fit = image.place
    flow.commit(smallerFrom(image.place, image.picture.height / image.picture.width))
  }, { flush: 'sync' })
  try {
    await hand.pressWith('strip-reference-image', () => flow.pick(picture, 'strip'))
  } finally {
    landing()
  }
  if (!fit) return
  await hand.find('reference-adjust')
  const corner = await hand.find(() => [...hand.root.querySelectorAll('.reference-adjust__corner')].at(-1))
  const from = hand.middleOf(corner)
  await hand.moveTo(from)
  const box = corner.closest('[data-testid="reference-adjust"]')!.getBoundingClientRect()
  const grow = 1 / REFERENCE_LANDS_AT - 1
  // The picture turns with Ring's Canvas, so its bottom-right corner is another on screen: it is dragged out from the middle.
  const out = { x: Math.sign(from.x - (box.left + box.width / 2)), y: Math.sign(from.y - (box.top + box.height / 2)) }
  await hand.moveTo({ x: from.x + out.x * box.width * grow, y: from.y + out.y * box.height * grow })
  flow.commit(fit)
}

/** `place` made `REFERENCE_LANDS_AT` as wide, its top-left staying: a place is held by its middle. `heightPerWidth` is
 * the picture's height over its width. */
function smallerFrom(place: ReferencePlace, heightPerWidth: number): ReferencePlace {
  const width = place.width * REFERENCE_LANDS_AT
  const less = place.width - width
  return { ...place, width, x: place.x - less / 2, y: place.y - (less * heightPerWidth) / 2 }
}

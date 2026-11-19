import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref, watch } from 'vue'
import { page } from 'vitest/browser'
import { mountAt } from '../../testUtils/browserFit'
import { linesOf, painted, placeOf } from '../../testUtils/demoDrawing'
import { currentPass, rowProgressOf } from '../../domain/rowProgress'
import { beadColorAt } from '../../domain/layerBeads'
import type { Project } from '../../domain/project'
import type { ReferencePlace } from '../../domain/referenceImage'
import type { InsideRowId } from '../../i18n/translations'
import InsideEditor from './InsideEditor.vue'
import { DEMO_COLORS } from './demoProjects'
import { PEACOCK_CUFF, PEACOCK_RING } from './peacock'
import { ROW_DONE_PASSES, TOUR_SCRIPTS } from './tourScripts'

// The tour's rows applied at once on the real demo editor (ticket 0821), as a press on a later row applies them: what
// they leave on the ring's band and on the cuff (ticket 0831).

/** The demo editor in a box the size of the desk's, and its handle. */
async function demoEditor() {
  const editor = ref<InstanceType<typeof InsideEditor>>()
  const Box = defineComponent(() => () => h('div', { style: { display: 'grid', width: '1100px', height: '700px' } }, [h(InsideEditor, { ref: editor })]))
  await mountAt(Box, {}, { locale: 'en', width: 1440, text: false })
  await page.viewport(1440, 900)
  await editor.value!.fresh()
  return editor.value!
}

/** Applies the rows up to and with `last`, at once. */
async function applyThrough(editor: InstanceType<typeof InsideEditor>, last: InsideRowId) {
  const hand = editor.hand(true, new AbortController().signal)
  for (const [row, script] of Object.entries(TOUR_SCRIPTS)) {
    await script(hand)
    if (row === last) break
  }
  return hand.canvas.activeProject.value!
}

/** The middle line of each of the cuff's pupils, 3 beads long: the beads Colors built in paints. */
const PUPIL_BEADS = [0, 16, 32].flatMap((eye) => [6, 7, 8].map((along) => ({ line: 13, along: eye + along })))

/** The catalog code of each of the pupils' middle beads. */
function pupilCodes(project: Project): (string | undefined)[] {
  const { row, column } = placeOf(project)
  return PUPIL_BEADS.map(({ line, along }) => {
    const color = beadColorAt(project, row + along, column + line, 'frame')
    return color ? project.paletteCodes?.[color.toLowerCase()] : undefined
  })
}

describe("What's inside's first rows on the ring (ticket 0831)", () => {
  it('sets a band 36 long and 7 wide as the Frame and draws one eye at its left, the rest deep green', async () => {
    const project = await applyThrough(await demoEditor(), 'canvas')
    expect(placeOf(project)).toEqual({ row: 10, column: 12, rows: 36, columns: 7 })
    const eye = ['...GGG...', '..GDDG...', '..DTTTD..', '.GTBBTG..', '..DBNBD..', '..DTTD...', '...GGG...']
    expect(linesOf(project)).toEqual(eye.map((line) => '.'.repeat(27) + line))
  }, 60000)

  it("leaves the band as it was after Project editing: its gold beads undone", async () => {
    const editor = await demoEditor()
    const before = linesOf(await applyThrough(editor, 'canvas'))
    const hand = editor.hand(true, new AbortController().signal)
    await TOUR_SCRIPTS.editing(hand)
    expect(linesOf(hand.canvas.activeProject.value!)).toEqual(before)
  }, 60000)

  it("leaves the band as it was after Tools at the pointer, its beads undone and the eye's blue picked, the Radial toolbox never opened (ticket 1114)", async () => {
    const editor = await demoEditor()
    const before = linesOf(await applyThrough(editor, 'editing'))
    const hand = editor.hand(true, new AbortController().signal)
    let opened = 0
    const stop = watch(hand.canvas.radialToolbox.open, (open) => open && (opened += 1), { flush: 'sync' })
    await TOUR_SCRIPTS.toolsAtPointer(hand)
    stop()
    expect(linesOf(hand.canvas.activeProject.value!)).toEqual(before)
    expect(opened, 'applied at once, the ring is never shown').toBe(0)
    expect(hand.canvas.selectedColorHex()).toBe(DEMO_COLORS.B)
    expect(hand.canvas.canRedo.value, 'its three beads were painted, then undone').toBe(true)
  }, 60000)

  it('has four eyes after the Mirror row drew the second: Repeat lays it in every strip', async () => {
    const project = await applyThrough(await demoEditor(), 'mirror')
    expect(linesOf(project)).toEqual(PEACOCK_RING.rows)
  }, 60000)
})

describe("What's inside's Starters row on the ring (ticket 0832)", () => {
  it("lays the Starter's ring where the band was: the same Frame, 36 long and 7 wide", async () => {
    const project = await applyThrough(await demoEditor(), 'starters')
    expect(placeOf(project)).toEqual({ row: 10, column: 12, rows: 36, columns: 7 })
    expect(linesOf(project), "the Starter's own ring, not the eyes").not.toEqual(PEACOCK_RING.rows)
  }, 60000)
})

describe("What's inside's Reference image row on the cuff (ticket 0831)", () => {
  it('sets a cuff 48 long and 23 wide round the same middle and traces the feather on it, bead for bead', async () => {
    const project = await applyThrough(await demoEditor(), 'reference')
    expect(placeOf(project)).toEqual({ row: 4, column: 4, rows: 48, columns: 23 })
    expect(linesOf(project)).toEqual(painted(PEACOCK_CUFF))
  }, 120000)

  it('lands its picture smaller than the Frame, then grows it to fit (ticket 0828)', async () => {
    const editor = await demoEditor()
    const flow = editor.hand(true, new AbortController().signal).canvas.referenceImage
    const places: ReferencePlace[] = []
    const stop = watch(() => flow.image.value?.place, (place) => place && places.push(place), { flush: 'sync' })
    await applyThrough(editor, 'reference')
    stop()
    const [fit] = places
    expect(places.length, 'the fit, a smaller place, the fit again').toBeGreaterThanOrEqual(3)
    expect(places[1]!.width / fit!.width, 'shown at 70% first').toBeCloseTo(0.7, 2)
    expect(places.at(-1), 'grown back to the fit').toEqual(fit)
  }, 120000)
})

describe("What's inside's last chapter on the cuff (ticket 0831)", () => {
  it('counts Row done on the traced cuff, its purple pupils still there', async () => {
    const project = await applyThrough(await demoEditor(), 'exports')
    expect(currentPass(rowProgressOf(project)), 'Row done pressed for the first rows').toBe(ROW_DONE_PASSES)
    expect(pupilCodes(project)).toEqual(PUPIL_BEADS.map(() => 'DB799'))
  }, 120000)
})

// Last: a Colors row run in one mount moves the Starter ring the next mount lays (seen in ticket 0828, not yet traced).
describe("What's inside's Colors built in row on the cuff (ticket 0831)", () => {
  it("paints the middle line of each pupil in the catalog color it picked, Delica's DB799, and nothing else", async () => {
    const project = await applyThrough(await demoEditor(), 'colors')
    expect(pupilCodes(project)).toEqual(PUPIL_BEADS.map(() => 'DB799'))
    const purple = linesOf(project).flatMap((line, at) => [...line].flatMap((part, along) => (part === '?' ? [{ line: at, along }] : [])))
    expect(purple).toEqual(PUPIL_BEADS)
  }, 120000)

  it('paints them in DB799 when the Palette has it already', async () => {
    const editor = await demoEditor()
    await applyThrough(editor, 'colors')
    const hand = editor.hand(true, new AbortController().signal)
    await TOUR_SCRIPTS.colors(hand)
    expect(pupilCodes(hand.canvas.activeProject.value!)).toEqual(PUPIL_BEADS.map(() => 'DB799'))
  }, 120000)
})

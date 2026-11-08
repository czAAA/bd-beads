import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { page } from 'vitest/browser'
import { mountAt } from '../../testUtils/browserFit'
import { beadColorAt } from '../../domain/layerBeads'
import { frameOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import type { InsideRowId } from '../../i18n/translations'
import InsideEditor from './InsideEditor.vue'
import { DEMO_FRAME, DEMO_LETTERING, DEMO_MIRROR_BEADS, DEMO_REPEAT_AXES, PANORAMA, RIDGE, SUN } from './demoProjects'
import { TOUR_SCRIPTS } from './tourScripts'

// The tour's rows applied at once on the real demo editor (ticket 0821), as a press on a later row applies them: what
// they leave on the ring's band.

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

/** The color of a bead of the Frame, by its place in the Frame. */
function frameBead(project: Project, row: number, column: number): string | null {
  const frame = frameOf(project)!
  return beadColorAt(project, frame.row + row, frame.column + column, 'frame')
}

describe("What's inside's first rows on the ring (ticket 0821)", () => {
  it('sets the band as the Frame, its lettering one color and its ground another, every bead filled', async () => {
    const project = await applyThrough(await demoEditor(), 'canvas')
    const lettering = new Set(DEMO_LETTERING.flat().map(([row, column]) => frameBead(project, row, column)))
    const ground = new Set<string | null>()
    for (let row = 0; row < DEMO_FRAME.rows; row++) {
      for (let column = 0; column < DEMO_FRAME.columns; column++) {
        if (!DEMO_LETTERING.some((stroke) => stroke.some(([down, across]) => down === row && across === column))) ground.add(frameBead(project, row, column))
      }
    }
    expect(lettering.size, 'the lettering one color').toBe(1)
    expect(ground.size, 'the ground one Fill').toBe(1)
    expect([...lettering, ...ground]).not.toContain(null)
    expect([...lettering][0]).not.toBe([...ground][0])
  }, 60000)

  it("repeats the Mirror row's dots in every strip of the band", async () => {
    const project = await applyThrough(await demoEditor(), 'mirror')
    const width = DEMO_FRAME.columns / (DEMO_REPEAT_AXES + 1)
    const first = DEMO_MIRROR_BEADS.flatMap(({ beads }) => beads.map(([row, column]) => frameBead(project, row, column)))
    for (const { beads } of DEMO_MIRROR_BEADS) {
      for (const [row, column] of beads) {
        for (let strip = 1; strip <= DEMO_REPEAT_AXES; strip++) expect(frameBead(project, row, column + strip * width), `${row},${column + strip * width}`).toBe(first[0])
      }
    }
    expect(first[0]).not.toBeNull()
  }, 60000)
})

describe("What's inside's Reference image row on the ring (ticket 0821)", () => {
  it("traces the panorama: the sky's Fill never under the snow line, the slopes one Fill", async () => {
    const project = await applyThrough(await demoEditor(), 'reference')
    const sky = new Set<string | null>()
    const snow = new Set<string | null>()
    const slopes = new Set<string | null>()
    for (let column = 0; column < PANORAMA.columns; column++) {
      // The snow line runs down its own column to the next column's ridge.
      const [top, bottom] = [Math.min(RIDGE[column], RIDGE[column + 1] ?? RIDGE[column]), Math.max(RIDGE[column], RIDGE[column + 1] ?? RIDGE[column])]
      for (let row = 0; row < PANORAMA.rows - 1; row++) {
        const sun = row >= SUN.row && row < SUN.row + SUN.size && column >= SUN.column && column < SUN.column + SUN.size
        if (sun) continue
        ;(row < top ? sky : row <= bottom ? snow : slopes).add(frameBead(project, row, column))
      }
    }
    expect(sky.size, 'the sky one color').toBe(1)
    expect(snow.size, 'the snow line one color').toBe(1)
    expect(slopes.size, 'the slopes one color, filled in one press').toBe(1)
    const [skyColor, snowColor, slopesColor] = [...sky, ...snow, ...slopes]
    expect(new Set([skyColor, snowColor, slopesColor]).size, 'sky, snow and slopes apart').toBe(3)
    expect([skyColor, slopesColor]).not.toContain(null)
  }, 60000)
})

describe("What's inside's Starters row on the ring (ticket 0821)", () => {
  it("lays the Starter's ring where the band was, the same size", async () => {
    const frame = frameOf(await applyThrough(await demoEditor(), 'starters'))!
    expect({ row: frame.row, column: frame.column, rows: frame.rows, columns: frame.columns }).toEqual(DEMO_FRAME)
  }, 60000)
})

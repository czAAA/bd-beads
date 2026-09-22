import type { Page } from '@playwright/test'
import type { Technique } from '../../src/domain/grid'
import type { Pattern, RowProgress } from '../../src/domain/pattern'
import { gridBox, settle } from '../support/app'
import { beadCentre } from '../support/patterns'

/** What a scenario's steps are working on: the Pattern as seeded, and the zoom the page is at right now, in percent. */
export interface Context {
  pattern: Pattern
  zoom: number
}

/**
 * One thing the visual check looks at (ticket 103): a Pattern in some state, drawn at every zoom and both ways round.
 * Each is a state of the drawn Pattern that a bead-by-bead reference has to keep right — a Technique's geometry, the
 * Row progress overlay in either direction, or one of the pointer-driven overlays.
 */
export interface Scenario {
  name: string
  technique: Technique
  rowProgress?: Partial<RowProgress>
  /** Runs once, at 100%, before any screenshot: makes the state (a Selection, a copied block, a Mirror axis). */
  prepare?: (page: Page, context: Context) => Promise<void>
  /** Runs at each zoom, once the zoom has settled and before the screenshot: puts the pointer where the state needs it. */
  place?: (page: Page, context: Context) => Promise<void>
  /**
   * The beads (as "(row, column)") that something is drawn over, whose centre is therefore meant to differ from the bead's
   * own color when the renderer's own picture is checked bead by bead; "all" when too many are covered to say.
   */
  overlaid?: string[] | 'all'
}

/** The beads of a rectangle, as the check names them. */
const beadsIn = (top: number, left: number, rows: number, columns: number): string[] =>
  Array.from({ length: rows }, (_row, row) => Array.from({ length: columns }, (_column, column) => `(${top + row}, ${left + column})`)).flat()

const TECHNIQUES: Technique[] = ['loom', 'peyote', 'brick']

/** Somewhere off the grid and off the toolbox, so no hover is left over from an earlier step. */
async function pointerAway(page: Page): Promise<void> {
  await page.mouse.move(5, 5)
  await settle(page)
}

async function pointerOnBead(page: Page, { pattern, zoom }: Context, row: number, column: number): Promise<void> {
  const centre = beadCentre(pattern, await gridBox(page), zoom / 100, { row, column })
  await page.mouse.move(centre.x, centre.y)
  await settle(page)
}

/** Drags the Select tool's marquee from one bead to another, the way a person would. */
async function dragSelection(page: Page, context: Context, from: [number, number], to: [number, number]): Promise<void> {
  await page.getByTestId('tool-select').click()
  const box = await gridBox(page)
  const start = beadCentre(context.pattern, box, context.zoom / 100, { row: from[0], column: from[1] })
  const end = beadCentre(context.pattern, box, context.zoom / 100, { row: to[0], column: to[1] })
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 12 })
  await page.mouse.up()
  await settle(page)
}

async function addMirrorAxes(page: Page, leftRight: number, topBottom: number): Promise<void> {
  for (let count = 0; count < leftRight; count += 1) {
    await page.getByTestId('mirror-left-right-increase').click()
  }
  for (let count = 0; count < topBottom; count += 1) {
    await page.getByTestId('mirror-top-bottom-increase').click()
  }
}

function perTechnique(make: (technique: Technique) => Omit<Scenario, 'technique'>): Scenario[] {
  return TECHNIQUES.map((technique) => ({ technique, ...make(technique) }))
}

export const SCENARIOS: Scenario[] = [
  ...perTechnique((technique) => ({ name: `${technique}-plain`, place: pointerAway })),

  // Row progress, both directions, on every Technique: finished beads dimmed, the current row or column outlined.
  ...perTechnique((technique) => ({
    name: `${technique}-progress-rows`,
    rowProgress: { enabled: true, direction: 'rows', currentRow: 4 },
    place: pointerAway,
  })),
  ...perTechnique((technique) => ({
    name: `${technique}-progress-columns`,
    rowProgress: { enabled: true, direction: 'columns', currentColumn: 6 },
    place: pointerAway,
  })),

  // A Selection: the marquee reads as one rectangle even across peyote's and brick stitch's shifted rows.
  ...perTechnique((technique) => ({
    name: `${technique}-selection`,
    prepare: (page, context) => dragSelection(page, context, [2, 3], [6, 9]),
    place: pointerAway,
    overlaid: beadsIn(2, 3, 5, 7),
  })),

  // A paste preview: the copied block in its own colors under the pointer, with the Selection still marked.
  ...perTechnique((technique) => ({
    name: `${technique}-paste-preview`,
    prepare: async (page, context) => {
      await dragSelection(page, context, [1, 1], [3, 4])
      await page.getByTestId('copy-button').click()
    },
    place: (page, context) => pointerOnBead(page, context, 5, 8),
    // The Selection's beads, and the block of 3 × 4 stamped with its corner at (5, 8).
    overlaid: [...beadsIn(1, 1, 3, 4), ...beadsIn(5, 8, 3, 4)],
  })),

  // Mirror's axis lines, one and two directions, in the grid's own (unrotated) space.
  ...(['loom', 'peyote'] as const).map(
    (technique): Scenario => ({
      technique,
      name: `${technique}-mirror-axes`,
      // On peyote a line a third of the way across (110px of 330) runs through the centre of the beads there: column 5 of
      // the even rows, and, two thirds across (220px), column 10 of the odd ones.
      overlaid: technique === 'peyote' ? [0, 2, 4, 6, 8].map((row) => `(${row}, 5)`).concat([1, 3, 5, 7, 9].map((row) => `(${row}, 10)`)) : undefined,
      prepare: (page) => addMirrorAxes(page, 2, 1),
      place: pointerAway,
    }),
  ),

  // Hovering "Mirror current" dims the beads that clicking it would overwrite.
  {
    technique: 'loom',
    name: 'loom-mirror-current-hover',
    overlaid: 'all',
    prepare: (page) => addMirrorAxes(page, 1, 0),
    place: async (page) => {
      await page.getByTestId('mirror-current-horizontal').hover()
      await settle(page)
    },
  },

  // The paint preview on the hovered bead, and its live-mirror counterpart.
  ...perTechnique((technique) => ({
    name: `${technique}-hover-paint`,
    place: (page, context) => pointerOnBead(page, context, 3, 5),
  })),
  {
    technique: 'loom',
    name: 'loom-hover-paint-mirrored',
    // The hovered bead and its counterparts across the two axes.
    overlaid: ['(3, 5)', '(3, 10)', '(6, 5)', '(6, 10)'],
    prepare: (page) => addMirrorAxes(page, 1, 1),
    place: (page, context) => pointerOnBead(page, context, 3, 5),
  },
  // The Erase tool has no color to preview: a neutral outline on the hovered bead.
  {
    technique: 'peyote',
    name: 'peyote-hover-erase',
    prepare: async (page) => {
      await page.getByTestId('tool-erase').click()
    },
    place: (page, context) => pointerOnBead(page, context, 3, 5),
  },
]

import type { Page } from '@playwright/test'
import type { Technique } from '../../src/domain/grid'
import type { Project, RowProgress } from '../../src/domain/project'
import { gridBox, settle } from '../support/app'
import { beadCentre } from '../support/projects'

/** What a scenario's steps are working on: the Project as seeded, and the zoom the page is at right now, in percent. */
interface Context {
  project: Project
  zoom: number
}

/**
 * One thing the visual check looks at (ticket 103): a Project in some state, drawn at every zoom and both ways round.
 * Each is a state of the drawn Project that a bead-by-bead reference has to keep right — a Technique's geometry, the
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

async function pointerOnBead(page: Page, { project, zoom }: Context, row: number, column: number): Promise<void> {
  const centre = beadCentre(project, await gridBox(page), zoom / 100, { row, column })
  await page.mouse.move(centre.x, centre.y)
  await settle(page)
}

/** Drags the Select tool's marquee from one bead to another, the way a person would. */
async function dragSelection(page: Page, context: Context, from: [number, number], to: [number, number]): Promise<void> {
  await page.getByTestId('tool-select').click()
  const box = await gridBox(page)
  const start = beadCentre(context.project, box, context.zoom / 100, { row: from[0], column: from[1] })
  const end = beadCentre(context.project, box, context.zoom / 100, { row: to[0], column: to[1] })
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 12 })
  await page.mouse.up()
  await settle(page)
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

  // The paint preview on the hovered bead (ticket 174 hid Mirror's own UI, and with it its live-mirror preview scenarios, pending its own redesign).
  ...perTechnique((technique) => ({
    name: `${technique}-hover-paint`,
    place: (page, context) => pointerOnBead(page, context, 3, 5),
  })),
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

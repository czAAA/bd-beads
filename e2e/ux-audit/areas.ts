import type { Page } from '@playwright/test'
import { LOCALES } from '../../src/domain/locale'
import { fixturePicture } from '../support/picture'
import { chooseNewProjectTechnique, openColorPopover, openStripPanel, selectTool, settle } from '../support/app'
import { clickIfVisible, escape, openForAudit, surfaceCentre, type State, type Walk } from './support'

/** The audit's areas (docs/research/ux-audit/00-plan.md §4), each the walk stops of its golden path. A stop is a
 * screen or state the stranger reaches; what a session judges is the PNG the stop leaves, so the stops are named for
 * what is on screen, not for what was clicked. */
export const AREAS = ['arrive', 'draw-export', 'convert-image', 'bead-it', 'keep-it', 'cross-cutting'] as const
export type Area = (typeof AREAS)[number]

/** Whether `UX_AREA` names an area. */
export function isArea(value: string | undefined): value is Area {
  return AREAS.includes(value as Area)
}

interface AreaWalk {
  states: State[]
  run: (walk: Walk) => Promise<void>
}

/** Time for a panel, modal or popover to open and its motion to end. */
const PANEL_MS = 800
/** Time for the canvas to redraw after a Project opens, a step changes or a slider moves. */
const REDRAW_MS = 1500
/** Time for an export to be drawn and handed over as a file. */
const EXPORT_MS = 2500
/** Time for the save ring to run its course after an edit. */
const SAVE_MS = 3000
/** How many Tabs to press before each keyboard stop. */
const TAB_STOPS = [1, 4, 8]
const PHONE = /^phone-/

/** Turns the Homepage to a section (ticket 0830: Welcome comes first): by its step in the bar, or on a phone, whose bar
 * has none, by Next until it shows. */
async function turnHomepageTo(page: Page, id: 'inside' | 'coffee' | 'plans'): Promise<void> {
  const step = page.locator(`[data-testid="section-step"][data-step="${id}"]`)
  const shown = page.locator(`[data-testid="homepage-section-${id}"].homepage__section--shown`)
  if (await step.count()) await step.click()
  else for (let presses = 0; presses < 3 && !(await shown.count()); presses += 1) await page.getByTestId('phone-bar-next').click()
  await page.waitForTimeout(PANEL_MS)
}

async function paintOneBead(page: Page): Promise<void> {
  await selectTool(page, 'paint')
  const centre = await surfaceCentre(page)
  await page.mouse.click(centre.x, centre.y)
  await settle(page)
}

/** Presses a zoom button until it goes disabled at its limit, at most twenty times. */
async function zoomToEnd(page: Page, direction: 'in' | 'out'): Promise<void> {
  const button = page.getByTestId(`zoom-${direction}`)
  for (let index = 0; index < 20 && (await button.isEnabled()); index += 1) {
    await button.click()
  }
  await settle(page)
}

async function dragOnSurface(page: Page): Promise<void> {
  const centre = await surfaceCentre(page)
  await page.mouse.move(centre.x - 60, centre.y - 40)
  await page.mouse.down()
  await page.mouse.move(centre.x + 60, centre.y + 40, { steps: 10 })
  await page.mouse.up()
  await settle(page)
}

async function openExportPanel(page: Page): Promise<void> {
  await page.getByTestId('strip-export').click()
  await page.getByTestId('export-panel').waitFor()
}

/** Menu → Saved projects: the Projects library. */
async function openSavedProjectsList(page: Page): Promise<void> {
  await openStripPanel(page, 'strip-menu')
  await page.getByTestId('menu-saved-projects').click()
  await settle(page)
}

/** Opens a saved Project from the Projects library, by a part of its name. */
async function openSavedProject(page: Page, name: string): Promise<void> {
  await openSavedProjectsList(page)
  await page.getByTestId('project-item').filter({ hasText: name }).first().click()
  // Leaving the open Project asks "Switch Project?"; the stranger switches.
  await clickIfVisible(page, 'confirm-modal-confirm')
  await page.waitForTimeout(REDRAW_MS)
}

/** The New pattern form, up to the Technique chooser and the created Project, then the storage note (ticket 399)
 * that comes at a fresh device's first save, which the stranger answers with its primary button. */
async function newPatternStops(walk: Walk): Promise<void> {
  const { page } = walk
  await walk.step('new-pattern-form', async () => {
    if (!(await page.locator('#new-project-form').isVisible())) {
      if (!(await clickIfVisible(page, 'menu-new-project'))) {
        await openStripPanel(page, 'strip-menu')
        await clickIfVisible(page, 'menu-new-project')
      }
    }
    await page.locator('#new-project-form').waitFor()
  })
  await walk.step('technique-chooser-open', async () => {
    await page.getByTestId('new-project-technique').locator('button[aria-haspopup]').click()
    await settle(page)
  })
  await walk.step('technique-peyote-chosen', async () => {
    await escape(page)
    await chooseNewProjectTechnique(page, 'peyote')
    await settle(page)
  })
  await walk.step('pattern-created', async () => {
    await page.getByTestId('create-project').click()
    await page.getByTestId('project-surface').waitFor()
  })
  await walk.step('storage-note-answered', async () => {
    await clickIfVisible(page, 'confirm-modal-confirm')
  })
}

/** Opens Menu, Project, Frame and Export one after another, each its own stop. */
async function chromeStops(walk: Walk): Promise<void> {
  const { page } = walk
  await walk.step('menu-open', async () => openStripPanel(page, 'strip-menu'))
  await walk.step('project-panel-open', async () => openStripPanel(page, 'strip-project'))
  await walk.step('frame-panel-open', async () => openStripPanel(page, 'strip-frame'))
  await walk.step('export-panel-open', async () => openExportPanel(page))
  await escape(page)
}

const arrive: AreaWalk = {
  states: ['fresh'],
  async run(walk) {
    const { page } = walk
    await walk.step('homepage-top', async () => openForAudit(walk, { url: 'homepage/' }))
    await walk.stop('homepage-whole-page', { fullPage: true })
    await walk.step('homepage-inside', async () => turnHomepageTo(page, 'inside'))
    await walk.step('homepage-coffee', async () => turnHomepageTo(page, 'coffee'))
    await walk.step('homepage-plans', async () => turnHomepageTo(page, 'plans'))
    await walk.step('editor-first-open', async () => {
      await page.getByTestId('homepage-make-first').scrollIntoViewIfNeeded()
      await page.getByTestId('homepage-make-first').click()
      await page.getByTestId('app-canvas').waitFor()
      await page.waitForTimeout(REDRAW_MS)
    })
    await newPatternStops(walk)
    await walk.step('first-bead-painted', async () => paintOneBead(page))
    await walk.step('first-bead-saved', async () => page.waitForTimeout(SAVE_MS))
    await walk.step('color-popover-open', async () => openColorPopover(page))
    await escape(page)
    await chromeStops(walk)
  },
}

const drawExport: AreaWalk = {
  states: ['seeded'],
  async run(walk) {
    const { page } = walk
    await walk.step('editor-open', async () => openForAudit(walk))
    await walk.step('color-popover-open', async () => openColorPopover(page))
    await walk.step('palette-in-popover', async () => {
      await page.getByTestId('palette-picker').scrollIntoViewIfNeeded()
    })
    await escape(page)
    await walk.step('painted-stroke', async () => {
      await selectTool(page, 'paint')
      await dragOnSurface(page)
    })
    await walk.step('fill-tool', async () => {
      await selectTool(page, 'fill')
      const centre = await surfaceCentre(page)
      await page.mouse.click(centre.x + 100, centre.y + 60)
      await settle(page)
    })
    await walk.step('selection-made', async () => {
      await selectTool(page, 'select')
      await dragOnSurface(page)
    })
    await walk.step('selection-copied-paste-armed', async () => {
      await page.keyboard.press('ControlOrMeta+c')
      await settle(page)
      const centre = await surfaceCentre(page)
      await page.mouse.move(centre.x + 120, centre.y)
      await settle(page)
    })
    await walk.step('mirror-tool', async () => {
      await escape(page)
      await page.getByTestId('pill-tool-mirror').click()
      await settle(page)
    })
    await walk.step('undone-twice', async () => {
      await escape(page)
      await page.getByTestId('strip-undo').click()
      await page.getByTestId('strip-undo').click()
      await settle(page)
    })
    await walk.step('rulers-toggled', async () => {
      await page.getByTestId('strip-rulers').click()
      await settle(page)
    })
    await walk.step('zoomed-out-to-floor', async () => zoomToEnd(page, 'out'))
    await walk.step('zoomed-in-far', async () => zoomToEnd(page, 'in'))
    await walk.step('export-panel-open', async () => openExportPanel(page))
    await walk.step('export-png-done', async () => {
      await page.getByTestId('export-png').click()
      await page.waitForTimeout(EXPORT_MS)
    })
    await walk.step('export-pdf-done', async () => {
      await page.getByTestId('export-pdf').click()
      await page.waitForTimeout(EXPORT_MS)
    })
  },
}

const convertImage: AreaWalk = {
  states: ['fresh', 'seeded'],
  async run(walk) {
    const { page } = walk
    await walk.step('convert-page-empty', async () => {
      await openForAudit(walk, { chooseEditor: true })
      if (!(await clickIfVisible(page, 'convert-image'))) {
        await openStripPanel(page, 'strip-menu')
        await page.getByTestId('menu-convert-image').click()
      }
      await page.getByTestId('convert-image-wizard').waitFor()
    })
    await walk.step('convert-wrong-file', async () => {
      await page.getByTestId('convert-choose-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a picture') })
      await page.waitForTimeout(PANEL_MS)
    })
    await walk.step('convert-picture-loaded', async () => {
      await page.getByTestId('convert-choose-file').setInputFiles({ name: 'holiday.png', mimeType: 'image/png', buffer: fixturePicture() })
      await page.getByTestId('convert-file-name').waitFor()
      await page.waitForTimeout(PANEL_MS)
    })
    await walk.step('convert-size-step', async () => {
      await page.getByTestId('convert-step-size').click()
      await settle(page)
    })
    await walk.step('convert-width-changed', async () => {
      await page.getByTestId('convert-width-range').fill('60')
      await page.waitForTimeout(REDRAW_MS)
    })
    await walk.step('convert-colors-step', async () => {
      await page.getByTestId('convert-step-colors').click()
      await page.waitForTimeout(PANEL_MS)
    })
    await walk.step('convert-review-step', async () => {
      await page.getByTestId('convert-step-review').click()
      await page.waitForTimeout(PANEL_MS)
    })
    await walk.step('convert-created-in-editor', async () => {
      await page.getByTestId('convert-image-create').click()
      await page.getByTestId('project-surface').waitFor()
      await page.waitForTimeout(REDRAW_MS)
    })
  },
}

const beadIt: AreaWalk = {
  states: ['seeded'],
  async run(walk) {
    const { page } = walk
    await walk.step('editor-open', async () => openForAudit(walk))
    // Frame editing is only offered before Row progress starts, so it is tried on the bracelet, not the cuff.
    await walk.step('frame-edit-mode', async () => {
      await page.getByTestId('frame-edit-toggle').click()
      await settle(page)
    })
    await walk.step('frame-edit-left', async () => {
      await escape(page)
      await escape(page)
    })
    await walk.step('saved-projects-list', async () => openSavedProjectsList(page))
    await walk.step('cuff-with-progress-open', async () => openSavedProject(page, 'Loom cuff'))
    await walk.step('frame-panel-open', async () => openStripPanel(page, 'strip-frame'))
    await walk.step('beads-needed', async () => {
      await page.getByTestId('quantity-row').first().scrollIntoViewIfNeeded()
    })
    await walk.step('progress-three-rows-on', async () => {
      for (let index = 0; index < 3; index += 1) {
        await page.getByTestId('progress-bar-next').click()
      }
      await settle(page)
    })
    await walk.step('progress-highlight-toggled', async () => {
      await page.getByTestId('progress-bar-highlight').click()
      await settle(page)
    })
    await walk.step('progress-direction-switched', async () => {
      await page.getByTestId('progress-bar-direction').click()
      await settle(page)
    })
    await walk.step('progress-reset-asked', async () => {
      await page.getByTestId('progress-bar-reset').click()
      await page.getByTestId('reset-progress-modal').waitFor()
    })
    await walk.step('frame-removed-no-progress', async () => {
      await escape(page)
      await openStripPanel(page, 'strip-frame')
      await page.getByTestId('frame-panel').getByTestId('frame-chrome-remove').click()
      await page.waitForTimeout(PANEL_MS)
      await escape(page)
    })
    await walk.step('export-needs-frame', async () => openExportPanel(page))
  },
}

const keepIt: AreaWalk = {
  states: ['fresh', 'seeded'],
  async run(walk) {
    const { page } = walk
    await walk.step('editor-open', async () => openForAudit(walk, { chooseEditor: true }))
    if (walk.state === 'fresh') {
      await newPatternStops(walk)
    }
    await walk.step('project-panel-open', async () => openStripPanel(page, 'strip-project'))
    await walk.step('project-name-editing', async () => {
      await page.getByTestId('project-name-edit').first().click()
      await settle(page)
    })
    await walk.step('project-name-empty-error', async () => {
      await page.getByTestId('project-name-input').fill('')
      await page.keyboard.press('Enter')
      await settle(page)
    })
    await walk.step('maker-name-form', async () => {
      await escape(page)
      await openStripPanel(page, 'strip-project')
      if (!(await clickIfVisible(page, 'project-maker-add'))) {
        await clickIfVisible(page, 'project-maker-edit')
      }
    })
    await walk.step('save-ring-after-paint', async () => {
      await escape(page)
      await paintOneBead(page)
    })
    await walk.step('save-state-settled', async () => page.waitForTimeout(SAVE_MS))
    let savedFile: string | undefined
    await walk.step('project-file-saved', async () => {
      await openStripPanel(page, 'strip-project')
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-project-file').click()])
      savedFile = (await download.path()) ?? undefined
      await page.waitForTimeout(PANEL_MS)
    })
    await walk.step('project-file-imported-back', async () => {
      if (!savedFile) {
        throw new Error('No Project file was saved to import back')
      }
      await escape(page)
      await openSavedProjectsList(page)
      await page.getByTestId('menu-import-file').setInputFiles(savedFile)
      await page.waitForTimeout(REDRAW_MS)
    })
    await walk.step('project-duplicated', async () => {
      await escape(page)
      await openStripPanel(page, 'strip-project')
      await page.getByTestId('project-duplicate').first().click()
      await page.waitForTimeout(PANEL_MS)
    })
    await walk.step('project-delete-asked', async () => {
      await escape(page)
      await openStripPanel(page, 'strip-project')
      await page.getByTestId('project-delete').first().click()
      await page.waitForTimeout(PANEL_MS)
    })
    await walk.step('delete-all-asked', async () => {
      await escape(page)
      await openSavedProjectsList(page)
      await page.getByTestId('menu-delete-all').click()
      await page.waitForTimeout(PANEL_MS)
    })
    await escape(page)
  },
}

/** The phone path (plan §1): open an existing Project, find Beads needed and Export, export. */
async function phonePath(walk: Walk): Promise<void> {
  const { page } = walk
  await walk.step('phone-editor-open', async () => openForAudit(walk))
  await walk.step('phone-project-panel', async () => openStripPanel(page, 'strip-project'))
  await walk.step('phone-frame-panel-beads-needed', async () => {
    await openStripPanel(page, 'strip-frame')
    await page.getByTestId('quantity-row').first().scrollIntoViewIfNeeded()
  })
  await walk.step('phone-export-panel', async () => {
    await escape(page)
    await openExportPanel(page)
  })
  await walk.step('phone-export-png-done', async () => {
    await page.getByTestId('export-png').click()
    await page.waitForTimeout(EXPORT_MS)
  })
  await walk.step('phone-drawing-works', async () => {
    await escape(page)
    await paintOneBead(page)
  })
}

/** Keyboard only: where focus lands after a few Tabs, on the Homepage and in the editor. */
async function keyboardStops(walk: Walk): Promise<void> {
  const { page } = walk
  const tabStops = async (prefix: string): Promise<void> => {
    let pressed = 0
    for (const total of TAB_STOPS) {
      await walk.step(`${prefix}-tab-${total}`, async () => {
        for (; pressed < total; pressed += 1) {
          await page.keyboard.press('Tab')
        }
        await settle(page)
      })
    }
  }
  await walk.step('keyboard-homepage-start', async () => openForAudit(walk, { url: 'homepage/' }))
  await tabStops('keyboard-homepage')
  await walk.step('keyboard-editor-start', async () => openForAudit(walk))
  await tabStops('keyboard-editor')
}

const crossCutting: AreaWalk = {
  states: ['seeded'],
  async run(walk) {
    const { page } = walk
    if (PHONE.test(walk.device)) {
      await phonePath(walk)
      return
    }
    await walk.step('homepage-top', async () => openForAudit(walk, { url: 'homepage/' }))
    await walk.step('editor-open', async () => openForAudit(walk))
    await walk.step('tapestry-large-open', async () => openSavedProject(page, 'tapestry'))
    await chromeStops(walk)
    // The keyboard and the languages once, on the reference laptop: they don't change with the theme or the width.
    if (walk.device === 'air-light') {
      await keyboardStops(walk)
      for (const locale of LOCALES) {
        await walk.step(`${locale}-homepage-top`, async () => openForAudit(walk, { url: 'homepage/', locale }))
        await walk.step(`${locale}-editor-menu-open`, async () => {
          await openForAudit(walk, { locale })
          await openStripPanel(page, 'strip-menu')
        })
        await walk.step(`${locale}-frame-panel-open`, async () => openStripPanel(page, 'strip-frame'))
      }
    }
  },
}

/** Each area's states and walk, by the name `UX_AREA` carries. */
export const AREA_WALKS: Record<Area, AreaWalk> = {
  arrive,
  'draw-export': drawExport,
  'convert-image': convertImage,
  'bead-it': beadIt,
  'keep-it': keepIt,
  'cross-cutting': crossCutting,
}

import { frameIdIn } from '../testUtils/frameId'
import { defineComponent, h, nextTick, provide, type Component } from 'vue'
import { describe, expect, it } from 'vitest'
import { LOCALES } from '../domain/locale'
import { describeFits, fitProblems, inShell, mountAt, tooltipProblems, type FitCase } from '../testUtils/browserFit'
import ShortcutsHelp from './shell/ShortcutsHelp.vue'
import MenuPanel from './shell/MenuPanel.vue'
import SignInPanel from './shell/SignInPanel.vue'
import { PANEL_CONTEXT } from './shell/panelContext'
import CanvasStrip from './canvas/CanvasStrip.vue'
import ExportPanel from './canvas/ExportPanel.vue'
import FramePopover from './canvas/FramePopover.vue'
import type { FrameToolItem } from './canvas/framePopoverTools'
import { controlAction, controlDeps } from '../composables/shell/controlRegistry'
import { twoFrames } from '../testUtils/twoFrames'
import { rotateFrame } from '../domain/rotate'
import ProjectPanel from './project/ProjectPanel.vue'
import { newReferenceImage, withReferenceImage } from '../domain/referenceImage'
import NewProjectForm from './project/NewProjectForm.vue'
import { BEAD_CATALOG, offeredBeads } from '../domain/beads'
import { withColors } from '../domain/canvas'
import { createPalette, defaultPaletteIds } from '../domain/palette'
import { changeFrame } from '../domain/changeFrame'
import { createProject } from '../domain/createProject'
import type { Project } from '../domain/project'
import { moveToRow } from '../domain/rowProgress'
import { withLayers } from '../testUtils/layerFields'
import { frameOf } from '../domain/layerRecord'
import { withFrameSheet } from '../domain/frameSheet'

// The strip, the Project and Menu panels, the dialogs and the forms, in every language at the layout's width edges
// (ticket 552).
const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })
/** A Project with a Row progress pass done, so its Technique and settings are locked with their reasons (ticket 0626). */
const rowsDone = (locked: Project): Project => moveToRow(locked, 1, frameIdIn(locked))
const framed = withLayers(project, { frame: { row: 2, column: 3, rows: 6, columns: 5, technique: 'loom' as const, beads: {} } })
/** A named Frame with seven colors painted, so Beads needed lists more rows than it shows at first. */
const colors = createPalette(defaultPaletteIds()).colors.slice(0, 7).map((color) => color.hex)
const painted = withLayers(framed, { frame: { ...frameOf(framed)!, name: 'Moth wing, the long left one', beads: withColors({}, colors.map((hex, at) => ({ row: Math.floor(at / 5), column: at % 5, color: hex }))) } })
// A Fringe earring's four settings in place of Width and Height (ticket 0597).
const earringPlaced = changeFrame(project, { custom: { shape: 'fringeEarring', size: 7, centre: { row: 6, column: 6 } } }, frameIdIn(project))
const earring = earringPlaced.kind === 'changed' ? earringPlaced.project : project
const showAll = (root: HTMLElement): void => {
  const button = root.querySelector<HTMLElement>('[data-testid="quantities-toggle"]')
  if (!button) throw new Error('Beads needed has no Show all button')
  button.click()
}
/** A width and a height that each bring up their range line (ticket 0978). */
const refuseSizes = async (root: HTMLElement): Promise<void> => {
  for (const side of ['width', 'height']) {
    const field = root.querySelector<HTMLInputElement>(`[data-testid="frame-size-${side}"]`)
    if (!field) throw new Error(`The Frame popover has no ${side} field`)
    field.value = '12.5'
    field.dispatchEvent(new Event('input'))
  }
  await nextTick()
}
/** The Project panel's Export row unfolded (ticket 1058): the export rows in the Project panel. */
const unfoldProjectExport = async (root: HTMLElement): Promise<void> => {
  root.querySelector<HTMLElement>('[data-testid="project-export"]')?.click()
}

/** A component inside a panel shell's context, as the Menu panel needs; given a width, as wide as that panel's content
 * (the Export panel's small one, ticket 0652). */
const inPanel = (component: Component, props: Record<string, unknown>, width?: string): Component =>
  defineComponent({
    setup() {
      provide(PANEL_CONTEXT, { close: () => {}, openSub: () => {} })
      return () => (width ? h('div', { style: { width, maxWidth: '100%' } }, [h(component, props)]) : h(component, props))
    },
  })

const smallPanel = 'calc(var(--panel-width-small) - 2 * var(--space-8))'
/** The Frame popover's content: `frame-popover-width`, on a phone the screen less the gutters, less its padding and
 * hairline border, so a phone's width is the room its rows really have (tickets 0864, 1222). */
const framePopover = 'calc(min(var(--frame-popover-width), 100vw - 2 * var(--frame-panel-gap)) - 2 * var(--space-14) - 2px)'

/** The popover's tools as the margin sheet hands them over: every one a Menu item. */
function popoverOf(shown: Project, extra: Record<string, unknown> = {}): [Component, Record<string, unknown>] {
  const frame = frameIdIn(shown)
  const items: FrameToolItem[] = [
    { id: 'mirror', action: controlAction('mirror-frame'), run: () => {} },
    { id: 'rotate', action: controlAction('rotate-frame'), run: () => {} },
    { id: 'edit', action: controlAction('edit-frame'), run: () => {} },
    { id: 'export', action: controlAction('strip-export'), run: () => {} },
    { id: 'color', action: controlAction('margin-color'), run: () => {} },
    { id: 'remove', action: controlAction('remove-frame'), run: () => {} },
  ]
  const deps = controlDeps({ activeProject: () => shown, frame: () => frame })
  return [inPanel(FramePopover, { project: shown, frame, items, deps, ...extra }, framePopover), {}]
}
/** Two Frames in the Project panel, "frames" unfolded (it folds once there are two). */
const twoFramed = twoFrames()
const unfoldFrames = (root: HTMLElement): void => {
  root.querySelector<HTMLElement>('[data-testid="project-frames-list"] .panel-section__header')?.click()
}

const CASES: FitCase[] = [
  ['CanvasStrip', CanvasStrip, { project, rulers: true, referenceImage: 'shown', canUndo: true, canRedo: true, zoomPercent: 125 }],
  ['CanvasStrip (in its shell)', inShell(CanvasStrip, { project, rulers: true, referenceImage: 'shown', canUndo: true, canRedo: true, zoomPercent: 125 }), {}],
  // Menu's widest Subpanel (ticket 1159): `panel-width-wide`, or the window less its gutters, less the panel's edges.
  ['ShortcutsHelp', inPanel(ShortcutsHelp, {}, 'calc(min(var(--panel-width-wide), 100vw - 2 * var(--frame-panel-gap)) - 2 * var(--space-8) - 2px)'), {}],
  ['MenuPanel', inPanel(MenuPanel, { projectCount: 1, toolsPosition: 'bottom', inputMode: 'pen', handedness: 'right', penSeen: true }), {}],
  // Signed in (ticket 0078): a long address cuts at its end beside the plan, which stays whole.
  ['MenuPanel (signed in)', inPanel(MenuPanel, { projectCount: 1, account: { email: 'a.very.long.name.of.a.maker@a-long-mail-domain.example.com', plan: 'free' } }), {}],
  ['SignInPanel', SignInPanel, { asks: false, leaving: false, verify: () => () => {} }],
  ['SignInPanel (refused, Cloudflare asking, leaving)', SignInPanel, { refusal: 'cancelled', asks: true, leaving: true, verify: () => () => {} }],
  ['ProjectPanel', ProjectPanel, { project: { ...project, makerName: 'Maria' }, replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false, canSaveAs: true, lastFileName: 'Scarf for winter.openbeads' }],
  ['ProjectPanel (Export unfolded)', ProjectPanel, { project: painted, replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false, exporting: 'pdf' }, unfoldProjectExport],
  ['ProjectPanel (Export unfolded, no Frame)', ProjectPanel, { project: withFrameSheet(painted, undefined, { frame: frameIdIn(painted) }), replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }, unfoldProjectExport],
  ['ProjectPanel (brick, no maker, failed)', ProjectPanel, { project: createProject({ technique: 'brick', beadId: 'miyuki/delica/11-0', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } }), replaceCandidates: offeredBeads(), saveFailed: true, unsaved: false }],
  ['ProjectPanel (technique locked)', ProjectPanel, { project: moveToRow(project, 1, frameIdIn(project)), replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  ['FramePopover', ...popoverOf(painted)],
  ['FramePopover (all colors shown)', ...popoverOf(painted), showAll],
  ['FramePopover (no name)', ...popoverOf(framed)],
  ['FramePopover (size refused)', ...popoverOf(painted), refuseSizes],
  ['FramePopover (rows done)', ...popoverOf(moveToRow(painted, 1, frameIdIn(painted)))],
  ['FramePopover (turned)', ...popoverOf(rotateFrame(painted, undefined, frameIdIn(painted))!)],
  ['FramePopover (Fringe earring)', ...popoverOf(earring)],
  ['ProjectPanel (two Frames)', ProjectPanel, { project: twoFramed, saveFailed: false, unsaved: false }, unfoldFrames],
  ['ExportPanel', inPanel(ExportPanel, { project: painted }, smallPanel), {}],
  ['ExportPanel (exporting)', inPanel(ExportPanel, { project: framed, exporting: 'pdf' }, smallPanel), {}],
  ['ExportPanel (two Frames)', inPanel(ExportPanel, { project: twoFramed }, smallPanel), {}],
  ['ExportPanel (no Frame)', inPanel(ExportPanel, { project }, smallPanel), {}],
  ['ProjectPanel (brick)', ProjectPanel, { project: createProject({ technique: 'brick', beadId: 'miyuki/delica/11-0', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } }), replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  ['ProjectPanel (peyote, rows done)', ProjectPanel, { project: rowsDone(createProject({ technique: 'peyote', beadId: 'miyuki/delica/11-0', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })), replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  ['ProjectPanel (brick, rows done)', ProjectPanel, { project: rowsDone(createProject({ technique: 'brick', beadId: 'miyuki/delica/11-0', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })), replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  // The reference image section with a picture (ticket 0790): its row, the four opacities, a refusal and the not-saved icon.
  [
    'ProjectPanel (reference image)',
    ProjectPanel,
    {
      project: withReferenceImage(project, { ...newReferenceImage({ name: 'a-very-long-photo-name-from-a-phone-camera.jpg', type: 'image/webp', width: 2048, height: 1536, bytes: 421888 }, { x: 0, y: 0, width: 240, height: 240 }), shown: false }),
      replaceCandidates: BEAD_CATALOG.slice(0, 2),
      saveFailed: false,
      unsaved: false,
      reference: { preparing: false, refusal: 'tooManyPixels', notSaved: true },
    },
  ],
  ['NewProjectForm', NewProjectForm, { namePlaceholder: 'Project 1' }],
]

describeFits(CASES)

// The Frame popover on a phone in every real language too (tickets 0864, 1222): "longest" puts each edge's widest word in
// its cell, but a word that has no room leaves its cell for the glyph's Tooltip, so each language's own words are tried as
// well.
describe('FramePopover on a phone', () => {
  for (const locale of LOCALES) {
    it(`fits its box at 390px in ${locale}`, async () => {
      const [component] = popoverOf(painted)
      const { root } = await mountAt(component, {}, { locale, width: 390 })
      expect([...(await fitProblems('FramePopover', locale, 390)), ...(await tooltipProblems(root, ['hover']))]).toEqual([])
    })
  }
})

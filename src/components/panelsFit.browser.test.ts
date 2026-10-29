import { defineComponent, h, provide, ref, type Component } from 'vue'
import { describeFits, type FitCase } from '../testUtils/browserFit'
import ShortcutsHelp from './shell/ShortcutsHelp.vue'
import MenuPanel from './shell/MenuPanel.vue'
import { PANEL_CONTEXT } from './shell/panelContext'
import CanvasStrip from './canvas/CanvasStrip.vue'
import ExportPanel from './canvas/ExportPanel.vue'
import FramePanel from './canvas/FramePanel.vue'
import { rotateFrame } from '../domain/rotate'
import ProjectPanel from './project/ProjectPanel.vue'
import NewProjectForm from './project/NewProjectForm.vue'
import DuplicateProjectModal from './project/DuplicateProjectModal.vue'
import { BEAD_CATALOG, offeredBeads } from '../domain/beads'
import { withColors } from '../domain/canvas'
import { createPalette, defaultPaletteIds } from '../domain/palette'
import { changeFrame } from '../domain/changeFrame'
import { createProject } from '../domain/createProject'
import type { Project } from '../domain/project'
import { rowProgressOf } from '../domain/rowProgress'
import { withLayers } from '../testUtils/layerFields'
import { frameOf } from '../domain/layerRecord'

// The strip, the Project and Menu panels, the dialogs and the forms, in every language at the layout's width edges
// (ticket 552).
const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })
/** A Project with a Row progress pass done, so its Technique and settings are locked with their reasons (ticket 0626). */
const rowsDone = (locked: Project): Project => (withLayers(locked, { rowProgress: { ...rowProgressOf(locked), currentRow: 1 } }))
const framed = withLayers(project, { frame: { row: 2, column: 3, rows: 6, columns: 5, technique: 'loom' as const, beads: {} } })
/** A named Frame with seven colors painted, so Beads needed lists more rows than it shows at first. */
const colors = createPalette(defaultPaletteIds()).colors.slice(0, 7).map((color) => color.hex)
const painted = withLayers(framed, { frame: { ...frameOf(framed)!, name: 'Moth wing, the long left one', beads: withColors({}, colors.map((hex, at) => ({ row: Math.floor(at / 5), column: at % 5, color: hex }))) } })
// A Fringe earring's four settings in place of Width and Height (ticket 0597).
const earringPlaced = changeFrame(project, { custom: { shape: 'fringeEarring', size: 7, centre: { row: 6, column: 6 } } })
const earring = earringPlaced.kind === 'changed' ? earringPlaced.project : project
const showAll = (root: HTMLElement): void => {
  const button = root.querySelector<HTMLElement>('[data-testid="quantities-toggle"]')
  if (!button) throw new Error('Beads needed has no Show all button')
  button.click()
}

/** A component inside a panel shell's context, as the Menu panel needs; given a width, as wide as that panel's content
 * (the Export panel's small one, ticket 0652). */
const inPanel = (component: Component, props: Record<string, unknown>, width?: string): Component =>
  defineComponent({
    setup() {
      provide(PANEL_CONTEXT, { itemRole: ref(undefined), close: () => {}, openSub: () => {} })
      return () => (width ? h('div', { style: { width, maxWidth: '100%' } }, [h(component, props)]) : h(component, props))
    },
  })

const smallPanel = 'calc(var(--panel-width-small) - 2 * var(--space-8))'

const CASES: FitCase[] = [
  ['CanvasStrip', CanvasStrip, { project, rulers: true, canUndo: true, canRedo: true, zoomPercent: 125 }],
  ['ShortcutsHelp', ShortcutsHelp, {}],
  ['MenuPanel', inPanel(MenuPanel, { projects: [project], toolsPosition: 'bottom', inputMode: 'pen', handedness: 'right', penSeen: true }), {}],
  ['ProjectPanel', ProjectPanel, { project: { ...project, makerName: 'Maria' }, replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  ['ProjectPanel (brick, no maker, failed)', ProjectPanel, { project: createProject({ technique: 'brick', beadId: 'miyuki/delica/11-0', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } }), replaceCandidates: offeredBeads(), saveFailed: true, unsaved: false }],
  ['ProjectPanel (technique locked)', ProjectPanel, { project: withLayers(project, { rowProgress: { ...rowProgressOf(project), currentRow: 1 } }), replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  ['FramePanel', inPanel(FramePanel, { project: painted }), {}],
  ['FramePanel (all colors shown)', inPanel(FramePanel, { project: painted }), {}, showAll],
  ['FramePanel (no name, exporting)', inPanel(FramePanel, { project: framed, exporting: 'pdf' }), {}],
  ['FramePanel (rows done)', inPanel(FramePanel, { project: withLayers(painted, { rowProgress: { ...rowProgressOf(painted), currentRow: 1 } }) }), {}],
  ['FramePanel (turned)', inPanel(FramePanel, { project: rotateFrame(painted)! }), {}],
  ['FramePanel (no Frame)', inPanel(FramePanel, { project }), {}],
  ['FramePanel (Fringe earring)', inPanel(FramePanel, { project: earring }), {}],
  ['ExportPanel', inPanel(ExportPanel, { project: painted }, smallPanel), {}],
  ['ExportPanel (exporting)', inPanel(ExportPanel, { project: framed, exporting: 'pdf' }, smallPanel), {}],
  ['ExportPanel (no Frame)', inPanel(ExportPanel, { project }, smallPanel), {}],
  ['ProjectPanel (brick)', ProjectPanel, { project: createProject({ technique: 'brick', beadId: 'miyuki/delica/11-0', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } }), replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  ['ProjectPanel (peyote, rows done)', ProjectPanel, { project: rowsDone(createProject({ technique: 'peyote', beadId: 'miyuki/delica/11-0', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })), replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  ['ProjectPanel (brick, rows done)', ProjectPanel, { project: rowsDone(createProject({ technique: 'brick', beadId: 'miyuki/delica/11-0', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })), replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  ['NewProjectForm', NewProjectForm, {}],
  ['DuplicateProjectModal', DuplicateProjectModal, { suggested: 'Moth copy' }],
]

describeFits(CASES)

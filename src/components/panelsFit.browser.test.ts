import { defineComponent, h, provide, ref, type Component } from 'vue'
import { describeFits, type FitCase } from '../testUtils/browserFit'
import ShortcutsHelp from './shell/ShortcutsHelp.vue'
import MenuPanel from './shell/MenuPanel.vue'
import { PANEL_CONTEXT } from './shell/panelContext'
import CanvasStrip from './canvas/CanvasStrip.vue'
import FramePanel from './canvas/FramePanel.vue'
import ProjectPanel from './project/ProjectPanel.vue'
import NewProjectForm from './project/NewProjectForm.vue'
import DuplicateProjectModal from './project/DuplicateProjectModal.vue'
import SwitchTechniqueModal from './project/SwitchTechniqueModal.vue'
import ConvertImageSizeDialog from './import/ConvertImageSizeDialog.vue'
import { BEAD_CATALOG, findBead, offeredBeads } from '../domain/beads'
import { createPalette, defaultPaletteIds } from '../domain/palette'
import { createProject } from '../domain/project'

// The strip, the Project and Menu panels, the dialogs and the forms, in every language at the layout's width edges
// (ticket 552).
const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })
const framed = { ...project, frame: { row: 2, column: 3, rows: 6, columns: 5, technique: 'loom' as const, beads: {} } }
/** A named Frame with seven colors painted, so Beads needed lists more rows than it shows at first. */
const colors = createPalette(defaultPaletteIds()).colors.slice(0, 7).map((color) => color.hex)
const painted = { ...framed, frame: { ...framed.frame, name: 'Moth wing, the long left one', beads: { 0: Object.fromEntries(colors.map((hex, column) => [column, hex])) } } }
const showAll = (root: HTMLElement): void => {
  const button = root.querySelector<HTMLElement>('[data-testid="quantities-toggle"]')
  if (!button) throw new Error('Beads needed has no Show all button')
  button.click()
}

/** A component inside a panel shell's context, as the Menu panel needs. */
const inPanel = (component: Component, props: Record<string, unknown>): Component =>
  defineComponent({
    setup() {
      provide(PANEL_CONTEXT, { itemRole: ref(undefined), close: () => {}, openSub: () => {} })
      return () => h(component, props)
    },
  })

const CASES: FitCase[] = [
  ['CanvasStrip', CanvasStrip, { project, rulers: true, canUndo: true, canRedo: true, zoomPercent: 125 }],
  ['ShortcutsHelp', ShortcutsHelp, {}],
  ['MenuPanel', inPanel(MenuPanel, { projects: [project], toolsPosition: 'bottom', inputMode: 'pen', handedness: 'right', penSeen: true }), {}],
  ['ProjectPanel', ProjectPanel, { project: { ...project, makerName: 'Maria' }, replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  ['ProjectPanel (brick, no maker, failed)', ProjectPanel, { project: createProject({ technique: 'brick', beadId: 'miyuki/delica/11-0', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } }), replaceCandidates: offeredBeads(), saveFailed: true, unsaved: false }],
  ['ProjectPanel (technique locked)', ProjectPanel, { project: { ...project, rowProgress: { ...project.rowProgress, currentRow: 1 } }, replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  ['FramePanel', inPanel(FramePanel, { project: painted }), {}],
  ['FramePanel (all colors shown)', inPanel(FramePanel, { project: painted }), {}, showAll],
  ['FramePanel (no name, exporting)', inPanel(FramePanel, { project: framed, exporting: 'pdf' }), {}],
  ['FramePanel (rows done)', inPanel(FramePanel, { project: { ...painted, rowProgress: { ...painted.rowProgress, currentRow: 1 } } }), {}],
  ['FramePanel (no Frame)', inPanel(FramePanel, { project }), {}],
  ['ProjectPanel (netting)', ProjectPanel, { project: createProject({ technique: 'netting', beadId: 'miyuki/delica/11-0', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } }), replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  ['NewProjectForm', NewProjectForm, {}],
  ['SwitchTechniqueModal (brick stitch)', SwitchTechniqueModal, { question: { technique: 'brick', lost: 12, drawn: true, keeps: false, asksNetSize: false, netSize: 3, asksBrickBlock: true, brickBlock: 2 } }],
  ['SwitchTechniqueModal (Net size)', SwitchTechniqueModal, { question: { technique: 'netting', lost: 12, drawn: true, keeps: true, asksNetSize: true, netSize: 5, asksBrickBlock: false, brickBlock: 1 } }],
  ['DuplicateProjectModal', DuplicateProjectModal, { suggested: 'Moth copy' }],
  ['ConvertImageSizeDialog', ConvertImageSizeDialog, { bead: findBead('toho-cube-1.5mm')!, technique: 'loom', slowFramingCellThresholds: { loom: 5000, peyote: 5000, brick: 5000, rightAngle: 5000, netting: 5000 } }],
]

describeFits(CASES)

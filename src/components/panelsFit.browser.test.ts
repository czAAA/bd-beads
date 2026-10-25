import { defineComponent, h, provide, ref, type Component } from 'vue'
import { describeFits } from '../testUtils/browserFit'
import ShortcutsHelp from './shell/ShortcutsHelp.vue'
import MenuPanel from './shell/MenuPanel.vue'
import { PANEL_CONTEXT } from './shell/panelContext'
import CanvasStrip from './canvas/CanvasStrip.vue'
import FramePanel from './canvas/FramePanel.vue'
import ProjectPanel from './project/ProjectPanel.vue'
import ProjectList from './project/ProjectList.vue'
import NameOnExportsRow from './project/NameOnExportsRow.vue'
import NewProjectForm from './project/NewProjectForm.vue'
import DuplicateProjectModal from './project/DuplicateProjectModal.vue'
import SaveExport from './export/SaveExport.vue'
import BeadQuantities from './palette/BeadQuantities.vue'
import ConvertImageSizeDialog from './import/ConvertImageSizeDialog.vue'
import { BEAD_CATALOG, findBead } from '../domain/beads'
import { createProject } from '../domain/project'

// The strip, the Project and Menu panels, the dialogs and the forms, in every language at the layout's width edges
// (ticket 552).
const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })
const framed = { ...project, frame: { row: 2, column: 3, rows: 6, columns: 5, technique: 'loom' as const, beads: {} } }

/** A component inside a panel shell's context, as the Menu panel needs. */
const inPanel = (component: Component, props: Record<string, unknown>): Component =>
  defineComponent({
    setup() {
      provide(PANEL_CONTEXT, { itemRole: ref(undefined), close: () => {}, openSub: () => {} })
      return () => h(component, props)
    },
  })

const CASES: [string, Component, Record<string, unknown>][] = [
  ['CanvasStrip', CanvasStrip, { project, rulers: true, canUndo: true, canRedo: true, zoomPercent: 125 }],
  ['ShortcutsHelp', ShortcutsHelp, {}],
  ['MenuPanel', inPanel(MenuPanel, { projects: [project], toolsPosition: 'bottom', inputMode: 'pen', handedness: 'right', penSeen: true }), {}],
  ['ProjectPanel', ProjectPanel, { project, beadName: 'TOHO Cube 1.5mm', replaceCandidates: BEAD_CATALOG.slice(0, 2), saveFailed: false, unsaved: false }],
  ['FramePanel', FramePanel, { project: framed }],
  ['ProjectList', ProjectList, { projects: [project, { ...project, id: 'other', name: 'Fox' }], activeProjectId: project.id }],
  ['NameOnExportsRow', NameOnExportsRow, { name: 'Maria' }],
  ['SaveExport', SaveExport, { hasFrame: true }],
  ['BeadQuantities', BeadQuantities, { project }],
  ['NewProjectForm', NewProjectForm, {}],
  ['DuplicateProjectModal', DuplicateProjectModal, { suggested: 'Moth copy' }],
  ['ConvertImageSizeDialog', ConvertImageSizeDialog, { bead: findBead('toho-cube-1.5mm')!, technique: 'loom', slowFramingCellThresholds: { loom: 5000, peyote: 5000, brick: 5000, rightAngle: 5000, netting: 5000 } }],
]

describeFits(CASES)

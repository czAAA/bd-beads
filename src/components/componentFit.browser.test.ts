import type { Component } from 'vue'
import { describeFits } from '../testUtils/browserFit'
import MenuPanel from './shell/MenuPanel.vue'
import ProgressBar from './canvas/ProgressBar.vue'
import ToolPill from './tools/ToolPill.vue'
import SaveReminder from './canvas/SaveReminder.vue'
import { BEAD_CATALOG } from '../domain/beads'
import { createProject } from '../domain/createProject'
import { toggleRowDirection } from '../domain/rowProgress'
import { withFrameSheet } from '../domain/layerRecord'
import { withLayers } from '../testUtils/layerFields'

// Components with a fixed-size box, mounted in a real browser in every language at the layout's width edges, must keep
// their text inside the box (ticket 552).
const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!
const project = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } })

const CASES: [string, Component, Record<string, unknown>][] = [
  ['MenuPanel', MenuPanel, { projectCount: 1, penSeen: true, kept: false }],
  ['ToolPill', ToolPill, { activeTool: 'paint', position: 'bottom', recentsInPill: [], popoverOpen: false, hasClipboard: true, colorHex: '#e63746', colorName: 'Red' }],
  ['ProgressBar by rows', ProgressBar, { project }],
  ['ProgressBar by columns', ProgressBar, { project: toggleRowDirection(project) }],
  // No Frame and a bead drawn (ticket 0847): the hint and Fit a Frame and export a picture.
  ['ProgressBar with no Frame', ProgressBar, { project: withLayers(withFrameSheet(project, undefined), { beads: { 0: { 0: '#e63746' } } }) }],
  // The save ring with its label open (ticket 0796): on a phone a count with no room drops out, leaving the words.
  ['SaveReminder', SaveReminder, { beads: 12345, lastFileAt: Date.now() - 3 * 24 * 60 * 60 * 1000, labelOpen: true }],
]

describeFits(CASES)

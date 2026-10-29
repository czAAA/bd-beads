import { computed } from 'vue'
import { beadLabel } from '../../domain/beads'
import { rotationSwapsAxes } from '../../domain/grid'
import { projectColors } from '../../domain/layerBeads'
import { layerOf } from '../../domain/layerRecord'
import { rowProgressOn, rowProgressPosition } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { shownDimensions } from '../../domain/projectExtent'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import { fillBlanks } from '../../domain/fillBlanks'

/** What naming the open Project needs from the app shell: the Project and the app's language. */
export interface ProjectLabelsDeps {
  currentProject: () => Project | undefined
  messages: () => Translations
  locale: () => Locale
}

/** The words that name the open Project (tickets 37, 159, 206; ADR 0020): its Bead for the header, and its
 * accessible name. Deps are read lazily. */
export function useProjectLabels(deps: ProjectLabelsDeps) {
  /** The open Project's Bead for the header (ticket 37): its label, or an "unknown bead" placeholder when removed
   * (ticket 38) or never on this device. */
  const activeBeadLabel = computed(() => {
    const project = deps.currentProject()
    if (!project) {
      return undefined
    }
    const bead = layerOf(project, 'canvas').bead
    return bead ? beadLabel(bead, deps.messages().formFactors) : deps.messages().projects.unknownBeadLabel
  })

  /** The Project's accessible name (ScreenReaders card): "Logo panel, 40 by 30 beads, 2 colors, row 12 of 30 done". */
  const projectLabel = computed(() => {
    const project = deps.currentProject()
    if (!project) {
      return undefined
    }
    const t = deps.messages()
    const colors = projectColors(project).length
    const dimensions = shownDimensions(project)
    const [columns, rows] = rotationSwapsAxes(project.rotation) ? [dimensions.rows, dimensions.columns] : [dimensions.columns, dimensions.rows]
    const colorWords = plural(deps.locale(), colors, t.a11y.colorsCount)
    // With no Frame the canvas has no size to say: it is named as a Canvas.
    const parts = [
      project.frame
        ? fillBlanks(t.a11y.projectLabel, { name: project.name, columns, rows, colors: colorWords })
        : fillBlanks(t.a11y.canvasLabel, { name: project.name, colors: colorWords }),
    ]
    if (rowProgressOn(project)) {
      const { current: position, total } = rowProgressPosition(project)
      parts.push(fillBlanks(t.a11y.progressDone, { row: position, total }))
    }
    return parts.join(', ')
  })

  return { activeBeadLabel, projectLabel }
}

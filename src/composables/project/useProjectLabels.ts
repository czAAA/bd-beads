import { computed } from 'vue'
import { beadLabel } from '../../domain/beads'
import { rotationSwapsAxes } from '../../domain/grid'
import { resolveProjectBead, rowProgressPosition, type Project, projectDimensions } from '../../domain/project'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'

/** What naming the open Project needs from the app shell: the Project and the app's language. */
export interface ProjectLabelsDeps {
  currentProject: () => Project | undefined
  messages: () => Translations
  locale: () => Locale
}

/** The words that name the open Project (tickets 37, 159, 206; ADR 0020): its Bead for the header, and its accessible name. Deps are read lazily. */
export function useProjectLabels(deps: ProjectLabelsDeps) {
  /**
   * The open Project's single Bead, shown in the header (ticket 37): its label when the catalog still has it, or a
   * neutral "unknown bead" placeholder when it doesn't — a custom Bead removed since (ticket 38), or one an imported
   * file names that this device never had.
   */
  const activeBeadLabel = computed(() => {
    const project = deps.currentProject()
    if (!project) {
      return undefined
    }
    const bead = resolveProjectBead(project)
    return bead ? beadLabel(bead) : deps.messages().projects.unknownBeadLabel
  })

  /** The Project's accessible name (ScreenReaders card): "Logo panel, 40 by 30 beads, 2 colors, row 12 of 30 done". */
  const projectLabel = computed(() => {
    const project = deps.currentProject()
    if (!project) {
      return undefined
    }
    const t = deps.messages()
    const colors = new Set(Object.values(project.beads).flatMap((row) => Object.values(row))).size
    const dimensions = projectDimensions(project)
    const [columns, rows] = rotationSwapsAxes(project.rotation) ? [dimensions.rows, dimensions.columns] : [dimensions.columns, dimensions.rows]
    const colorWords = plural(deps.locale(), colors, t.a11y.colorsCount)
    // With no Frame the canvas has no size to say: it is named as an open canvas.
    const parts = [
      (project.frame ? t.a11y.projectLabel : t.a11y.canvasLabel)
        .replace('{name}', project.name)
        .replace('{columns}', String(columns))
        .replace('{rows}', String(rows))
        .replace('{colors}', colorWords),
    ]
    if (project.rowProgress.enabled) {
      const { current: position, total } = rowProgressPosition(project)
      parts.push(t.a11y.progressDone.replace('{row}', String(position)).replace('{total}', String(total)))
    }
    return parts.join(', ')
  })

  return { activeBeadLabel, projectLabel }
}

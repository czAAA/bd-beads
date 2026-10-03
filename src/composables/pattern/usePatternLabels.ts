import { computed } from 'vue'
import { beadLabel } from '../../domain/beads'
import { rotationSwapsAxes } from '../../domain/grid'
import { resolvePatternBead, type Pattern, patternDimensions } from '../../domain/pattern'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'

/** What naming the open Pattern needs from the app shell: the Pattern and the app's language. */
export interface PatternLabelsDeps {
  currentPattern: () => Pattern | undefined
  messages: () => Translations
  locale: () => Locale
}

/** The words that name the open Pattern (tickets 37, 159, 206; ADR 0023): its Bead for the header, and its accessible name. Deps are read lazily. */
export function usePatternLabels(deps: PatternLabelsDeps) {
  /**
   * The open Pattern's single Bead, shown in the header (ticket 37): its label when the catalog still has it, or a
   * neutral "unknown bead" placeholder when it doesn't — a custom Bead removed since (ticket 38), or one an imported
   * file names that this device never had.
   */
  const activeBeadLabel = computed(() => {
    const pattern = deps.currentPattern()
    if (!pattern) {
      return undefined
    }
    const bead = resolvePatternBead(pattern)
    return bead ? beadLabel(bead) : deps.messages().patterns.unknownBeadLabel
  })

  /** The Pattern's accessible name (ScreenReaders card): "Logo panel, 40 by 30 beads, 2 colors, row 12 of 30 done". */
  const patternLabel = computed(() => {
    const pattern = deps.currentPattern()
    if (!pattern) {
      return undefined
    }
    const t = deps.messages()
    const colors = new Set(Object.values(pattern.beads).flatMap((row) => Object.values(row))).size
    const dimensions = patternDimensions(pattern)
    const [columns, rows] = rotationSwapsAxes(pattern.rotation) ? [dimensions.rows, dimensions.columns] : [dimensions.columns, dimensions.rows]
    const colorWords = plural(deps.locale(), colors, t.a11y.colorsCount)
    // With no Frame the canvas has no size to say: it is named as an open canvas.
    const parts = [
      (pattern.frame ? t.a11y.patternLabel : t.a11y.canvasLabel)
        .replace('{name}', pattern.name)
        .replace('{columns}', String(columns))
        .replace('{rows}', String(rows))
        .replace('{colors}', colorWords),
    ]
    if (pattern.rowProgress.enabled) {
      const position = pattern.rowProgress.direction === 'rows' ? pattern.rowProgress.currentRow : pattern.rowProgress.currentColumn
      const total = pattern.rowProgress.direction === 'rows' ? patternDimensions(pattern).rows : patternDimensions(pattern).columns
      parts.push(t.a11y.progressDone.replace('{row}', String(position)).replace('{total}', String(total)))
    }
    return parts.join(', ')
  })

  return { activeBeadLabel, patternLabel }
}

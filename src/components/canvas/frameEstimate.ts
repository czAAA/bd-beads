import { seenSize } from '../../domain/frameOrientation'
import { settingValuesOf } from '../../domain/frameShape'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import type { FrameId } from '../../domain/grid'
import { frameById, layerOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'

/** A Frame's Estimated size as "≈ 3.8 × 3.9 cm" (the Bead's size × beads across and down), in the unit the margin's title
 * block gives it (cm from 10 mm up, ticket 0992), or nothing for an unknown Bead: the Frame popover's field and row. */
export function frameEstimate(t: Translations, locale: Locale, project: Project, id: FrameId): string {
  const frame = frameById(project, id)
  const bead = layerOf(project, id)?.bead
  const units = { mm: t.form.unitMm, cm: t.form.unitCm }
  return bead && frame ? `≈ ${formatSizeMm(estimatedSizeMm(frame, bead, frame.technique), units, locale)}` : ''
}

/** A Frame's size as seen, "40 × 11", or a Custom frame's own shape setting, "9 rounds": the Frame popover's Size row and
 * the expanded rail's size chip (tickets 1257, 1260). */
export function frameSizeWords(t: Translations, locale: Locale, project: Project, id: FrameId): string {
  const frame = frameById(project, id)
  if (!frame) return ''
  const first = settingValuesOf(frame)[0]
  if (first) return plural(locale, first.value, t.frame.sizeSettings[first.name].summary)
  const { columns, rows } = seenSize(frame)
  return `${columns} × ${rows}`
}

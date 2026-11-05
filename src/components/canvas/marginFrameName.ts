import { MAX_PIECE_NAME } from '../../domain/pieceNames'
import type { Translations } from '../../i18n/translations'

/** The Frame's name as a bare EditableLine of the margin sheet (ticket 0657): the title block's name cell and, unnamed,
 * its folded tab (ticket 0803) edit it through the same field. */
export function frameNameLine(t: Translations, name: string | undefined) {
  return {
    bare: true,
    label: t.panels.project.nameLabel,
    value: name ?? '',
    editLabel: t.frame.nameEdit,
    editTooltip: t.frame.nameTooltip,
    emptyText: t.frame.nameEmpty,
    maxlength: MAX_PIECE_NAME,
    normalize: (raw: string) => raw.trim(),
    testid: 'margin-frame-name',
  }
}

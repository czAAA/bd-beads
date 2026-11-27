import { MAX_PIECE_NAME } from '../../domain/pieceNames'
import type { Translations } from '../../i18n/translations'

/** The Frame's name as the chip of the margin sheet's band (tickets 0657, 1258). */
export function frameNameLine(t: Translations, name: string | undefined) {
  return {
    bare: true,
    label: t.panels.project.nameLabel,
    value: name ?? '',
    editLabel: t.frame.nameEdit,
    editTooltip: t.frame.nameTooltip,
    emptyText: t.frame.nameEmpty,
    placeholder: t.fields.frameName,
    maxlength: MAX_PIECE_NAME,
    normalize: (raw: string) => raw.trim(),
    testid: 'margin-frame-name',
  }
}

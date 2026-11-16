import { fillBlanks } from '../../domain/fillBlanks'
import type { MirrorGrowth, MirrorSetting } from '../../domain/mirror'
import { plural, pluralForm } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'

/** The Message a Canvas Area grown to fit says (ticket 1027, Message card; tickets 1028 and 1029 show it too): the new
 * size as the Mirror bar's readout writes it, the Mode and only what it grew for, an Axis count or Radial's Fold. */
export function mirrorGrownMessage(t: Translations, locale: Locale, setting: MirrorSetting, growth: MirrorGrowth): string {
  const { area, grewFor } = growth
  const size = `${area.columns}×${area.rows}`
  if (grewFor.fold !== undefined) return fillBlanks(pluralForm(locale, grewFor.fold, t.mirror.grownForFold), { size, count: grewFor.fold })
  const leftRight = grewFor.leftRight === undefined ? undefined : plural(locale, grewFor.leftRight, t.mirror.leftRightAxesCount)
  const topBottom = grewFor.topBottom === undefined ? undefined : plural(locale, grewFor.topBottom, t.mirror.topBottomAxesCount)
  const axes = leftRight && topBottom ? fillBlanks(t.mirror.bothAxes, { leftRight, topBottom }) : (leftRight ?? topBottom ?? '')
  return fillBlanks(t.mirror.grownForAxes, { size, mode: t.mirror[setting.mode], axes })
}

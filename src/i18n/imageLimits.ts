import { ACCEPTED_IMAGE_FORMATS, formatImageLimits } from '../domain/imageConversion'
import { formatList } from './listFormat'
import type { Locale } from './translations'

/** A sentence with the picture limits filled in (formatImageLimits), the formats joined as `locale` says "or": "PNG, JPEG,
 * GIF, or WebP" (writing.md, ticket 0863), never a bare list. `more` gives the other blanks, such as the paste key. */
export function imageLimitsText(locale: Locale, template: string, more: Readonly<Record<string, string>> = {}): string {
  const formats = formatList(locale, ACCEPTED_IMAGE_FORMATS.map((format) => format.label), 'disjunction')
  return formatImageLimits(template, { formats, ...more })
}

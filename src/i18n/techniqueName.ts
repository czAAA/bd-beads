import type { Technique } from '../domain/grid'
import type { Translations } from './translations'

/** A Technique's name in the current language (loom, peyote, brick stitch). */
export function techniqueName(t: Translations, technique: Technique): string {
  return { loom: t.form.techniqueLoom, peyote: t.form.techniquePeyote, brick: t.form.techniqueBrick }[technique]
}

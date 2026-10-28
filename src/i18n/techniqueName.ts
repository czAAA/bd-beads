import { techniqueNameKey, type Technique } from '../domain/weave'
import type { Translations } from './translations'

/** A Technique's name in the current language (loom, peyote, brick stitch). */
export function techniqueName(t: Translations, technique: Technique): string {
  return t.techniques[techniqueNameKey(technique)] ?? technique
}

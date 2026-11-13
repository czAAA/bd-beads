import { findBead } from './beads'
import type { ColorSource } from './convertColors'
import { NEW_PROJECT_DEFAULTS, type CreateProjectInput } from './createProject'
import { settingsOffDefault, TECHNIQUES, weaveSettings, type Technique, type TechniqueSettings } from './weave'

/** What the device remembers of its last conversion (ticket 0893, ADR 0010 D-3): the Bead, the Technique with its Drop
 * and the source of the colors. Width, the number of colors and the crop belong to the picture and are never kept.
 * Stored as a JSON object read field by field, so a later choice (the Finish filter, ticket 0901) is one more field. */
export interface ConvertChoices {
  beadId: string
  technique: Technique
  techniqueSettings: TechniqueSettings
  /** None until a conversion has been made: the converter's own first choice (Bead colors) applies. */
  source?: ColorSource
}

/** The Bead and Technique a device that has converted nothing starts on (ticket 0893, finding CB-09). */
const FIRST_SETUP = { beadId: 'miyuki/delica/11-0', technique: 'peyote' } as const satisfies { beadId: string; technique: Technique }

/** Where a device that has converted nothing starts: Miyuki Delica 11/0 in peyote, its Drop at its default. */
export const FIRST_CONVERT_CHOICES: ConvertChoices = { ...FIRST_SETUP, techniqueSettings: weaveSettings(FIRST_SETUP) }

const COLOR_SOURCES: readonly ColorSource[] = ['bead-colors', 'my-beads', 'default', 'exact']

/** The choices a saved string stands for, or undefined when it is not choices at all. Each part that no longer reads (a
 * Bead that left the catalog, a Technique or source this build lacks) is the first-time choice for that part. */
export function parseConvertChoices(raw: string): ConvertChoices | undefined {
  let saved: unknown
  try {
    saved = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return undefined
  const fields = saved as Record<string, unknown>
  const bead = typeof fields.beadId === 'string' ? findBead(fields.beadId) : undefined
  const technique = TECHNIQUES.find((known) => known === fields.technique)
  const source = COLOR_SOURCES.find((known) => known === fields.source)
  return {
    beadId: bead && !bead.retired ? bead.id : FIRST_CONVERT_CHOICES.beadId,
    ...(technique
      ? { technique, techniqueSettings: weaveSettings({ technique, techniqueSettings: numbersOf(fields.techniqueSettings) }) }
      : { technique: FIRST_CONVERT_CHOICES.technique, techniqueSettings: FIRST_CONVERT_CHOICES.techniqueSettings }),
    ...(source ? { source } : {}),
  }
}

/** The saved form of the choices: a JSON object, its fields read one by one by `parseConvertChoices`. */
export function writeConvertChoices(choices: ConvertChoices): string {
  return JSON.stringify(choices)
}

function numbersOf(value: unknown): TechniqueSettings {
  if (typeof value !== 'object' || value === null) return {}
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'))
}

/** Where the converter opens (ticket 0893): the New Project form's Bead, and its Technique with its Drop, where the
 * person changed them from the form's defaults in this visit, else the remembered ones; and the remembered source. */
export function converterStart(form: CreateProjectInput, remembered: ConvertChoices): { start: CreateProjectInput; source?: ColorSource } {
  const beadChanged = form.beadId !== NEW_PROJECT_DEFAULTS.beadId
  const techniqueChanged =
    form.technique !== NEW_PROJECT_DEFAULTS.technique || Object.keys(settingsOffDefault(form.techniqueSettings)).length > 0
  const start: CreateProjectInput = {
    ...form,
    beadId: beadChanged ? form.beadId : remembered.beadId,
    ...(techniqueChanged ? {} : { technique: remembered.technique, techniqueSettings: remembered.techniqueSettings }),
  }
  return { start, ...(remembered.source ? { source: remembered.source } : {}) }
}

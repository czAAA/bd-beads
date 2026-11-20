import type { Translations } from './translations'
import { account } from './es/account'
import { canvas } from './es/canvas'
import { colors } from './es/colors'
import { convert } from './es/convert'
import { frame } from './es/frame'
import { homepage } from './es/homepage'
import { panels } from './es/panels'
import { print } from './es/print'
import { projects } from './es/projects'
import { reference } from './es/reference'
import { shell } from './es/shell'
import { tools } from './es/tools'

// Domain words follow CONTEXT.md: proyecto (Project), esquema (Schema), cuenta (Bead), paleta (Palette), técnica (Technique),
// marco (Frame), trozo (Piece), progreso por filas (Row progress). Neutral Spanish, tuteo ("tú").
export const es: Translations = {
  ...shell,
  ...homepage,
  ...account,
  ...tools,
  ...colors,
  ...panels,
  ...projects,
  ...canvas,
  ...print,
  ...frame,
  ...convert,
  ...reference,
}

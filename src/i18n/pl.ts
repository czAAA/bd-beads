import type { Translations } from './translations'
import { account } from './pl/account'
import { canvas } from './pl/canvas'
import { colors } from './pl/colors'
import { convert } from './pl/convert'
import { frame } from './pl/frame'
import { homepage } from './pl/homepage'
import { panels } from './pl/panels'
import { print } from './pl/print'
import { projects } from './pl/projects'
import { reference } from './pl/reference'
import { shell } from './pl/shell'
import { tools } from './pl/tools'

// Domain words follow CONTEXT.md: projekt (Project), schemat (Schema), koralik (Bead), paleta (Palette), technika (Technique),
// ramka (Frame), kawałek (Piece), postęp rzędów (Row progress). Addressed as "ty", in the imperative.
export const pl: Translations = {
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

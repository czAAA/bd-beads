import type { Translations } from './translations'
import { account } from './uk/account'
import { canvas } from './uk/canvas'
import { colors } from './uk/colors'
import { convert } from './uk/convert'
import { frame } from './uk/frame'
import { homepage } from './uk/homepage'
import { panels } from './uk/panels'
import { print } from './uk/print'
import { projects } from './uk/projects'
import { reference } from './uk/reference'
import { shell } from './uk/shell'
import { tools } from './uk/tools'

// Domain words follow CONTEXT.md and the Russian glossary: проєкт (Project), схема (Schema), бісерина / бісер (Bead),
// палітра (Palette), техніка плетіння (Technique), рамка (Frame), шматочок (Piece), прогрес за рядами (Row progress).
export const uk: Translations = {
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

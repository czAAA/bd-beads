import type { Translations } from './translations'
import { account } from './ru/account'
import { canvas } from './ru/canvas'
import { colors } from './ru/colors'
import { convert } from './ru/convert'
import { frame } from './ru/frame'
import { homepage } from './ru/homepage'
import { panels } from './ru/panels'
import { print } from './ru/print'
import { projects } from './ru/projects'
import { reference } from './ru/reference'
import { shell } from './ru/shell'
import { tools } from './ru/tools'

// Terms marked with a glossary entry in CONTEXT.md (Project, Bead, Technique, Palette, Form factor, Clear project)
// reuse that exact wording rather than retranslating.
export const ru: Translations = {
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

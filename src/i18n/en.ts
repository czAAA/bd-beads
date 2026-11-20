import type { Translations } from './translations'
import { account } from './en/account'
import { canvas } from './en/canvas'
import { colors } from './en/colors'
import { convert } from './en/convert'
import { frame } from './en/frame'
import { homepage } from './en/homepage'
import { panels } from './en/panels'
import { print } from './en/print'
import { projects } from './en/projects'
import { reference } from './en/reference'
import { shell } from './en/shell'
import { tools } from './en/tools'

export const en: Translations = {
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

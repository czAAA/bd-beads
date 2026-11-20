import type { Translations } from './translations'
import { account } from './be/account'
import { canvas } from './be/canvas'
import { colors } from './be/colors'
import { convert } from './be/convert'
import { frame } from './be/frame'
import { homepage } from './be/homepage'
import { panels } from './be/panels'
import { print } from './be/print'
import { projects } from './be/projects'
import { reference } from './be/reference'
import { shell } from './be/shell'
import { tools } from './be/tools'

// Domain words follow CONTEXT.md and the Russian glossary: праект (Project), схема (Schema), бісерына / бісер (Bead),
// палітра (Palette), тэхніка пляцення (Technique), рамка (Frame), кавалачак (Piece), прагрэс па радках (Row progress).
// Belarusian in the official orthography (narkamaŭka), Cyrillic.
export const be: Translations = {
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

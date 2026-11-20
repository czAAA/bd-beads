import type { Translations } from './translations'
import { account } from './zh/account'
import { canvas } from './zh/canvas'
import { colors } from './zh/colors'
import { convert } from './zh/convert'
import { frame } from './zh/frame'
import { homepage } from './zh/homepage'
import { panels } from './zh/panels'
import { print } from './zh/print'
import { projects } from './zh/projects'
import { reference } from './zh/reference'
import { shell } from './zh/shell'
import { tools } from './zh/tools'

// Domain words follow CONTEXT.md: 项目 (Project), 图样 (Schema), 珠子 (Bead), 调色板 (Palette), 编织技法 (Technique),
// 边框 (Frame), 小块 (Piece), 行进度 (Row progress). Simplified Chinese; the device's own CJK font draws it (ADR 0039).
export const zh: Translations = {
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

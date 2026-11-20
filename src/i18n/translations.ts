import type { Locale } from '../domain/locale'
import type { ShellTranslations } from './translations/shell'
import type { HomepageTranslations } from './translations/homepage'
import type { AccountTranslations } from './translations/account'
import type { ToolsTranslations } from './translations/tools'
import type { ColorsTranslations } from './translations/colors'
import type { PanelsTranslations } from './translations/panels'
import type { ProjectsTranslations } from './translations/projects'
import type { CanvasTranslations } from './translations/canvas'
import type { PrintTranslations } from './translations/print'
import type { FrameTranslations } from './translations/frame'
import type { ConvertTranslations } from './translations/convert'
import type { ReferenceTranslations } from './translations/reference'

export type { Locale }
export type { InsideChapterId, InsideRowId } from './translations/homepage'
export type { SettingWords } from './translations/panels'

/** Every string the app shows, in one language: each area's strings put together, one file per area (ticket 1135). */
export interface Translations
  extends
    ShellTranslations,
    HomepageTranslations,
    AccountTranslations,
    ToolsTranslations,
    ColorsTranslations,
    PanelsTranslations,
    ProjectsTranslations,
    CanvasTranslations,
    PrintTranslations,
    FrameTranslations,
    ConvertTranslations,
    ReferenceTranslations {}

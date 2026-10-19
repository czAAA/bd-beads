import type { Translations } from '../../i18n/translations'

/** The panels that open in a PanelShell (spec 0440, tickets 443, 475, 510). */
export type PanelId = 'menu' | 'project' | 'frame'

/** How a panel opens: what PanelShell is told, and which buttons open it. */
export interface PanelDescriptor {
  id: PanelId
  title: (t: Translations) => string
  /** The strip button the panel hangs from, by test id. */
  anchor: string
  align: 'start' | 'end'
  /** A `menu` of items from 1024px; the others hold fields and are plain dialogs. */
  menu: boolean
  /** A dropdown at every width, never the Top sheet. */
  dropdown: boolean
  /** Every control that opens it, by test id: a press on one is the opener's own to toggle, not a press outside. */
  openers: readonly string[]
}

export const PANELS: Record<PanelId, PanelDescriptor> = {
  menu: { id: 'menu', title: (t) => t.header.menuButton, anchor: 'strip-menu', align: 'start', menu: true, dropdown: false, openers: ['strip-menu'] },
  project: { id: 'project', title: (t) => t.header.projectSheetLabel, anchor: 'strip-project', align: 'start', menu: false, dropdown: false, openers: ['strip-project'] },
  // The Frame bar hangs from the strip's Frame button, or, when the edit pencil opened it, from the pencil (a placement override).
  frame: { id: 'frame', title: (t) => t.frame.title, anchor: 'strip-frame', align: 'start', menu: false, dropdown: false, openers: ['strip-frame', 'frame-edit-toggle'] },
}

/** The selector matching every panel's opener buttons. */
export const PANEL_OPENERS = Object.values(PANELS)
  .flatMap((panel) => panel.openers)
  .map((testId) => `[data-testid="${testId}"]`)
  .join(', ')

import type { Translations } from '../../i18n/translations'

/** The panels that open in a PanelShell (spec 0440, tickets 443, 475, 510). */
export type PanelId = 'menu' | 'project' | 'frame'

/** How a panel opens: what PanelShell is told, and which buttons open it. */
export interface PanelDescriptor {
  id: PanelId
  title: (t: Translations) => string
  /** The strip button the panel hangs from, by test id. */
  anchor: string
  /** A `menu` of items from 1024px; the others hold fields and are plain dialogs. */
  menu: boolean
  /** Opens without focusing a field, so a tablet's keyboard stays down. */
  skipsFields: boolean
  /** The dropdown's own width, when not the standard panel width. Placement is PanelShell's alone. */
  width?: string
  /** Every control that opens it, by test id: a press on one is the opener's own to toggle, not a press outside. */
  openers: readonly string[]
}

export const PANELS: Record<PanelId, PanelDescriptor> = {
  menu: { id: 'menu', title: (t) => t.header.menuButton, anchor: 'strip-menu', menu: true, skipsFields: false, openers: ['strip-menu'] },
  project: { id: 'project', title: (t) => t.header.projectSheetLabel, anchor: 'strip-project', menu: false, skipsFields: false, openers: ['strip-project'] },
  // The Frame bar opens from the strip's Frame button alone; the edit pencil on the Frame shows its handles and is no opener.
  frame: { id: 'frame', title: (t) => t.frame.title, anchor: 'strip-frame', menu: false, skipsFields: true, width: 'min(calc(100vw - 2 * var(--frame-bar-gap)), var(--frame-bar-width))', openers: ['strip-frame'] },
}

/** The selector matching every panel's opener buttons. */
export const PANEL_OPENERS = Object.values(PANELS)
  .flatMap((panel) => panel.openers)
  .map((testId) => `[data-testid="${testId}"]`)
  .join(', ')

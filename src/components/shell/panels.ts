import type { Translations } from '../../i18n/translations'

/** The panels that open in an AppPanel (spec 0440, tickets 443, 475, 510). */
export type PanelId = 'menu' | 'project' | 'frame' | 'export'

/** How a panel opens: what AppPanel is told, and which buttons open it. */
export interface PanelDescriptor {
  id: PanelId
  title: (t: Translations) => string
  /** The strip button the panel hangs from, by test id. */
  anchor: string
  /** A `menu` of items; the others hold fields and are plain dialogs. */
  menu: boolean
  /** Opens without focusing a field, so a tablet's keyboard stays down. */
  skipsFields: boolean
  /** The dropdown's own width, when not the standard panel width. Placement is AppPanel's alone. */
  width?: string
  /** The button edge the dropdown lines up with: its left (the default) or, for a button in the strip's right corner, its right. */
  align?: 'start' | 'end'
  /** Every control that opens it, by test id: a press on one is the opener's own to toggle, not a press outside. */
  openers: readonly string[]
}

export const PANELS: Record<PanelId, PanelDescriptor> = {
  menu: { id: 'menu', title: (t) => t.header.menuButton, anchor: 'strip-menu', menu: true, skipsFields: false, openers: ['strip-menu'] },
  project: { id: 'project', title: (t) => t.header.projectPanelLabel, anchor: 'strip-project', menu: false, skipsFields: false, openers: ['strip-project'] },
  // The Frame panel opens from the strip's Frame button alone; the edit pencil on the Frame shows its handles and is no opener.
  frame: { id: 'frame', title: (t) => t.frame.title, anchor: 'strip-frame', menu: false, skipsFields: true, openers: ['strip-frame'] },
  // The Export panel (ticket 0652): small, and hung from the strip's last button, so it lines up with its right edge.
  export: {
    id: 'export',
    title: (t) => t.panels.project.exportHeading,
    anchor: 'strip-export',
    menu: false,
    skipsFields: true,
    width: 'var(--panel-width-small)',
    align: 'end',
    // The margin sheet's Export button opens it too, hung from that button (ticket 0657).
    openers: ['strip-export', 'margin-export'],
  },
}

/** The selector matching every panel's opener buttons. */
export const PANEL_OPENERS = Object.values(PANELS)
  .flatMap((panel) => panel.openers)
  .map((testId) => `[data-testid="${testId}"]`)
  .join(', ')

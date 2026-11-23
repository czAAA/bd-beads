import type { PanelId } from '../../components/shell/panels'

/** What is open over the canvas, or none: a panel (the strip's Menu and Project, the Frame panel) (App.vue's own routing state -- not a domain concept). */
export type OpenPanel = PanelId

/** The buttons the Export panel can hang from, by test id (tickets 0657, 0658): the Canvas strip's, the margin sheet's
 * and, on a folded sheet, its Frame tools menu's. */
export type ExportOpener = 'strip-export' | 'margin-export' | 'margin-frame-tools' | 'context-bar-export'

/** What the Export panel exports (ticket 1210): the Project's Frame, or just the Selection, from the Selection bar's
 * Export button. The panel is the same; only what it hangs from and what it exports differ. */
export type ExportScope = 'frame' | 'selection'

/** The export the Export panel opens on (ticket 0843): Picture or Printable chart, as the Project panel's rows ask. */
export type ExportChoice = 'png' | 'pdf'

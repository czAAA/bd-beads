import type { PanelId } from '../../components/shell/panels'

/** What is open over the canvas, or none: a panel (the strip's Menu and Project, the Frame panel) (App.vue's own routing state -- not a domain concept). */
export type OpenPanel = PanelId

/** The buttons the Export panel can hang from, by test id (tickets 0657, 0658): the Canvas strip's, the margin sheet's
 * and, on a folded sheet, its Frame tools menu's. */
export type ExportOpener = 'strip-export' | 'margin-export' | 'margin-frame-tools'

/** The export the Export panel opens on (ticket 0843): Picture or Printable chart, as the Project panel's rows ask. */
export type ExportChoice = 'png' | 'pdf'

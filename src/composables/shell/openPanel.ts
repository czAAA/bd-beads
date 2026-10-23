import type { PanelId } from '../../components/shell/panels'

/** What is open over the canvas, or none: a panel (the strip's Menu and Project, the Frame panel) (App.vue's own routing state -- not a domain concept). */
export type OpenPanel = PanelId

import type { PanelId } from '../../components/shell/panels'

/** What is open over the canvas, or none: a panel (the strip's Menu and Project, the Frame bar) or Mirror's bottom sheet (App.vue's own routing state -- not a domain concept). 'mirror' exists only while MIRROR_ENABLED. */
export type PhoneSheet = 'mirror' | PanelId

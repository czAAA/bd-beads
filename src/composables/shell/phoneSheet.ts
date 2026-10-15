/** Which bottom sheet is open (the Dock's Colour, the strip's Menu and Project), or none (App.vue's own routing state -- not a domain concept). 'mirror' exists only while MIRROR_ENABLED. */
export type PhoneSheet = 'color' | 'mirror' | 'project' | 'menu'

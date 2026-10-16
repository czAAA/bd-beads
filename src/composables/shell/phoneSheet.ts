/** Which bottom sheet is open (the strip's Menu and Project, or Mirror), or none (App.vue's own routing state -- not a domain concept). 'mirror' exists only while MIRROR_ENABLED. */
export type PhoneSheet = 'mirror' | 'project' | 'menu'

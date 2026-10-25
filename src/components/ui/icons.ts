/** Icons v2 (DESIGN.md §4.5): the design system's SVG files drawn inline; don't redraw one, refresh the files
 * instead (DESIGN.md §6). */

export const ICON_NAMES = [
  'arrow-down',
  'arrow-up',
  'bead',
  'check',
  'chevron-down',
  'chevron-left',
  'chevron-up',
  'close',
  'cloud',
  'cloud-off',
  'code',
  'coffee',
  'contrast',
  'copy',
  'cut',
  'delete',
  'device',
  'erase',
  'export',
  'external',
  'eyedropper',
  'fill',
  'fill-selection',
  'fit',
  'frame',
  'globe',
  'grid',
  'hand',
  'image',
  'import',
  'info',
  'keyboard',
  'library',
  'menu',
  'moon',
  'more',
  'move-frame',
  'name-piece',
  'paint',
  'palette',
  'paste',
  'pencil',
  'pattern',
  'pdf',
  'pen-mode',
  'pen-mode-off',
  'piece',
  'plus',
  'position-bottom',
  'position-left',
  'position-right',
  'position-top',
  'redo',
  'reset',
  'remove-line',
  'rotate',
  'rotate-canvas',
  'row-highlight',
  'ruler',
  'save',
  'select',
  'select-all',
  'share',
  'sidebar',
  'size',
  'sun',
  'turn-row-direction',
  'undo',
  'warning',
  'zoom-in',
  'zoom-out',
] as const

export type IconName = (typeof ICON_NAMES)[number]

/** The sizes the design system uses (README, Iconography): 12 the picker chevron, 14 expand, panel marks and saved check, 15 buttons, 16 links, rows,
 * zoom and messages, 17 the Edit row, 18 tool tabs, 22 the BottomToolbar and Dock (ticket 168, 79). */
export type IconSize = 12 | 14 | 15 | 16 | 17 | 18 | 22 | 34

const files = import.meta.glob<string>('../../../docs/design/system/assets/Icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Every icon's drawing: the SVG file's children, without the outer <svg> and its fixed ink stroke. */
export const ICON_BODIES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [
    /([^/]+)\.svg$/.exec(path)![1],
    svg
      .replace(/^[\s\S]*?<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '')
      .replace(/<metadata>[\s\S]*?<\/metadata>/, '') // the files' provenance blob is not drawing, and shows up as text
      .trim(),
  ]),
)

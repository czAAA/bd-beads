/**
 * Icons v2 (DESIGN.md §4.5): the design system's SVG files, read as they are and drawn inline so they take the text
 * color. Don't redraw an icon here; refresh the files from the design system instead (DESIGN.md §6).
 */

export const ICON_NAMES = [
  'arrow-down',
  'arrow-up',
  'bead',
  'check',
  'chevron-down',
  'chevron-left',
  'chevron-up',
  'close',
  'contrast',
  'copy',
  'delete',
  'device',
  'erase',
  'export',
  'fill',
  'fit',
  'grid',
  'image',
  'import',
  'info',
  'keyboard',
  'library',
  'menu',
  'mirror-copy-mode',
  'mirror-horizontal',
  'mirror-vertical',
  'moon',
  'more',
  'paint',
  'paste',
  'pattern',
  'pdf',
  'plus',
  'qr-code',
  'redo',
  'remove-line',
  'rotate',
  'save',
  'scan',
  'select',
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

/** The sizes the design system uses (README, Iconography): 14 expand and saved check, 15 buttons, 16 links, rows, zoom and messages, 17 the Edit row, 18 tool tabs, 22 the BottomToolbar and Dock (ticket 168, 79). */
export type IconSize = 14 | 15 | 16 | 17 | 18 | 22

const files = import.meta.glob<string>('../../docs/design/system/assets/Icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Every icon's drawing: the SVG file's children, without the outer <svg> and its fixed ink stroke. */
export const ICON_BODIES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [
    /([^/]+)\.svg$/.exec(path)![1],
    svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim(),
  ]),
)

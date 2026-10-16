import type { Tool } from '../../domain/tool'

/** The Tool pill's six tool tiles, in their fixed order (ToolPill card; ticket 439). */
export const PILL_TOOLS: readonly Tool[] = ['paint', 'fill', 'select', 'piece', 'erase', 'hand']

/** The Paste tool's key (ticket 447): not a Tool, but a tile after Hand that enters paste mode while the clipboard holds something. */
export const PASTE_TILE_HOTKEY = '7'

/** Each tool's single-key shortcut, shown as a badge on its Tool button (ticket 250). Eraser's `Del` is not one. */
export const TOOL_HOTKEYS: Record<Tool, string | undefined> = {
  paint: '1',
  fill: '2',
  select: '3',
  erase: '4',
  hand: '5',
  piece: '6',
}

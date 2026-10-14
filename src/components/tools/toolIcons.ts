import type { Tool } from '../../domain/tool'

/** What the tool strip shows, in their fixed order (ToolTabs card; ticket 414): the Tools, with Select all, which acts at once and is no Tool, after Piece. */
export const TILE_ORDER: readonly (Tool | 'select-all')[] = ['paint', 'fill', 'select', 'piece', 'select-all', 'erase', 'hand']

/** Each tool's single-key shortcut, shown as a badge on its Tool button (ticket 250). Eraser's `Del` is not one. */
export const TOOL_HOTKEYS: Record<Tool, string | undefined> = {
  paint: '1',
  fill: '2',
  select: '3',
  erase: '4',
  hand: '5',
  piece: '6',
}

/** Select all's key (ticket 414); Ctrl/⌘+A does the same. */
export const SELECT_ALL_HOTKEY = '7'

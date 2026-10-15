import type { Tool } from '../../domain/tool'

/** The Dock's six tool tiles, in their fixed order (Dock card; ticket 431). */
export const DOCK_TOOLS: readonly Tool[] = ['paint', 'fill', 'select', 'piece', 'erase', 'hand']

/** Each tool's single-key shortcut, shown as a badge on its Tool button (ticket 250). Eraser's `Del` is not one. */
export const TOOL_HOTKEYS: Record<Tool, string | undefined> = {
  paint: '1',
  fill: '2',
  select: '3',
  erase: '4',
  hand: '5',
  piece: '6',
}

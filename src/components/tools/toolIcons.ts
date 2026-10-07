import type { Tool } from '../../domain/tool'

/** The five tools, in their fixed order (ToolTabs card). */
export const TOOL_ORDER: readonly Tool[] = ['paint', 'fill', 'select', 'erase', 'hand']

/** Each tool's single-key shortcut, shown as a badge on its Tool button (ticket 250). Eraser's `Del` is not one. */
export const TOOL_HOTKEYS: Record<Tool, string | undefined> = {
  paint: '1',
  fill: '2',
  select: '3',
  erase: '4',
  hand: '5',
}

/** Set Frame's key (ticket 292): a mode rather than a Tool, so it sits beside TOOL_HOTKEYS, not in it. */
export const FRAME_HOTKEY = '6'

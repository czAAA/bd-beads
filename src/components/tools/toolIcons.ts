import type { Tool } from '../../domain/tool'
import type { IconName } from '../ui/icons'

/**
 * Which icon each of the five tools draws (ToolTabs card): the one truly shared bit between Toolbox's tabs,
 * BottomToolbar, Dock and the phone Tool ToolSheet, which each build their own tool list around it (their labels
 * need `useI18n`'s `t`, which isn't available outside a component, so the list itself stays local to each).
 */
export const TOOL_ICONS: Record<Tool, IconName> = {
  paint: 'paint',
  fill: 'fill',
  select: 'select',
  erase: 'erase',
  hand: 'hand',
}

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

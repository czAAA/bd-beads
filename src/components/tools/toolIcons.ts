import type { Tool } from '../../domain/tool'
import type { IconName } from '../ui/icons'

/**
 * Which icon each of the four tools draws (ToolTabs card): the one truly shared bit between Toolbox's tabs,
 * BottomToolbar, Dock and the phone Tool ToolSheet, which each build their own tool list around it (their labels
 * need `useI18n`'s `t`, which isn't available outside a component, so the list itself stays local to each).
 */
export const TOOL_ICONS: Record<Tool, IconName> = {
  paint: 'paint',
  fill: 'fill',
  select: 'select',
  erase: 'erase',
}

/** The four tools, in their fixed order (ToolTabs card). */
export const TOOL_ORDER: readonly Tool[] = ['paint', 'fill', 'select', 'erase']

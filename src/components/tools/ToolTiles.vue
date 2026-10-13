<script setup lang="ts">
import { controlAction } from '../../composables/shell/controlRegistry'
import type { Tool } from '../../domain/tool'
import IconButton from '../ui/IconButton.vue'
import { useCloseSheetOnPick } from '../shell/sheetContext'
import { TOOL_HOTKEYS, TOOL_ORDER } from './toolIcons'

/**
 * The five Tool tabs (ToolTabs card; ticket 397, extended for ticket 384): the same registry actions, in the same
 * order, in the Toolbox and the phone Tool sheet. Picking one emits it and closes the sheet it sits in, like every
 * other pick control (`useCloseSheetOnPick`); outside a sheet (the Toolbox) that does nothing. No wrapping element of
 * its own, so each caller keeps its own grid: the sheet's `auto-fill` tiles, the Toolbox's fixed five columns plus the
 * Frame tool and the input-mode toggle in the same grid.
 */
const props = withDefaults(
  defineProps<{
    activeTool: Tool
    /** The Frame is being set (Toolbox only, ticket 258): no tab lights up while it is. */
    settingFrame?: boolean
    /** The Toolbox and the phone Tool sheet give their tiles different testids (`tool-x` vs `sheet-tool-x`). */
    testidPrefix?: string
    /** The Toolbox's roving-focus tab stop (ticket 159); the phone sheet leaves tab order to the browser. */
    tabIndexFor?: (selected: boolean) => 0 | -1
  }>(),
  { settingFrame: false, testidPrefix: 'sheet-tool', tabIndexFor: undefined },
)

const emit = defineEmits<{ select: [tool: Tool] }>()
const closeSheet = useCloseSheetOnPick()

const tools = TOOL_ORDER.map((id) => ({ id, action: controlAction(`tool-${id}`), hotkey: TOOL_HOTKEYS[id] }))

function isSelected(id: Tool) {
  return props.activeTool === id && !props.settingFrame
}

function pick(tool: Tool) {
  emit('select', tool)
  closeSheet()
}
</script>

<template>
  <IconButton
    v-for="tool in tools"
    :key="tool.id"
    variant="tool"
    :action="tool.action"
    :hotkey="tool.hotkey"
    show-hotkey
    :selected="isSelected(tool.id)"
    :data-testid="`${testidPrefix}-${tool.id}`"
    :data-tour="`tool-${tool.id}`"
    :tabindex="tabIndexFor ? tabIndexFor(isSelected(tool.id)) : undefined"
    @click="pick(tool.id)"
  />
</template>

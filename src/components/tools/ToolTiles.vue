<script setup lang="ts">
import { controlAction } from '../../composables/shell/controlRegistry'
import type { Tool } from '../../domain/tool'
import IconButton from '../ui/IconButton.vue'
import { useCloseSheetOnPick } from '../shell/sheetContext'
import { TOOL_HOTKEYS, TOOL_ORDER } from './toolIcons'

/**
 * The five Tool tabs (ToolTabs card; ticket 397, extended for ticket 384): the same registry actions, in the same
 * order, in the phone Tool sheet. Picking one emits it and closes the sheet it sits in, like every other pick control
 * (`useCloseSheetOnPick`); outside a sheet that does nothing. No wrapping element of its own, so the caller keeps its
 * own grid: the sheet's `auto-fill` tiles.
 */
const props = defineProps<{ activeTool: Tool }>()

const emit = defineEmits<{ select: [tool: Tool] }>()
const closeSheet = useCloseSheetOnPick()

const tools = TOOL_ORDER.map((id) => ({ id, action: controlAction(`tool-${id}`), hotkey: TOOL_HOTKEYS[id] }))

function isSelected(id: Tool) {
  return props.activeTool === id
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
    :data-testid="`sheet-tool-${tool.id}`"
    :data-tour="`tool-${tool.id}`"
    @click="pick(tool.id)"
  />
</template>

<script setup lang="ts">
import { controlAction } from '../../composables/shell/controlRegistry'
import type { Tool } from '../../domain/tool'
import IconButton from '../ui/IconButton.vue'
import { useCloseSheetOnPick } from '../shell/sheetContext'
import { SELECT_ALL_HOTKEY, TILE_ORDER, TOOL_HOTKEYS } from './toolIcons'

/**
 * The Tool tabs and Select all (ToolTabs card; ticket 397, extended for ticket 384): the same registry actions, in the same
 * order, in the phone Tool sheet. Picking one emits it and closes the sheet it sits in, like every other pick control
 * (`useCloseSheetOnPick`); outside a sheet that does nothing. No wrapping element of its own, so the caller keeps its
 * own grid: the sheet's `auto-fill` tiles.
 */
const props = defineProps<{ activeTool: Tool }>()

const emit = defineEmits<{ select: [tool: Tool]; 'select-all': [] }>()
const closeSheet = useCloseSheetOnPick()

const tools = TILE_ORDER.map((id) =>
  id === 'select-all'
    ? { id, action: controlAction('select-all'), hotkey: SELECT_ALL_HOTKEY }
    : { id, action: controlAction(`tool-${id}`), hotkey: TOOL_HOTKEYS[id] },
)

/** Select all acts at once and is never the current tool (ticket 414), so it is not a toggle. */
function isSelected(id: Tool | 'select-all') {
  return id === 'select-all' ? undefined : props.activeTool === id
}

function pick(id: Tool | 'select-all') {
  if (id === 'select-all') emit('select-all')
  else emit('select', id)
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

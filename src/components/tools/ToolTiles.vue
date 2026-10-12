<script setup lang="ts">
import { controlAction } from '../../composables/shell/controlRegistry'
import type { Tool } from '../../domain/tool'
import IconButton from '../ui/IconButton.vue'
import { useCloseSheetOnPick } from '../shell/sheetContext'
import { TOOL_HOTKEYS, TOOL_ORDER } from './toolIcons'

/**
 * The tool tiles of the phone Tool sheet (ToolSheet card): the same registry actions, in the same order, as the
 * Toolbox's tabs. Choosing one emits it and closes the sheet it sits in, like every other pick control.
 */
defineProps<{ activeTool: Tool }>()
const emit = defineEmits<{ select: [tool: Tool] }>()
const closeSheet = useCloseSheetOnPick()

const tools = TOOL_ORDER.map((id) => ({ id, action: controlAction(`tool-${id}`), hotkey: TOOL_HOTKEYS[id] }))

function pick(tool: Tool) {
  emit('select', tool)
  closeSheet()
}
</script>

<template>
  <div class="tool-tiles">
    <IconButton
      v-for="tool in tools"
      :key="tool.id"
      variant="tool"
      :action="tool.action"
      :hotkey="tool.hotkey"
      show-hotkey
      :selected="activeTool === tool.id"
      :data-testid="`sheet-tool-${tool.id}`"
      :data-tour="`tool-${tool.id}`"
      @click="pick(tool.id)"
    />
  </div>
</template>

<style scoped>
.tool-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, 56px);
  justify-content: space-between;
  grid-auto-rows: 72px;
  background-image: repeating-linear-gradient(to bottom, transparent 0 71px, var(--line-strong) 71px 72px);
}
</style>

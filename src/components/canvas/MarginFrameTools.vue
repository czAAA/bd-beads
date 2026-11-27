<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type { controlDeps } from '../../composables/shell/controlRegistry'
import type { FrameEdge } from '../../domain/frame'
import type { FrameSettings } from '../../domain/frameShape'
import type { FrameId } from '../../domain/grid'
import type { Project } from '../../domain/project'
import type { SeenWay } from '../../domain/rowProgress'
import type { Technique } from '../../domain/weave'
import { rotateFrameQuestion } from '../../domain/wovenLines'
import type { RowPress } from '../../composables/project/useRowOps'
import { useI18n } from '../../i18n/useI18n'
import MenuButton from '../ui/MenuButton.vue'
import FramePopover from './FramePopover.vue'
import type { FrameToolItem } from './framePopoverTools'

/** The margin sheet's **···** Frame settings button (MarginSheet card, Several Frames; ticket 1222): always on the sheet, in
 * the band's row or, where the sheet is bare, beside the Move bar (ticket 1164). It opens one popover with everything
 * about the Frame, wherever it stands. `asked` opens it from elsewhere (the Frame stays toast's Open Frame). */
const props = defineProps<{
  project: Project
  items: readonly FrameToolItem[]
  deps: ReturnType<typeof controlDeps>
  /** The Frame whose sheet this is (ticket 1220): the Export panel hangs from this button when it asked. */
  frame: FrameId
  asked?: boolean
  /** Where the popover was held when this button's predecessor on the sheet went: it opens there. */
  held?: Record<string, string>
  rowHighlight?: boolean
  rowPress?: RowPress
}>()
const emit = defineEmits<{
  step: [edge: FrameEdge, step: 1 | -1]
  resize: [columns: number, rows: number]
  'set-settings': [change: FrameSettings]
  'reset-progress': []
  settle: []
  /** `asked` was heard: the popover is open. */
  opened: []
  /** The popover is kept at this place through a turn, or is closed. */
  held: [place: Record<string, string> | undefined]
  rename: [name: string]
  'save-maker-name': [name: string]
  'set-technique': [technique: Technique]
  'set-setting': [id: string, value: number]
  'replace-bead': [beadId: string]
  'move-row': [delta: number]
  'set-row-direction': [way: SeenWay]
  'toggle-row-highlight': []
}>()

const { t } = useI18n()
const menu = ref<InstanceType<typeof MenuButton>>()
watch(
  () => props.asked,
  async (asked) => {
    if (!asked) return
    await nextTick()
    menu.value?.show()
    emit('opened')
  },
  { immediate: true },
)

onMounted(async () => {
  const place = props.held
  if (!place) return
  await menu.value?.show()
  menu.value?.hold(place)
})

/** A tile closes the popover, then does as the band's button does; Rotate Frame keeps it open where it is, unless the
 * turn asks about rows done first (ticket 1257). */
function onTool(item: FrameToolItem) {
  if (item.id === 'rotate' && !rotateFrameQuestion(props.project, props.frame)) emit('held', menu.value?.hold())
  else menu.value?.close()
  item.run()
}

/** The question comes up with the popover gone (StackingOrder card, ticket 1247). */
function onResetProgress() {
  menu.value?.close()
  emit('reset-progress')
}

/** So does Replace bead?, once the picker that asked has handed its focus back. */
async function onReplaceBead(beadId: string) {
  await nextTick()
  menu.value?.close()
  emit('replace-bead', beadId)
}
</script>

<template>
  <MenuButton
    ref="menu"
    variant="plain"
    class="margin-sheet__tool"
    icon="more"
    icon-only
    popover
    popover-width="min(var(--frame-popover-width), 100vw - 2 * var(--frame-panel-gap))"
    :label="t.frame.margin.frameTools"
    align="end"
    :data-frame="frame"
    data-testid="margin-frame-tools"
    @close="emit('held', undefined)"
  >
    <FramePopover
      :project="project"
      :frame="frame"
      :items="items"
      :deps="deps"
      :row-highlight="rowHighlight"
      :row-press="rowPress"
      @tool="onTool"
      @step="(edge, step) => emit('step', edge, step)"
      @resize="(columns, rows) => emit('resize', columns, rows)"
      @set-settings="emit('set-settings', $event)"
      @reset-progress="onResetProgress"
      @settle="emit('settle')"
      @rename="emit('rename', $event)"
      @save-maker-name="emit('save-maker-name', $event)"
      @set-technique="emit('set-technique', $event)"
      @set-setting="(id, value) => emit('set-setting', id, value)"
      @replace-bead="onReplaceBead"
      @move-row="emit('move-row', $event)"
      @set-row-direction="emit('set-row-direction', $event)"
      @toggle-row-highlight="emit('toggle-row-highlight')"
    />
  </MenuButton>
</template>

<style scoped>
/* The Frame popover's rows run nearly to its edge, as a menu's do (MarginSheet card, Calmer sheet). */
:deep(.menu-button__list.menu-button__list--popover) {
  padding: var(--space-4);
}
</style>

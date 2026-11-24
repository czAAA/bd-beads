<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import BeadQuantities from '../palette/BeadQuantities.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import FrameSizeSection from './FrameSizeSection.vue'
import type { FrameToolItem } from './framePopoverTools'
import { controlDeps } from '../../composables/shell/controlRegistry'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import type { FrameEdge } from '../../domain/frame'
import { seenSize } from '../../domain/frameOrientation'
import { settingValuesOf, type FrameSettings } from '../../domain/frameShape'
import type { FrameId } from '../../domain/grid'
import { frameById, framesOf, soloFrame } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { frameLabel } from '../../i18n/frameLabel'
import { plural } from '../../i18n/plural'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'

// The Frame settings popover (MarginSheet card, Several Frames; ticket 1222): what the ··· button opens, everything about
// one Frame top to bottom: its head, every band tool as a Menu item, its size and its Beads needed. The tools are second
// triggers of the band's own controls, so each keeps its name, check, confirmation and reason for being off.
const props = defineProps<{
  project: Project
  /** The Frame whose popover it is. */
  frame: FrameId
  items: readonly FrameToolItem[]
  deps: ReturnType<typeof controlDeps>
}>()
const emit = defineEmits<{
  step: [edge: FrameEdge, step: 1 | -1]
  resize: [columns: number, rows: number]
  'set-settings': [change: FrameSettings]
  'reset-progress': []
  /** The popover is gone: held steppers settle into their one Undo step (ticket 0640). */
  settle: []
}>()

const { t, locale } = useI18n()
const held = computed(() => frameById(props.project, props.frame))
const name = computed(() => (held.value ? frameLabel(t.value, held.value, framesOf(props.project).findIndex((each) => each.id === props.frame)) : ''))
/** Its Technique and size in the head: "Peyote · 11 × 100", a Custom frame's "Kite · 9 rows". */
const meta = computed(() => {
  const frame = held.value
  if (!frame) return ''
  const first = settingValuesOf(frame)[0]
  if (first && frame.shape) return `${t.value.frame.shapes[frame.shape]} · ${plural(locale.value, first.value, t.value.frame.sizeSettings[first.name].summary)}`
  const { columns, rows } = seenSize(frame)
  return `${techniqueName(t.value, frame.technique)} · ${columns} × ${rows}`
})
const beadsProject = computed(() => soloFrame(props.project, props.frame))

const toolsEl = ref<HTMLElement>()
const roving = useRovingFocus(toolsEl, { selector: '[role^="menuitem"]:not(:disabled)', axis: () => 'vertical', managesTabIndex: true })
const disabled = (item: FrameToolItem) => (item.action.enabled ? !item.action.enabled(props.deps) : false)
onBeforeUnmount(() => emit('settle'))
</script>

<template>
  <div class="frame-popover" data-testid="frame-popover" :data-frame="frame">
    <div class="frame-popover__head">
      <span class="frame-popover__name" data-user-text data-testid="frame-popover-name">{{ name }}</span>
      <span class="frame-popover__meta" data-testid="frame-popover-meta">{{ meta }}</span>
    </div>

    <div ref="toolsEl" class="frame-popover__tools" role="group" :aria-label="t.frame.margin.frameTools" @keydown="roving.onKeydown" @focusin="roving.onFocusin">
      <template v-for="item in items" :key="item.id">
        <hr v-if="item.id === 'remove'" class="frame-popover__rule" />
        <AppMenuItem
          :icon="item.action.icon"
          :disabled="disabled(item)"
          :name="item.action.name(t)"
          :disabled-body="disabled(item) ? item.action.disabledBody?.(t, deps) : undefined"
          :checked="item.checked"
          :class="{ 'frame-popover__danger': item.id === 'remove' }"
          :data-testid="`margin-frame-tools-${item.id}`"
          :data-rotate-from="item.id === 'rotate' ? 'menu' : undefined"
          @select="item.run()"
        >
          {{ item.action.name(t) }}
        </AppMenuItem>
      </template>
    </div>

    <div class="frame-popover__section">
      <span class="frame-popover__label">{{ t.frame.sizeHeading }}</span>
      <FrameSizeSection :project="project" :frame="frame" @step="(edge, step) => emit('step', edge, step)" @resize="(columns, rows) => emit('resize', columns, rows)" @set-settings="emit('set-settings', $event)" @reset-progress="emit('reset-progress')" />
    </div>

    <BeadQuantities :project="beadsProject" />
  </div>
</template>

<style scoped>
.frame-popover {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  min-width: 0;
  color: var(--ink);
}

.frame-popover__head {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.frame-popover__name {
  overflow: hidden;
  font: var(--margin-title-name);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.frame-popover__meta {
  font: var(--type-meta);
  color: var(--muted);
}

.frame-popover__tools {
  display: flex;
  flex-direction: column;
}

.frame-popover__rule {
  width: 100%;
  margin: var(--space-4) 0;
  border: 0;
  border-top: 1px solid var(--line-soft);
}

.frame-popover__tools :deep(.frame-popover__danger),
.frame-popover__tools :deep(.frame-popover__danger .app-icon) {
  color: var(--danger);
}

.frame-popover__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-8);
  border-top: 1px solid var(--line-soft);
}

.frame-popover__label {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}
</style>

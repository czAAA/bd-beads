<script setup lang="ts">
import { computed, inject } from 'vue'
import PanelItem from '../shell/PanelItem.vue'
import PanelSection from '../shell/PanelSection.vue'
import { PANEL_CONTEXT } from '../shell/panelContext'
import IconButton from '../ui/IconButton.vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { fitToDrawing } from '../../domain/frame'
import { framesFull } from '../../domain/frameLimit'
import { framesFullReason } from '../../i18n/framesFullReason'
import { seenSize } from '../../domain/frameOrientation'
import { settingValuesOf } from '../../domain/frameShape'
import type { FrameId } from '../../domain/grid'
import { frameIdOf, framesOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { frameLabel } from '../../i18n/frameLabel'
import { plural } from '../../i18n/plural'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'

// The Project panel's Frames (ProjectPanel card, ticket 1222): the ways to add a Frame and the Frames. "add a frame" is
// open with no Frame, folded once there is one; each Frame's section is open while it is the only one, folded at two or
// more: Show this Frame, Export this Frame… and Remove Frame…, as its sheet's own actions. Size and tools are on its ···.
const props = defineProps<{ project: Project }>()
const emit = defineEmits<{
  fit: []
  'select-frame': []
  'show-frame': [frame: FrameId]
  'export-frame': [frame: FrameId]
  'remove-frame': [frame: FrameId]
}>()

const { t, locale } = useI18n()
const context = inject(PANEL_CONTEXT, undefined)
const fromStarter = controlAction('add-frame-from-starter')
const fitAction = controlAction('fit-to-drawing')
const frames = computed(() => framesOf(props.project))
const full = computed(() => framesFull(props.project))
const fullReason = computed(() => framesFullReason(t.value, locale.value))
/** Fit a Frame to the drawing needs something drawn that no Frame covers. */
const nothingToFit = computed(() => fitToDrawing(props.project) === undefined)

/** A Frame's folded summary: its Technique and size, "Peyote · 11 × 100", or a Custom frame's "Kite · 9 rows". */
function summaryOf(frame: ReturnType<typeof framesOf>[number]): string {
  const first = settingValuesOf(frame)[0]
  if (first && frame.shape) return `${t.value.frame.shapes[frame.shape]} · ${plural(locale.value, first.value, t.value.frame.sizeSettings[first.name].summary)}`
  const { columns, rows } = seenSize(frame)
  return `${techniqueName(t.value, frame.technique)} · ${columns} × ${rows}`
}
</script>

<template>
  <div class="project-frames" data-testid="project-frames">
    <PanelSection id="project:frames-add" :label="t.frame.addFrameHeading" :folded="frames.length > 0" data-testid="project-frames-add">
      <p class="project-frames__line" data-testid="project-frames-line">{{ full ? fullReason : t.frame.noFrameLine }}</p>
      <PanelItem
        icon="frame"
        accent
        accent-icon
        sub
        stays
        :disabled="full"
        :name="t.frame.fromStarter"
        :disabled-body="fullReason"
        :body="fromStarter.body?.(t)"
        data-testid="frame-from-starter"
        @select="context?.openSub(t.starters.title, { opener: 'frame-from-starter' })"
      >{{ t.frame.fromStarter }}</PanelItem>
      <PanelItem
        icon="frame"
        stays
        :disabled="full || nothingToFit"
        :name="t.frame.fitAFrame"
        :disabled-body="full ? fullReason : t.frame.fitNothing"
        :body="fitAction.body?.(t)"
        data-testid="frame-fit"
        @select="emit('fit')"
      >{{ t.frame.fitAFrame }}</PanelItem>
      <PanelItem icon="select" :disabled="full" :name="t.frame.selectAFrame" :disabled-body="fullReason" :body="t.frame.selectFrameHint" data-testid="frame-select" @select="emit('select-frame')">{{ t.frame.selectAFrame }}</PanelItem>
    </PanelSection>

    <PanelSection
      v-for="(frame, at) in frames"
      :id="`project:frame:${frame.id}`"
      :key="frame.id"
      :label="frameLabel(t, frame, at)"
      :summary="summaryOf(frame)"
      :folded="frames.length >= 2"
      :data-frame="frame.id"
      data-testid="project-frame"
    >
      <template #info>
        <IconButton variant="plain" icon="fit" :icon-size="16" :label="t.frame.showFrame" data-testid="project-frame-show-button" @click="emit('show-frame', frameIdOf(frame))" />
      </template>
      <PanelItem icon="fit" stays data-testid="project-frame-show" @select="emit('show-frame', frameIdOf(frame))">{{ t.frame.showFrame }}</PanelItem>
      <PanelItem icon="export" data-testid="project-frame-export" @select="emit('export-frame', frameIdOf(frame))">{{ t.frame.exportThisFrame }}</PanelItem>
      <PanelItem icon="delete" danger data-testid="project-frame-remove" @select="emit('remove-frame', frameIdOf(frame))">{{ t.frame.removeThisFrame }}</PanelItem>
    </PanelSection>
  </div>
</template>

<style scoped>
.project-frames {
  display: flex;
  flex-direction: column;
}

.project-frames__line {
  margin: 0;
  padding: var(--space-4) var(--space-10);
  font: var(--type-meta-small);
  color: var(--muted);
}

.project-frames > :deep(.panel-section:first-of-type) {
  margin-top: var(--space-4);
}
</style>

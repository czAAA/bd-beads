<script setup lang="ts">
import { computed } from 'vue'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import ZoomControls from './ZoomControls.vue'

/**
 * The canvas box's header strip (ticket 143; CanvasStrip card): what is on the board and how far it is zoomed. The
 * size is the Pattern's (or, while framing a picture, the Pattern it will make); with nothing to show it holds just
 * the title.
 */
const props = defineProps<{
  size?: { columns: number; rows: number }
  zoomPercent?: number
  /** Shown while the Pattern has keyboard focus: "arrows move · space paints · esc leaves" (BeadCursor card). */
  hint?: string
  /** What is on the board, when it isn't the Pattern: the framing step names itself here (ConvertImage card). */
  title?: string
}>()
const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  reset: []
}>()

const { t, locale } = useI18n()

const sizeMeta = computed(() =>
  props.size
    ? `${plural(locale.value, props.size.columns, t.value.canvas.columnsCount)} · ${plural(locale.value, props.size.rows, t.value.canvas.rowsCount)}`
    : undefined,
)
</script>

<template>
  <div class="canvas-strip" data-testid="canvas-strip">
    <AppIcon name="grid" :size="16" />
    <span class="canvas-strip__title" data-testid="canvas-strip-title">{{ title ?? t.canvas.stripTitle }}</span>
    <span v-if="sizeMeta" class="canvas-strip__meta" data-testid="canvas-strip-size">{{ sizeMeta }}</span>
    <span v-if="hint" class="canvas-strip__hint" data-testid="canvas-strip-hint">{{ hint }}</span>
    <ZoomControls
      v-if="zoomPercent !== undefined"
      class="canvas-strip__zoom"
      :zoom-percent="zoomPercent"
      @zoom-in="emit('zoom-in')"
      @zoom-out="emit('zoom-out')"
      @reset="emit('reset')"
    />
  </div>
</template>

<style scoped>
.canvas-strip {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-12);
  box-sizing: border-box;
  height: var(--strip-height);
  padding: 0 var(--space-10) 0 var(--space-16);
  color: var(--ink);
  border-bottom: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
}

.canvas-strip__title {
  font: var(--type-control);
}

.canvas-strip__meta {
  font: var(--type-meta);
  color: var(--box-muted);
  text-transform: lowercase;
  white-space: nowrap;
}

.canvas-strip__hint {
  margin-left: auto;
  font: var(--type-meta-small);
  color: var(--box-muted);
  text-transform: lowercase;
  white-space: nowrap;
}

.canvas-strip__hint + .canvas-strip__zoom {
  margin-left: 0;
}

.canvas-strip__zoom {
  margin-left: auto;
}
</style>

<script setup lang="ts">
import type { ScreenBox } from '../../composables/canvas/pictureBarPlacement'
import AppIcon from '../ui/AppIcon.vue'

// What the picture bar's two actions show before they act (ReferenceImage card, ticket 0883), in screen px over the
// drawing: Set Frame around the picture's new Frame on hover (its line, the margin sheet's outline and a tag), and Convert
// to beads' preview line round the beads it will make, with its "preview" pill. Neither takes a press.
defineProps<{
  frame?: { line: ScreenBox; sheet: ScreenBox; tag: string }
  convert?: { box: ScreenBox; label: string }
}>()

const boxStyle = ({ left, top, width, height }: ScreenBox) => ({ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` })
</script>

<template>
  <div class="reference-previews" aria-hidden="true">
    <template v-if="frame">
      <div class="reference-previews__sheet" :style="boxStyle(frame.sheet)" data-testid="frame-around-preview">
        <span class="reference-previews__tag"><AppIcon name="frame" :size="12" />{{ frame.tag }}</span>
      </div>
      <div class="reference-previews__line" :style="boxStyle(frame.line)" />
    </template>
    <div v-if="convert" class="reference-previews__convert" :style="boxStyle(convert.box)" data-testid="convert-to-beads-preview">
      <span class="reference-previews__pill">{{ convert.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.reference-previews {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.reference-previews__sheet,
.reference-previews__line,
.reference-previews__convert {
  position: absolute;
  box-sizing: border-box;
}

/* The new Frame in `accent-strong`: its 2px line on 6px corners, the sheet's dashed outline over a 7% `accent` tint. */
.reference-previews__sheet {
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border: var(--reference-outline) dashed var(--accent-strong);
  border-radius: var(--radius-sm);
}

.reference-previews__line {
  border: var(--frame-preview-line) solid var(--accent-strong);
  border-radius: var(--radius-sm);
}

.reference-previews__tag {
  position: absolute;
  top: var(--space-6);
  left: var(--space-6);
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-8);
  font: var(--type-meta-small);
  color: var(--accent-strong);
  white-space: nowrap;
  background: var(--canvas);
  border-radius: var(--radius-full);
}

/* Convert to beads' preview: a 1.5px dashed `ink` line on 6px corners, the pill inside its bottom-left corner. */
.reference-previews__convert {
  border: var(--reference-outline) dashed var(--ink);
  border-radius: var(--radius-sm);
}

.reference-previews__pill {
  position: absolute;
  bottom: var(--space-6);
  left: var(--space-6);
  padding: var(--space-2) var(--space-8);
  font: var(--type-meta-small);
  color: var(--muted);
  white-space: nowrap;
  background: var(--canvas);
  border-radius: var(--radius-full);
}
</style>

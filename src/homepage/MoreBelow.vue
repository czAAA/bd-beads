<script setup lang="ts">
import AppButton from '../components/ui/AppButton.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { useI18n } from '../i18n/useI18n'

// More below (ticket 0826; Homepage card): a pill saying a section has more, at the foot of the drawing area, so it
// rides on the top edge of whatever bar sits under it and takes no room of its own. It only says it was pressed.
defineProps<{
  /** The section shown scrolls further: a fade of the canvas runs above the bar. */
  fade: boolean
}>()
const emit = defineEmits<{ more: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="more-below" :class="{ 'more-below--fade': fade }" data-testid="more-below">
    <AppButton class="more-below__pill" variant="in-box" size="sm" data-testid="more-below-button" @click="emit('more')">
      {{ t.homepage.sections.moreBelow }}
      <AppIcon class="more-below__arrow" name="arrow-down" :size="14" />
    </AppButton>
  </div>
</template>

<style scoped>
.more-below {
  position: absolute;
  z-index: var(--z-canvas-overlay);
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: var(--more-below-fade);
  pointer-events: none;
}

.more-below--fade {
  background: linear-gradient(
    to bottom,
    transparent,
    color-mix(in srgb, var(--canvas-bg, var(--canvas)) var(--more-below-fade-to), transparent)
  );
}

.more-below .more-below__pill {
  gap: var(--space-6);
  height: var(--control-height-small);
  padding: 0 var(--space-12) 0 var(--space-10);
  font: var(--type-meta-small);
  border-color: var(--line-strong);
  border-radius: var(--radius-full);
  box-shadow: var(--more-below-shadow);
  /* Its own property, so a press's scale leaves it where it rides. */
  translate: 0 var(--more-below-overhang);
  pointer-events: auto;
}

.more-below__arrow {
  color: var(--accent);
}
</style>

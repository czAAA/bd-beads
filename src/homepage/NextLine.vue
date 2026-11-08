<script setup lang="ts">
import AppIcon from '../components/ui/AppIcon.vue'
import { useI18n } from '../i18n/useI18n'

// The way on at a section's end on a phone (ticket 0827; Homepage card): "Next · {section}" and an arrow down, saying
// what the phone bar's ↓ turns to. Nothing to press: ↓ is the press.
defineProps<{
  /** The next section's heading. */
  section: string
}>()
const { t } = useI18n()
</script>

<template>
  <p class="next-line" data-testid="homepage-next-line">
    <span>{{ t.homepage.sections.next }} · <span class="next-line__name">{{ section }}</span></span>
    <AppIcon class="next-line__arrow" name="arrow-down" :size="14" />
  </p>
</template>

<style scoped>
.next-line {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  margin: var(--space-20) 0 var(--space-4);
  font: var(--type-meta-small);
  color: var(--muted);
  text-align: center;
}

.next-line__name {
  color: var(--ink);
}

.next-line__arrow {
  flex: none;
  color: var(--accent);
}
</style>

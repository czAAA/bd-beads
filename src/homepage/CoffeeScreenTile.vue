<script setup lang="ts">
import AppIcon from '../components/ui/AppIcon.vue'
import type { IconName } from '../components/ui/icons'

/** One tile under the coffee screen's band (ticket 0823; Homepage card): an icon before its name, its words, then what
 * it lets a beader do. Open source and Say hello are two; any further tile is one more of these in the row. */
defineProps<{
  icon: IconName
  name: string
}>()
</script>

<template>
  <article class="coffee-tile">
    <h3 class="coffee-tile__name">
      <AppIcon class="coffee-tile__icon" :name="icon" :size="18" />
      {{ name }}
    </h3>
    <slot />
    <div v-if="$slots.foot" class="coffee-tile__foot">
      <slot name="foot" />
    </div>
  </article>
</template>

<style scoped>
.coffee-tile {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  box-sizing: border-box;
  min-width: 0;
  padding: var(--space-16) 1.125rem;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-lg);
}

.coffee-tile__name {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin: 0;
  font: var(--type-inside-name);
  color: var(--ink);
}

.coffee-tile__icon {
  flex: none;
  color: var(--accent-strong);
}

/* The tile's words, from the slot. */
.coffee-tile :slotted(p) {
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}

.coffee-tile__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-12);
}
</style>

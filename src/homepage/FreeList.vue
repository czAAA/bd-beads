<script setup lang="ts">
import AppIcon from '../components/ui/AppIcon.vue'

// The free list (tickets 0739, 0742; Homepage card): everything the app does without an account, a check before each,
// then "More on the way", muted, with a plus. Whole in the DOM at every height of its tile, so every row is read out.
defineProps<{ rows: readonly string[]; more: string; labelledBy: string }>()
</script>

<template>
  <ul class="free-list" :aria-labelledby="labelledBy">
    <li v-for="row in rows" :key="row" class="free-list__item">
      <AppIcon name="check" :size="14" class="free-list__mark" />{{ row }}
    </li>
    <li class="free-list__item free-list__item--more" data-testid="free-more"><AppIcon name="plus" :size="14" class="free-list__mark" />{{ more }}</li>
  </ul>
</template>

<style scoped>
.free-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
}

.free-list__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-8);
  font: var(--type-body);
  color: var(--body);
}

.free-list__mark {
  flex: none;
  margin-top: 0.1875rem;
  color: var(--accent-strong);
}

.free-list__item--more,
.free-list__item--more .free-list__mark {
  color: var(--muted);
}
</style>

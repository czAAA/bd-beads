<script setup lang="ts">
import AppIcon from '../components/ui/AppIcon.vue'

// The free list (ticket 0739; Homepage card): everything the app does without an account, a check before each. The same
// list fills the No account tile's window and the roll it unrolls into, so the two line up row for row.
defineProps<{ items: readonly string[] }>()
</script>

<template>
  <ul class="free-list">
    <li v-for="item in items" :key="item" class="free-list__item">
      <AppIcon name="check" :size="14" class="free-list__check" />{{ item }}
    </li>
  </ul>
</template>

<style scoped>
.free-list {
  margin: 0;
  padding: 0 0 var(--space-8);
  list-style: none;
}

.free-list__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-8);
  font: var(--type-body);
  color: var(--body);
}

.free-list__item + .free-list__item {
  margin-top: var(--space-4);
}

.free-list__check {
  flex: none;
  margin-top: 0.1875rem;
  color: var(--accent-strong);
}
</style>

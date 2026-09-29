<script setup lang="ts">
/**
 * The Bead pill (BeadPill card): a read-only pill naming the open Pattern's Bead, in the header and at the top of the
 * phone's Pattern sheet. The class name stays `app-header__pill` because styles/contrast.css targets it by that name.
 */
</script>

<template>
  <span class="app-header__pill"><slot /></span>
</template>

<style scoped>
.app-header__pill {
  flex: none;
  padding: var(--space-4) var(--space-12);
  font: var(--type-pill);
  color: var(--ink);
  white-space: nowrap;
  background: var(--pill);
  border-radius: var(--radius-full);
}
</style>

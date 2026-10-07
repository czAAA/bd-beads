<script setup lang="ts">
/**
 * The design system's Note (ticket 328; Note card): a thin block of helper text on a gray surface, always visible, with
 * no icon and no button to open it. It replaces the (i) popups: the text is just there, under what it explains.
 */
</script>

<template>
  <p class="app-note"><slot /></p>
</template>

<style scoped>
.app-note {
  box-sizing: border-box;
  margin: 0;
  padding: var(--space-8) var(--space-10);
  font: var(--type-meta);
  color: var(--muted);
  background: var(--surface);
  border: 0;
  border-radius: var(--radius-sm);
  overflow-wrap: anywhere;
}
</style>

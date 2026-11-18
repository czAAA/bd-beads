<script setup lang="ts">
import type { UpdateSummary } from '../../domain/waitingBuild'
import KindLabel from './KindLabel.vue'

/** "Update ready"'s words (ticket 1048, spec 1043; Message card): its name and the waiting Version in the mono face,
 * then the one waiting note's kind label and line, or a kind label and count per kind. Unknown, the name alone. */
defineProps<{
  name: string
  update: UpdateSummary
}>()
</script>

<template>
  <span class="toast-update__head">
    <span class="toast-update__name">{{ name }}</span>
    <span v-if="update.version" class="toast-update__version" data-testid="update-version">{{ update.version }}</span>
  </span>
  <span v-if="update.note" class="toast-update__note" data-testid="update-note">
    <KindLabel class="toast-update__kind" :kind="update.note.kind" />{{ update.note.line }}
  </span>
  <span v-if="update.counts" class="toast-update__counts" data-testid="update-counts">
    <span v-for="entry in update.counts" :key="entry.kind" class="toast-update__count" data-testid="update-count">
      <KindLabel :kind="entry.kind" />{{ entry.count }}
    </span>
  </span>
</template>

<style scoped>
/* The name in `control`, the Version beside it in `meta`, `muted`; the Version wraps under a long name. */
.toast-update__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--space-8);
}

.toast-update__name {
  font: var(--type-control);
}

.toast-update__version {
  font: var(--type-meta);
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

/* One note: its kind label, then its line in `body`, wrapping under the label. */
.toast-update__note {
  display: block;
  margin-top: var(--space-4);
  color: var(--body);
}

.toast-update__kind {
  margin-right: var(--space-6);
}

/* Several: a kind label and its count per kind, New, Changed, Fixed. */
.toast-update__counts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6) var(--space-14);
  margin-top: var(--space-6);
}

.toast-update__count {
  display: inline-flex;
  align-items: center;
  gap: var(--space-6);
  font: var(--type-control);
  font-variant-numeric: tabular-nums;
}
</style>

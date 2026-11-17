<script setup lang="ts">
import type { ReleaseNoteKind } from '../../domain/notesFile'
import { useI18n } from '../../i18n/useI18n'

/** A Release note's kind, New, Changed or Fixed (ticket 1047, spec 1043; KindLabel card): drawn as the Demo tag, the
 * small meta text in the kind's color on that color at 12%. One component for What's new and "Update ready". */
defineProps<{ kind: ReleaseNoteKind }>()
const { t } = useI18n()
</script>

<template>
  <span class="kind-label" :class="`kind-label--${kind}`" data-testid="kind-label" :data-kind="kind">{{ t.releaseNoteKinds[kind] }}</span>
</template>

<style scoped>
/* `meta-small` in the kind's color on that color at `--kind-label-tint`, `radius-full`, padding 2 8, never cut; high
   contrast draws a 1px edge in the kind's color in place of the fill. */
.kind-label {
  display: inline-block;
  box-sizing: border-box;
  padding: var(--space-2) var(--space-8);
  font: var(--type-meta-small);
  text-transform: lowercase;
  white-space: nowrap;
  color: var(--kind);
  background: color-mix(in srgb, var(--kind) var(--kind-label-tint), transparent);
  border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 var(--kind-label-edge) var(--kind);
}

.kind-label--new {
  --kind: var(--kind-new);
}

.kind-label--changed {
  --kind: var(--kind-changed);
}

.kind-label--fixed {
  --kind: var(--kind-fixed);
}
</style>

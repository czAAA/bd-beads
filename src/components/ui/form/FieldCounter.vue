<script setup lang="ts">
import { computed } from 'vue'

/** How close to its limit a name gets before its counter shows (ticket 0854, TextField card). */
const SHOWN_WITHIN = 10

/** A name field's "n/40" (ticket 0854, TextField card): shown only once the text nears its limit, in `danger` past it
 * (a longer name that came in with a file), so every name field states its one limit the same way. */
const props = defineProps<{ length: number; max: number }>()
const shown = computed(() => props.length >= props.max - SHOWN_WITHIN)
</script>

<template>
  <span v-if="shown" class="field-counter" :class="{ 'field-counter--over': length > max }" data-testid="field-counter">{{ length }}/{{ max }}</span>
</template>

<style scoped>
.field-counter {
  font: var(--type-meta);
  color: var(--muted);
}

.field-counter--over {
  color: var(--danger);
}
</style>

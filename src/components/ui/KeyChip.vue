<script setup lang="ts">
import { useKeyHints } from '../../composables/ui/useKeyHints'

/** The one place a hotkey chip is drawn (ticket 438): hidden unless a keyboard is likely or the shortcuts switch
 * says so; `always` is for the help that lists keys. `drawn` draws the key, not as text: on a named control (a Tool
 * tile) it is a hint, no part of the name (ticket 0856, ScreenReaders card). */
withDefaults(defineProps<{ always?: boolean; drawn?: string }>(), { always: false, drawn: undefined })

const { shown } = useKeyHints()
</script>

<template>
  <kbd v-if="always || shown" :data-key="drawn"><slot v-if="drawn === undefined" /></kbd>
</template>

<style scoped>
kbd[data-key]::before {
  content: attr(data-key);
  /* The same key with no text for assistive technology, where the alternative-text form is known. */
  content: attr(data-key) / '';
}
</style>

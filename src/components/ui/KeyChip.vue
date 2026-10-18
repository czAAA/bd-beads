<script setup lang="ts">
import { useKeyHints } from '../../composables/ui/useKeyHints'

/** The one place a hotkey chip is drawn (ticket 438): hidden unless a keyboard is likely or the shortcuts switch
 * says so; `always` is for the help that lists keys. */
withDefaults(defineProps<{ always?: boolean }>(), { always: false })

const { shown } = useKeyHints()
</script>

<template>
  <kbd v-if="always || shown"><slot /></kbd>
</template>

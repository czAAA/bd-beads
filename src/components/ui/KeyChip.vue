<script setup lang="ts">
import { useKeyHints } from '../../composables/ui/useKeyHints'

/**
 * The one place a hotkey chip is drawn (ticket 438): it shows only where a keyboard is likely, or as the Keyboard
 * shortcuts switch says, so a control that prints its key through this inherits that with no check of its own.
 * `always` is for the help that lists the keys: there they are the content, never hidden. The caller's class styles it.
 */
withDefaults(defineProps<{ always?: boolean }>(), { always: false })

const { shown } = useKeyHints()
</script>

<template>
  <kbd v-if="always || shown"><slot /></kbd>
</template>

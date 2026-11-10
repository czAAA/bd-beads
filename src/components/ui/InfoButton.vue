<script setup lang="ts">
import IconButton from './IconButton.vue'

// The info button (Button card, ticket 0651): a plain 16px `info` icon beside a label whose Tooltip holds the help the
// label would otherwise carry as a line under it. Its accessible name says what it explains ("What Letters does"). A tap
// opens the help above it, clear of the control it explains, until the next tap anywhere (ticket 0844).
defineProps<{
  label: string
  body: string
}>()
</script>

<template>
  <IconButton variant="plain" icon="info" :icon-size="16" :label="label" :tooltip="{ body, placement: 'top', opensOnClick: true }" />
</template>

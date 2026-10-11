<script setup lang="ts">
import type { Component } from 'vue'
import type { Translations } from '../../i18n/translations'
import BeadsExample from './BeadsExample.vue'
import ConvertExample from './ConvertExample.vue'
import EditingExample from './EditingExample.vue'
import ExportsExample from './ExportsExample.vue'
import ProgressExample from './ProgressExample.vue'
import SavedExample from './SavedExample.vue'
import TechniquesExample from './TechniquesExample.vue'

/** The example the carousel's stage shows for a feature (ticket 218; Overview card). */
defineProps<{ feature: keyof Translations['overview']['features'] }>()

const EXAMPLES: Record<keyof Translations['overview']['features'], Component> = {
  techniques: TechniquesExample,
  projectEditing: EditingExample,
  convertImage: ConvertExample,
  rowProgress: ProgressExample,
  beadsNeeded: BeadsExample,
  exports: ExportsExample,
  savedProjects: SavedExample,
}
</script>

<template>
  <component :is="EXAMPLES[feature]" />
</template>

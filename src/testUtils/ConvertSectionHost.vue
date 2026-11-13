<script setup lang="ts">
import type { Component } from 'vue'
import { provideConvertImageWizard, useConvertImageWizard } from '../composables/import/useConvertImageWizard'
import type { ColorCatalog } from '../domain/colorCatalog'
import type { CreateProjectInput } from '../domain/createProject'
import type { DecodeImage } from '../domain/imageConversion'

// One popover's body of Convert image (ticket 0896) under a wizard with a picture set, for a browser fit test that tries
// its text and Tooltips on its own: on the page, a long press on a trigger outside an open popover closes it first.
const props = defineProps<{
  body: Component
  start: { draft: CreateProjectInput; file: File }
  decodeImage: DecodeImage
  loadCatalog: (id: string) => Promise<ColorCatalog | undefined>
  /** Background's body is shown with its tool on, as the bar's button opens it. */
  background?: boolean
}>()

const wizard = useConvertImageWizard({ start: props.start.draft, decodeImage: props.decodeImage, loadCatalog: props.loadCatalog as (id: string) => Promise<ColorCatalog> })
provideConvertImageWizard(wizard)
void wizard.setFile(props.start.file).then(() => props.background && wizard.togglePopover('background'))
</script>

<template>
  <div class="convert-section-host">
    <component :is="body" v-if="wizard.hasPicture.value" />
    <p v-else>…</p>
  </div>
</template>

<style scoped>
.convert-section-host {
  display: flex;
  flex-direction: column;
  /* As the popover stands in the column under 1024 px: its body edge to edge, its own padding inside. */
  background: var(--elevated);
}
</style>

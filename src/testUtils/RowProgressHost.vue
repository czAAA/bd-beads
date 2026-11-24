<script setup lang="ts">
import { computed, ref } from 'vue'
import RowProgressControls from '../components/canvas/RowProgressControls.vue'
import { STRIP_FITS, STRIP_FIT_PROPS, stripWidth } from '../components/canvas/rowProgressFit'
import { useFittingForm } from '../composables/canvas/useFittingForm'
import { useElementSize } from '../composables/ui/useElementSize'
import { firstFrameId } from '../domain/layerRecord'
import type { Project } from '../domain/project'
import { useI18n } from '../i18n/useI18n'

// A Row progress strip as the sheet and the Homepage cuff lay it, stepping down its forms to the width it is given: what
// a text fit test mounts, since the strip alone leaves the fitting to its parent.
defineProps<{ project: Project }>()
const { locale } = useI18n()
const el = ref<HTMLElement>()
const { width } = useElementSize(el)
const fit = useFittingForm({
  forms: () => STRIP_FITS,
  room: () => width.value || el.value?.clientWidth || 0,
  measure: () => stripWidth(el.value?.firstElementChild as HTMLElement | null | undefined),
  observed: () => [el.value?.firstElementChild],
  labels: () => locale.value,
})
const fitProps = computed(() => STRIP_FIT_PROPS[fit.value ?? STRIP_FITS.at(-1)!])
</script>

<template>
  <div ref="el" style="display: flex; width: 100%">
    <RowProgressControls :project="project" :frame="firstFrameId(project)" v-bind="fitProps" testid="strip" />
  </div>
</template>

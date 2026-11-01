<script setup lang="ts">
import ConvertImageWizard from '../components/import/ConvertImageWizard.vue'
import ConvertStepBar from '../components/import/ConvertStepBar.vue'
import { useConvertImageWizard } from '../composables/import/useConvertImageWizard'
import type { ColorCatalog } from '../domain/colorCatalog'
import type { CreateProjectInput } from '../domain/createProject'
import type { CutOutDevice, CutOutService } from '../domain/cutOutModel'
import type { DecodeImage } from '../domain/imageConversion'
import { unusedCutOutService } from './fakeCutOutService'
import { fakeCutOutDevice } from './fakeCutOutDevice'

// Convert image as the canvas box shows it (ticket 0756): the page over its Progress bar, in a box as tall as the screen,
// for a browser test that mounts it on its own. The wizard is made here as the flow's session makes it.
const props = defineProps<{
  start: { draft: CreateProjectInput; file?: File }
  decodeImage: DecodeImage
  loadCatalog: (id: string) => Promise<ColorCatalog | undefined>
  readClipboardImage: () => Promise<File | undefined>
  /** The cut-out service; by default one that no test here reaches. */
  cutOutService?: CutOutService
  /** The device record beside it; by default one that knows nothing and warns of nothing. */
  cutOutDevice?: CutOutDevice
}>()

const wizard = useConvertImageWizard({
  start: props.start.draft, decodeImage: props.decodeImage, loadCatalog: props.loadCatalog as (id: string) => Promise<ColorCatalog>,
  cutOutService: props.cutOutService ?? unusedCutOutService,
  cutOutDevice: props.cutOutDevice ?? fakeCutOutDevice().device,
})
if (props.start.file) void wizard.setFile(props.start.file)
</script>

<template>
  <div class="convert-page-host">
    <ConvertImageWizard :wizard="wizard" :read-clipboard-image="readClipboardImage" />
    <ConvertStepBar :wizard="wizard" />
  </div>
</template>

<style scoped>
.convert-page-host {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  height: 100dvh;
  background: var(--box);
}
</style>

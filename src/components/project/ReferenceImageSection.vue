<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { formatImageLimits, imageInputAccept, type ImageRejection } from '../../domain/imageConversion'
import { OPACITY_STEPS, type OpacityStep, type ReferenceImage } from '../../domain/referenceImage'
import { REFERENCE_SECTION_ID } from '../../composables/project/useReferenceImageFlow'
import { useI18n } from '../../i18n/useI18n'
import PanelItem from '../shell/PanelItem.vue'
import PanelListRow from '../shell/PanelListRow.vue'
import PanelSection from '../shell/PanelSection.vue'
import InfoButton from '../ui/InfoButton.vue'
import LoadingState from '../ui/LoadingState.vue'
import FileButton from '../ui/form/FileButton.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'

// The Project panel's reference image section (ReferenceImage card, ticket 0790): Add reference image with none; with
// a picture its row, Opacity in four steps, Adjust on canvas, Replace image and Remove image. Show and hide is the strip
// button's alone. A refused file says why under the first row; the row shows a spinner while a picture is made ready.
const props = defineProps<{
  image?: ReferenceImage
  /** The kept picture's address, for the thumbnail. */
  thumbnail?: string
  preparing?: boolean
  refusal?: ImageRejection
}>()
const emit = defineEmits<{
  /** A file picked by Add reference image or Replace image. */
  pick: [file: File]
  'set-opacity': [opacity: OpacityStep]
  adjust: []
  remove: []
}>()

const { t } = useI18n()
const words = computed(() => t.value.referenceImage)
const accept = imageInputAccept()
const opacityId = useId()
const pickerEl = ref<HTMLElement>()

const summary = computed(() =>
  props.image ? fillBlanks(words.value.summary, { opacity: props.image.opacity, state: props.image.shown ? words.value.shown : words.value.hidden }) : undefined,
)
const info = computed(() => formatImageLimits(words.value.info))
const facts = computed(() => {
  const picture = props.image?.picture
  if (!picture) return ''
  const size = fillBlanks(words.value.kilobytes, { count: Math.max(1, Math.round(picture.bytes / 1024)) })
  return fillBlanks(words.value.facts, { width: picture.width, height: picture.height, size })
})
const refused = computed(() => (props.refusal ? fillBlanks(words.value.refused, { reason: formatImageLimits(words.value.reasons[props.refusal]) }) : undefined))
// A refusal is scrolled into view, so one told after a pick from the strip button is seen in the panel it opened.
const refusedEl = ref<HTMLElement>()
watch(refusedEl, (line) => line?.scrollIntoView?.({ block: 'nearest' }), { flush: 'post' })
const opacityOptions = computed(() => OPACITY_STEPS.map((step) => ({ value: String(step) as `${OpacityStep}`, label: fillBlanks(words.value.percent, { count: step }) })))

/** Add reference image and Replace image open the picker of the file input kept in the section. */
const choose = () => pickerEl.value?.querySelector<HTMLInputElement>('input[type="file"]')?.click()

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('pick', file)
  // Picking the same file again still counts as a change.
  input.value = ''
}
</script>

<template>
  <PanelSection :id="REFERENCE_SECTION_ID" :label="words.section" :summary="summary">
    <template #info>
      <InfoButton :label="words.name" :body="info" data-testid="reference-image-info" />
    </template>
    <div v-if="preparing" class="reference-section__preparing" data-testid="reference-image-preparing">
      <LoadingState compact :text="words.preparing" />
    </div>
    <PanelItem v-else-if="!image" icon="image" stays data-testid="reference-image-add" @select="choose">{{ words.add }}</PanelItem>
    <PanelListRow v-else still :name="image.picture.name" :sub="facts" data-testid="reference-image-row">
      <template #thumb>
        <span class="reference-section__thumb">
          <img v-if="thumbnail" :src="thumbnail" alt="" />
        </span>
      </template>
    </PanelListRow>
    <p v-if="refused" ref="refusedEl" class="reference-section__refused" role="alert" data-testid="reference-image-refused">{{ refused }}</p>
    <template v-if="image">
      <div class="reference-section__opacity">
        <span :id="opacityId" class="reference-section__opacity-label">{{ words.opacity }}</span>
        <SegmentedControl
          :model-value="String(image.opacity) as `${OpacityStep}`"
          :options="opacityOptions"
          :labelledby="opacityId"
          small
          mono
          data-testid="reference-image-opacity"
          @update:model-value="emit('set-opacity', Number($event) as OpacityStep)"
        />
      </div>
      <PanelItem icon="size" :value="words.adjustValue" data-testid="reference-image-adjust" @select="emit('adjust')">{{ words.adjust }}</PanelItem>
      <PanelItem icon="image" stays data-testid="reference-image-replace" @select="choose">{{ words.replace }}</PanelItem>
      <PanelItem icon="delete" danger data-testid="reference-image-remove" @select="emit('remove')">{{ words.remove }}</PanelItem>
    </template>
    <span ref="pickerEl" hidden>
      <FileButton :label="words.add" :accept="accept" tabindex="-1" data-testid="reference-image-input" @change="onFile" />
    </span>
  </PanelSection>
</template>

<style scoped>
.reference-section__preparing {
  display: flex;
  align-items: center;
  min-height: var(--panel-row-two-line);
  padding: 0 var(--space-10);
}

.reference-section__thumb {
  display: block;
  width: var(--panel-thumbnail-size);
  height: var(--panel-thumbnail-size);
  overflow: hidden;
  background: var(--board);
  border-radius: var(--radius-sm);
}

.reference-section__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reference-section__refused {
  margin: 0;
  padding: var(--space-4) var(--space-10);
  font: var(--type-small);
  color: var(--danger);
}

.reference-section__opacity {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
  padding: 0 var(--space-10);
}

.reference-section__opacity-label {
  font: var(--type-body);
  color: var(--ink);
}
</style>

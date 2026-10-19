<script setup lang="ts">
import { computed } from 'vue'
import { BEAD_SHAPES, type BeadShape } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import SegmentedControl from '../ui/form/SegmentedControl.vue'

// The Bead shape choice (ADR 0068, ticket 508), Symmetric or Real, in the New Project form and the Project panel. It
// only changes how the Canvas is drawn, which its hover text says. The caller supplies the label.
defineProps<{ labelledby: string; small?: boolean; testid: string }>()
const shape = defineModel<BeadShape>({ required: true })

const { t } = useI18n()

const options = computed(() =>
  BEAD_SHAPES.map((value) => {
    const name = value === 'real' ? t.value.form.beadShapeReal : t.value.form.beadShapeSymmetric
    return { value, label: name, tooltip: { name, body: value === 'real' ? t.value.form.beadShapeRealTip : t.value.form.beadShapeSymmetricTip } }
  }),
)
</script>

<template>
  <SegmentedControl v-model="shape" :options="options" :small="small" :labelledby="labelledby" :data-testid="testid" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import type { FrameId } from '../../domain/grid'
import { frameById } from '../../domain/layerRecord'
import { MAX_MAKER_NAME } from '../../domain/makerName'
import { MAX_PIECE_NAME } from '../../domain/pieceNames'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import PanelSection from '../shell/PanelSection.vue'
import FramePopoverNameField from './FramePopoverNameField.vue'

// The Frame popover's Names (MarginSheet card, Calmer sheet; ticket 1257): the Frame's name and the maker's name, the
// title block's two lines as open fields; folded, both on the row.
const props = defineProps<{ project: Project; frame: FrameId }>()
const emit = defineEmits<{ rename: [name: string]; 'save-maker-name': [name: string] }>()

const { t } = useI18n()
const name = computed(() => frameById(props.project, props.frame)?.name ?? '')
const maker = computed(() => props.project.makerName ?? '')
const summary = computed(() => [name.value, maker.value && fillBlanks(t.value.print.byMaker, { maker: maker.value })].filter(Boolean).join(' · '))
</script>

<template>
  <PanelSection id="frame-popover:names" :label="t.frame.margin.names" folded data-testid="frame-popover-names">
    <!-- The one summary cut short: both names are the maker's own words. -->
    <template v-if="summary" #summary><span class="frame-popover__names-summary" data-user-text>{{ summary }}</span></template>
    <div class="frame-popover__body">
      <FramePopoverNameField :label="t.fields.frameName" :value="name" :maxlength="MAX_PIECE_NAME" :placeholder="t.frame.nameEmpty" testid="frame-popover-frame-name" @save="emit('rename', $event)" />
      <FramePopoverNameField :label="t.form.makerNameLabel" :value="maker" :maxlength="MAX_MAKER_NAME" :placeholder="t.saveBox.yourName" testid="frame-popover-maker-name" @save="emit('save-maker-name', $event)" />
    </div>
  </PanelSection>
</template>

<style scoped>
.frame-popover__names-summary {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

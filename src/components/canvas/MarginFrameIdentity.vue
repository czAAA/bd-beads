<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFittingForm } from '../../composables/canvas/useFittingForm'
import { useFrameSettings } from '../../composables/canvas/useFrameSettings'
import { useTitleBlockFold } from '../../composables/canvas/useTitleBlockFold'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { fillBlanks } from '../../domain/fillBlanks'
import type { FrameId } from '../../domain/grid'
import { frameById } from '../../domain/layerRecord'
import { MAX_MAKER_NAME } from '../../domain/makerName'
import type { Project } from '../../domain/project'
import { TECHNIQUES, type Technique } from '../../domain/weave'
import { weaveSettingWords } from '../../i18n/settingWords'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import { MARGIN_PX } from '../../rendering/marginSizes'
import EditableLine from '../project/EditableLine.vue'
import PanelPicker from '../shell/PanelPicker.vue'
import IconButton from '../ui/IconButton.vue'
import MarginSettingCell from './MarginSettingCell.vue'
import { frameNameLine } from './marginFrameName'
import type { IdentityForm } from './marginForms'
import { rowWidth } from './rowFit'

// Who the Frame is, in the margin sheet's top band after Expand (MarginSheet card, Calmer sheet; ticket 1258): its name,
// Technique, the Technique's settings and the maker as editable chips, and the fold. The name ellipsizes first, then the
// chips leave from the end. It only asks; the shell's flows do the work.
const props = defineProps<{
  project: Project
  frame: FrameId
  /** The forms the sheet's form allows, best first. */
  forms: readonly IdentityForm[]
  /** The band's room for the chips, in the sheet's drafting px. */
  room: number
}>()

const emit = defineEmits<{
  rename: [name: string]
  'set-technique': [technique: Technique]
  'set-setting': [id: string, value: number]
  'save-maker-name': [name: string]
}>()

const { t } = useI18n()
const fold = useTitleBlockFold()
const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const techniqueAction = controlAction('change-technique')
const foldAction = controlAction('fold-title-block')
const showAction = controlAction('show-title-block')

const name = computed(() => frameById(props.project, props.frame)?.name)
const nameLine = computed(() => frameNameLine(t.value, name.value))
const unfoldName = computed(() => fillBlanks(t.value.frame.margin.showTitleBlockOf, { name: name.value || t.value.frame.nameEmpty }))

/** The Frame's Technique and settings; once a pass is done a Technique change asks first (ticket 1184), and only a Custom
 * frame's is locked, with its reason. */
const { weave, settings } = useFrameSettings(() => props.project, () => props.frame)
const technique = computed(() => weave.value.technique)
const options = computed(() => TECHNIQUES.map((value) => ({ value, label: techniqueName(t.value, value) })))
const techniqueLocked = computed(() => !techniqueAction.enabled?.(deps.value))

/** The maker's name, the Project's Name on exports: "by {maker}" round it as the language orders it. */
const makerLine = computed(() => {
  const [prefix = '', suffix = ''] = t.value.print.byMaker.split('{maker}')
  return {
    bare: true,
    prefix: prefix.trim(),
    suffix: suffix.trim(),
    label: t.value.panels.project.makerLabel,
    value: props.project.makerName ?? '',
    editLabel: t.value.panels.project.changeMaker,
    emptyText: t.value.saveBox.yourName,
    placeholder: t.value.saveBox.yourName,
    maxlength: MAX_MAKER_NAME,
    normalize: (raw: string) => raw.trim(),
    testid: 'margin-maker',
  }
})

const rowEl = ref<HTMLElement>()
const form = useFittingForm({
  forms: () => props.forms,
  room: () => props.room,
  // The name counts at its least, so it is cut before a chip leaves.
  measure: () => rowWidth(rowEl.value, '.margin-identity__name', (text, chrome) => Math.min(text.scrollWidth, MARGIN_PX.nameLeast - chrome)),
  observed: () => [rowEl.value],
  // The words themselves, not the language: a language's words arrive after it is chosen.
  labels: () =>
    JSON.stringify([name.value, t.value.frame.nameEmpty, makerLine.value, techniqueName(t.value, technique.value), settings.value.map(({ setting, value }) => fillBlanks(weaveSettingWords(t.value, setting).short, { count: value }))]),
})
const shows = computed(() => ({
  technique: form.value === 'all' || form.value === 'noMaker' || form.value === 'noSettings',
  settings: form.value === 'all' || form.value === 'noMaker',
  maker: form.value === 'all',
  fold: form.value !== 'alone',
}))
</script>

<template>
  <div v-if="form" ref="rowEl" class="margin-identity" :style="{ maxWidth: `${room}px` }" :data-form="form" data-testid="margin-identity">
    <div class="margin-identity__name">
      <EditableLine v-bind="nameLine" @save="emit('rename', $event)" />
    </div>
    <PanelPicker
      v-if="shows.technique"
      class="margin-identity__part"
      bare
      chip
      in-shell
      icon-only="pencil"
      :model-value="technique"
      :label="t.frame.margin.changeTechnique"
      :options="options"
      :disabled="techniqueLocked"
      :disabled-body="techniqueLocked ? techniqueAction.disabledBody?.(t, deps) : undefined"
      data-testid="margin-technique-picker"
      @update:model-value="emit('set-technique', $event)"
    />
    <template v-if="shows.settings">
      <MarginSettingCell
        v-for="{ setting, value, disabledBody } in settings"
        :key="setting.id"
        class="margin-identity__part"
        :setting="setting"
        :value="value"
        :disabled-body="disabledBody"
        @set="emit('set-setting', setting.id, $event)"
      />
    </template>
    <div v-if="shows.maker" class="margin-identity__part">
      <EditableLine v-bind="makerLine" @save="emit('save-maker-name', $event)" />
    </div>
    <span v-if="shows.fold" class="margin-identity__part margin-identity__fold">
      <IconButton
        v-if="fold.folded.value"
        variant="plain"
        icon="chevron-up"
        :icon-size="12"
        :action="showAction"
        :label="unfoldName"
        data-testid="margin-title-unfold"
        @click="fold.unfold()"
      />
      <IconButton v-else variant="plain" :icon-size="12" :action="foldAction" data-testid="margin-title-fold" @click="fold.fold()" />
    </span>
  </div>
</template>

<style scoped>
.margin-identity {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  white-space: nowrap;
}

/* The name alone gives way, ending in an ellipsis; Inter 600 12. */
.margin-identity__name {
  display: flex;
  flex: 0 1 auto;
  min-width: 0;
  max-width: var(--margin-edit-width);
}

.margin-identity__name :deep(button.margin-chip) {
  font: var(--margin-title-name);
}

.margin-identity__part {
  display: flex;
  flex: none;
}

/* The Technique picker as a chip: no row height of its own. */
.margin-identity :deep(.panel-picker) {
  min-height: 0;
  padding: 0;
}

/* The fold button: 24px, a 12px icon, no fill, hover `ink` at 10%. */
.margin-identity__fold :deep(.icon-btn) {
  width: var(--margin-tool-compact);
  height: var(--margin-tool-compact);
  color: var(--body);
  border-radius: var(--radius-sm);
}

.margin-identity__fold :deep(.icon-btn:hover) {
  color: var(--ink);
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}
</style>

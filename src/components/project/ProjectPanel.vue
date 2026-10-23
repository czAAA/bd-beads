<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { beadLabel, type Bead } from '../../domain/beads'
import { DEFAULT_BEAD_SHAPE, type BeadShape, type Technique } from '../../domain/weave'
import type { Project } from '../../domain/project'
import { MAX_PROJECT_NAME, normalizeProjectName } from '../../domain/projectName'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import SaveExport from '../export/SaveExport.vue'
import BeadQuantities from '../palette/BeadQuantities.vue'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import IconButton from '../ui/IconButton.vue'
import MenuButton from '../ui/MenuButton.vue'
import TextField from '../ui/form/TextField.vue'
import PanelItem from '../shell/PanelItem.vue'
import BeadShapeField from './BeadShapeField.vue'
import CanvasSection from './CanvasSection.vue'
import CanvasTechniqueRow from './CanvasTechniqueRow.vue'
import FrameControls from './FrameControls.vue'
import NameOnExportsRow from './NameOnExportsRow.vue'

// The body of Project (spec 0440, ticket 443; ProjectPanel card): everything about the open Project that no tool already
// does: head (name, rename pencil, save state), Technique, Bead line, Canvas, Save and exports, "Name on exports", then
// Duplicate, Clear and Delete. The Frame's Edit, Fit and Remove are not here. It only asks; the app shell does the work.
const props = defineProps<{
  project: Project
  /** The Project as summaries see it while a stroke is going on (useSettledProject), for Beads needed. */
  settledProject?: Project
  beadName: string
  replaceCandidates: readonly Bead[]
  saveFailed: boolean
  unsaved: boolean
  exporting?: 'png' | 'pdf'
}>()
const emit = defineEmits<{
  rename: [name: string]
  'set-technique': [technique: Technique]
  'set-brick-block': [brickBlock: number]
  'set-canvas-technique': [technique: Technique]
  'set-canvas-brick-block': [brickBlock: number]
  'set-bead-shape': [shape: BeadShape]
  'replace-bead': [beadId: string]
  save: []
  'export-png': []
  'export-pdf': []
  'export-project-file': []
  'fit-frame': []
  'save-maker-name': [name: string]
  duplicate: []
  clear: []
  delete: []
}>()

const { t } = useI18n()

const renaming = ref(false)
const draft = ref('')
const refused = ref(false)
const fieldId = useId()
const renameField = ref<InstanceType<typeof TextField>>()
const errorId = useId()
const shapeLabelId = useId()
const rename = controlAction('rename-project')
const duplicate = controlAction('duplicate-project')
const remove = controlAction('delete-project')
const clear = controlAction('clear-project')
const renameLabel = computed(() => t.value.panels.project.rename.replace('{name}', props.project.name))

function startRename() {
  draft.value = props.project.name
  refused.value = false
  renaming.value = true
  // The person tapped the pencil to type, so the keyboard rises on a touch device too (ticket 520).
  void nextTick(() => renameField.value?.focus({ asked: true }))
}

function commitRename() {
  if (!normalizeProjectName(draft.value)) {
    refused.value = true
    return
  }
  renaming.value = false
  if (normalizeProjectName(draft.value) !== props.project.name) emit('rename', draft.value)
}

function cancelRename() {
  renaming.value = false
  refused.value = false
}

/** What the save-state line says: saved, unsaved changes, or why the device refused it. */
const state = computed(() => (props.saveFailed ? 'failed' : props.unsaved ? 'unsaved' : 'saved'))
</script>

<template>
  <div class="project-panel" data-testid="project-panel">
    <section class="project-panel__head" role="group" :aria-label="project.name">
      <div v-if="!renaming" class="project-panel__name-row">
        <h3 class="project-panel__name" data-testid="project-name">{{ project.name }}</h3>
        <IconButton variant="plain" icon="pencil" :label="renameLabel" :tooltip="{ body: rename.body?.(t) }" data-testid="project-rename" @click="startRename" />
      </div>
      <form v-else class="project-panel__rename" data-testid="project-rename-form" data-handles-escape @submit.prevent="commitRename" @panel-escape="cancelRename">
        <div class="project-panel__rename-row">
          <TextField
            :id="fieldId"
            ref="renameField"
            v-model="draft"
            type="text"
            :maxlength="MAX_PROJECT_NAME"
            :invalid="refused"
            :aria-label="renameLabel"
            :aria-describedby="refused ? errorId : undefined"
            data-testid="project-rename-input"
            @input="refused = false"
          />
          <IconButton variant="plain" icon="check" :label="t.panels.project.save" tooltip :disabled="!normalizeProjectName(draft)" data-testid="project-rename-save" @click="commitRename" />
          <IconButton variant="plain" icon="close" :label="t.panels.project.cancel" tooltip data-testid="project-rename-cancel" @click="cancelRename" />
        </div>
        <span class="project-panel__counter">{{ draft.length }}/{{ MAX_PROJECT_NAME }}</span>
        <p v-if="refused" :id="errorId" class="project-panel__error" role="alert" data-testid="project-rename-error">{{ t.panels.project.nameRequired }}</p>
      </form>
      <!-- The save state (SaveStates card), a polite live region so "Not saved" is announced. -->
      <p class="project-panel__state" :class="`project-panel__state--${state}`" role="status" aria-live="polite" data-testid="save-state">
        <template v-if="state === 'saved'">
          <AppIcon name="check" :size="14" /><span>{{ t.saveBox.savedState }}</span>
        </template>
        <template v-else-if="state === 'unsaved'">
          <span class="project-panel__dashed" aria-hidden="true" /><span>{{ t.panels.project.unsaved }}</span>
        </template>
        <template v-else>
          <AppIcon name="warning" :size="14" />
          <span class="project-panel__reason">{{ t.panels.project.notSaved.replace('{reason}', t.panels.project.saveRefused) }}</span>
          <AppButton variant="link" data-testid="save-try-again" @click="emit('save')">{{ t.panels.project.tryAgain }}</AppButton>
        </template>
      </p>
    </section>

    <FrameControls :project="project" @set-technique="emit('set-technique', $event)" @set-brick-block="emit('set-brick-block', $event)" />

    <p class="project-panel__bead" data-testid="project-bead-row">
      <span class="project-panel__bead-label">{{ t.panels.project.bead }}</span>
      <span class="project-panel__bead-name" data-testid="panel-bead">{{ beadName }}</span>
      <!-- A menu, not a native select (ticket 442): the iPad's picker swallowed the pick, and the menu works the same everywhere. -->
      <MenuButton class="project-panel__replace" variant="in-box" :label="t.replaceBead.selectLabel" data-testid="phone-replace-bead-select">
        <AppMenuItem
          v-for="bead in replaceCandidates"
          :key="bead.id"
          :data-testid="`phone-replace-bead-${bead.id}`"
          @select="emit('replace-bead', bead.id)"
        >
          {{ beadLabel(bead) }}
        </AppMenuItem>
      </MenuButton>
    </p>

    <div class="project-panel__shape" data-testid="bead-shape-row">
      <span :id="shapeLabelId">{{ t.form.beadShapeLabel }}</span>
      <BeadShapeField :model-value="project.beadShape ?? DEFAULT_BEAD_SHAPE" :labelledby="shapeLabelId" small testid="bead-shape" @update:model-value="emit('set-bead-shape', $event)" />
    </div>

    <CanvasTechniqueRow :project="project" @set-technique="emit('set-canvas-technique', $event)" @set-brick-block="emit('set-canvas-brick-block', $event)" />

    <CanvasSection />

    <SaveExport
      :has-frame="project.frame !== undefined"
      :exporting="exporting"
      :project-name="project.name"
      @export-png="emit('export-png')"
      @export-pdf="emit('export-pdf')"
      @export-project-file="emit('export-project-file')"
      @fit-frame="emit('fit-frame')"
    />

    <NameOnExportsRow :name="project.makerName ?? ''" @save="emit('save-maker-name', $event)" />

    <!-- Beads needed (ticket 146) is in no card for the new panel; it stays here, above Duplicate, until a design decision moves it (ticket 443). -->
    <div class="project-panel__beads"><BeadQuantities :project="settledProject" /></div>

    <div class="project-panel__manage" role="group" :aria-label="t.panels.project.deleteThis">
      <PanelItem icon="copy" data-testid="project-duplicate" @select="emit('duplicate')">{{ duplicate.name(t) }}</PanelItem>
      <PanelItem icon="erase" danger data-testid="project-clear" @select="emit('clear')">{{ clear.name(t) }}</PanelItem>
      <PanelItem icon="delete" danger data-testid="project-delete" @select="emit('delete')">{{ remove.name(t) }}</PanelItem>
    </div>
  </div>
</template>

<style scoped>
.project-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  color: var(--ink);
}

.project-panel > :deep(.frame-controls),
.project-panel > :deep(.canvas-technique),
.project-panel__head,
.project-panel__shape,
.project-panel__bead {
  box-sizing: border-box;
  padding: 0 var(--space-12);
}

.project-panel__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-4);
}

.project-panel__name-row,
.project-panel__rename-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.project-panel__name {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font: 600 1.0625rem/1.375rem var(--font-sans);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-panel__rename {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.project-panel__rename-row > :first-child {
  flex: 1 1 auto;
  min-width: 0;
}

.project-panel__counter {
  font: var(--type-meta);
  color: var(--muted);
}

.project-panel__error {
  margin: 0;
  font: var(--type-body);
  color: var(--danger);
}

.project-panel__state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-6);
  margin: 0;
  font: var(--type-meta);
  color: var(--muted);
}

.project-panel__state--saved :deep([data-icon]) {
  color: var(--accent-strong);
}

.project-panel__state--failed {
  color: var(--danger);
}

.project-panel__reason {
  font: 500 0.8125rem/1.125rem var(--font-sans);
}

.project-panel__dashed {
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 1.5px dashed currentColor;
  border-radius: var(--radius-full);
}

.project-panel__shape {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  font: var(--type-control);
  min-width: 0;
}

.project-panel__bead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-8);
  margin: 0;
}

.project-panel__bead-label {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.project-panel__bead-name {
  font: 500 0.875rem/1.25rem var(--font-sans);
}

.project-panel__beads {
  padding: 0 var(--space-4);
}

.project-panel__manage {
  display: flex;
  flex-direction: column;
  padding-top: var(--space-8);
  border-top: 1px solid var(--line-soft);
}
</style>

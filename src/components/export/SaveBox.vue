<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFitByPriority } from '../../composables/ui/useFitByPriority'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppMenu from '../ui/AppMenu.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import LoadingState from '../ui/LoadingState.vue'

/**
 * The save box (ticket 148; SaveBox, SaveStates and Menu cards), second in the left column: the Project library's save
 * state on this device (ADR 0012), a full-width Save Project, and Export ▾ with QR code, PNG image and PDF for
 * printing. It only asks; the app does the saving and exporting.
 */
const props = withDefaults(defineProps<{
  /** Whether the open Project has a Frame: exports take only the Frame's beads, so with none Export ▾ asks for one first (v16). */
  hasFrame?: boolean
  /** The last write to this device was refused (useProjectLibrary's saveFailed). */
  saveFailed: boolean
  /** The open Project doesn't fit a single QR code (ADR 0015). */
  qrTooLarge?: boolean
  /** A PNG or PDF is being drawn: those two wait, so a second press doesn't start a second one, and a long one says so. */
  exporting?: 'png' | 'pdf'
  /** The open Project's name, for what the wait says it is doing. */
  projectName?: string
  /** The maker's name printed on the exports (ticket 161); empty when not set. */
  makerName?: string
}>(), { hasFrame: true })

const emit = defineEmits<{
  save: []
  'export-qr': []
  'export-png': []
  'export-pdf': []
  /** The open Project as a Project file: the way out when it is too large for a QR code (ticket 158). */
  'export-project': []
  /** Change or Add the maker's name, from the Export menu's last row (ticket 161). */
  'edit-maker-name': []
  /** The Export prompt's two ways out: frame every bead drawn, or draw the Frame by hand. */
  'fit-frame': []
  'set-frame': []
}>()

const exportMenu = ref<InstanceType<typeof AppMenu>>()
const framed = computed(() => props.hasFrame)

function fromPrompt(action: 'fit-frame' | 'set-frame') {
  exportMenu.value?.close()
  if (action === 'fit-frame') emit('fit-frame')
  else emit('set-frame')
}

const { t, locale } = useI18n()
const saveAction = controlAction('save')

// Save and Export share one narrow row: when the label doesn't fit beside Export, Save shows its icon alone (ticket 231).
const buttonsEl = ref<HTMLElement>()
const saveIconOnly = useFitByPriority(buttonsEl, [() => locale.value])
</script>

<template>
  <section class="save-box" :aria-label="t.saveBox.saveButton" data-testid="save-box">
    <p class="save-box__state" :class="{ 'save-box__state--failed': saveFailed }" data-testid="save-state">
      <AppIcon :name="saveFailed ? 'warning' : 'check'" :size="14" />
      <span>{{ saveFailed ? t.saveBox.failedState : t.saveBox.savedState }}</span>
    </p>
    <div ref="buttonsEl" class="save-box__buttons">
      <AppButton
        class="save-box__save"
        variant="primary"
        size="lg"
        :action="saveAction"
        :aria-label="t.saveBox.saveButton"
        data-testid="save-button"
        @click="emit('save')"
      >
        <span v-show="!saveIconOnly">{{ t.saveBox.saveButton }}</span>
      </AppButton>
      <div class="save-box__export">
        <AppMenu ref="exportMenu" :label="t.saveBox.exportButton" icon="export" variant="in-box" size="lg" align="end" :popover="!framed" data-testid="export-menu-button" data-tour="export">
          <!-- Export needs a Frame (SaveBox card): with none, the menu's place is taken by the prompt "Set Frame to export". -->
          <div v-if="!framed" class="save-box__prompt" data-testid="export-needs-frame">
            <p class="save-box__prompt-title">{{ t.frame.exportPromptTitle }}</p>
            <p class="save-box__prompt-body">{{ t.frame.explainer }}</p>
            <div class="save-box__prompt-actions">
              <AppButton variant="toolbox" data-testid="export-fit-frame" @click="fromPrompt('fit-frame')">{{ t.frame.fitToDrawing }}</AppButton>
              <AppButton variant="primary" icon="frame" data-testid="export-set-frame" @click="fromPrompt('set-frame')">{{ t.frame.setFrame }}</AppButton>
            </div>
          </div>
          <AppMenuItem v-if="framed" icon="qr-code" :disabled="qrTooLarge" data-testid="export-qr" @select="emit('export-qr')">
            {{ t.saveBox.menuQr }}
          </AppMenuItem>
          <template v-if="framed && qrTooLarge">
            <p class="save-box__reason" data-testid="export-qr-reason">{{ t.transfer.qrTooLargeMessage }}</p>
            <AppMenuItem icon="export" data-testid="export-qr-way-out" @select="emit('export-project')">
              {{ t.saveBox.exportProjectFile }}
            </AppMenuItem>
          </template>
          <AppMenuItem v-if="framed" icon="image" :disabled="!!exporting" data-testid="export-png" @select="emit('export-png')">
            {{ t.saveBox.menuPng }}
          </AppMenuItem>
          <AppMenuItem v-if="framed" icon="pdf" :disabled="!!exporting" data-testid="export-pdf" @select="emit('export-pdf')">
            {{ t.saveBox.menuPdf }}
          </AppMenuItem>
          <!-- The Export menu ends with the name on exports (NameOnExports card). -->
          <template v-if="framed" #footer>
            <div class="save-box__name" data-testid="name-on-exports">
              <span class="save-box__name-text">
                <span class="save-box__name-label">{{ t.saveBox.nameOnExports }}</span>
                <span v-if="makerName" class="save-box__name-value" data-testid="name-on-exports-value">{{ makerName }}</span>
                <span v-else class="save-box__name-value save-box__name-value--none" data-testid="name-on-exports-value">
                  {{ t.saveBox.nameNotSet }}
                </span>
              </span>
              <AppMenuItem class="save-box__name-change" data-testid="name-on-exports-change" @select="emit('edit-maker-name')">
                {{ makerName ? t.saveBox.changeName : t.saveBox.addName }}
              </AppMenuItem>
            </div>
          </template>
        </AppMenu>
        <span class="save-box__hint" data-testid="export-formats">{{ t.saveBox.formatsHint }}</span>
      </div>
    </div>
    <LoadingState
      v-if="exporting"
      class="save-box__loading"
      compact
      :text="(exporting === 'pdf' ? t.saveBox.makingPdf : t.saveBox.makingPng).replace('{name}', projectName ?? '')"
    />
  </section>
</template>

<style scoped>
.save-box__prompt {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.save-box__prompt-title {
  margin: 0;
  font: var(--type-control);
}

.save-box__prompt-body {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 18px;
  color: var(--body);
}

.save-box__prompt-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

/* Elevation 1 in light; the `panel` step carries it in dark (the token is none there). */
.save-box {
  box-sizing: border-box;
  padding: var(--space-16) var(--space-20);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
}

.save-box__state {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  margin: 0 0 var(--space-12);
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.save-box__state > .icon {
  color: var(--accent-strong);
}

.save-box__state--failed,
.save-box__state--failed > .icon {
  color: var(--danger);
}

.save-box__buttons {
  display: flex;
  align-items: flex-start;
  gap: var(--space-8);
}

.save-box__save {
  flex: 1 1 auto;
  /* Never squeezed: the row overflows instead, which is what tells useFitByPriority to drop the label. */
  min-width: min-content;
}

/* Save's Tooltip wraps the button: the wrapper takes the row's spare width and the button fills it. */
.save-box__buttons > :deep(.app-button-wrap) {
  flex: 1 1 auto;
  min-width: min-content;
}

.save-box__export {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-6);
}

.save-box__name {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding: var(--space-4) 0 0 var(--space-10);
}

.save-box__name-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.save-box__name-label {
  font: var(--type-meta-small);
  color: var(--muted);
  text-transform: lowercase;
}

.save-box__name-value {
  overflow: hidden;
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.save-box__name-value--none {
  color: var(--muted);
}

.save-box .save-box__name-change {
  flex: none;
  width: auto;
  color: var(--accent-strong);
}

.save-box__loading {
  margin-top: var(--space-12);
}

.save-box__hint {
  font: var(--type-meta-small);
  color: var(--muted);
}

/* A disabled item's reason, in words under it (forms-and-states.md: a disabled control shows no tooltip). */
.save-box__reason {
  max-width: var(--tooltip-wide);
  margin: 0;
  padding: 0 var(--space-10) var(--space-6) calc(var(--space-10) + var(--space-8) + 1rem);
  font: var(--type-meta-small);
  font-family: var(--font-sans);
  color: var(--muted);
}
</style>

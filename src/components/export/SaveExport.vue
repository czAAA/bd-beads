<script setup lang="ts">
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import LoadingState from '../ui/LoadingState.vue'
import MenuButton from '../ui/MenuButton.vue'
import { inject } from 'vue'
import { PANEL_CONTEXT } from '../shell/panelContext'

// Save and export in the Project panel (ProjectPanel and SaveBox cards, tickets 148, 443): Save Project, PNG | PDF
// | Project file. It only asks; the app does the work. With no Frame, PNG and PDF open the "Set Frame to export" prompt
// (Fit to drawing, or a Frame from a Selection, ticket 417).
defineProps<{
  /** Whether the open Project has a Frame: PNG and PDF export only the Frame's beads. */
  hasFrame: boolean
  /** A PNG or PDF is being drawn: those two wait, so a second press doesn't start a second one, and a long one says
   * so. */
  exporting?: 'png' | 'pdf'
  /** The open Project's name, for what the wait says it is doing. */
  projectName?: string
}>()
const emit = defineEmits<{
  'export-png': []
  'export-pdf': []
  'export-project-file': []
  'fit-frame': []
}>()

const { t } = useI18n()
const context = inject(PANEL_CONTEXT, undefined)
const png = controlAction('export-png')
const pdf = controlAction('export-pdf')
const file = controlAction('export-project-file')
</script>

<template>
  <section class="save-export" role="group" :aria-label="t.panels.project.exportHeading" data-testid="save-box">
    <span class="save-export__label">{{ t.panels.project.exportHeading }}</span>
    <div class="save-export__buttons">
      <template v-if="hasFrame">
        <AppButton variant="in-box" :disabled="!!exporting" data-testid="export-png" @click="emit('export-png')">{{ png.name(t) }}</AppButton>
        <AppButton variant="in-box" :disabled="!!exporting" data-testid="export-pdf" @click="emit('export-pdf')">{{ pdf.name(t) }}</AppButton>
      </template>
      <!-- Export needs a Frame (SaveBox card): with none, PNG and PDF open the prompt "Set Frame to export". -->
      <template v-else>
        <MenuButton v-for="format in [png, pdf]" :key="format.id" popover :label="format.name(t)" variant="in-box" :data-testid="`${format.id}-needs-frame`">
          <div class="save-export__prompt" data-testid="export-needs-frame">
            <p class="save-export__prompt-title">{{ t.frame.exportPromptTitle }}</p>
            <p class="save-export__prompt-body">{{ t.frame.explainer }}</p>
            <AppButton variant="toolbox" data-testid="export-fit-frame" @click="emit('fit-frame'); context?.close()">{{ t.frame.fitToDrawing }}</AppButton>
          </div>
        </MenuButton>
      </template>
      <AppButton variant="in-box" data-testid="export-project-file" @click="emit('export-project-file')">{{ file.name(t) }}</AppButton>
    </div>
    <LoadingState
      v-if="exporting"
      class="save-export__loading"
      compact
      :text="(exporting === 'pdf' ? t.saveBox.makingPdf : t.saveBox.makingPng).replace('{name}', projectName ?? '')"
    />
  </section>
</template>

<style scoped>
.save-export {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-4) var(--space-12);
}

.save-export__label {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.save-export__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

/* Equal shares of the row; a language whose words need more room wraps its last button to a second row rather than
 * squeeze or break a word. */
.save-export__buttons > :deep(*),
.save-export__buttons :deep(.app-button) {
  flex: 1 1 auto;
  min-width: 0;
  padding-inline: var(--space-6);
}

.save-export__prompt {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.save-export__prompt-title {
  margin: 0;
  font: var(--type-control);
}

.save-export__prompt-body {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 18px;
  color: var(--body);
}
</style>

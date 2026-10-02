<script setup lang="ts">
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppMenu from '../ui/AppMenu.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import LoadingState from '../ui/LoadingState.vue'

/**
 * The save box (ticket 148; SaveBox, SaveStates and Menu cards), second in the left column: the Pattern library's save
 * state on this device (ADR 0012), a full-width Save Pattern, and Export ▾ with QR code, PNG image and PDF for
 * printing. It only asks; the app does the saving and exporting.
 */
defineProps<{
  /** The last write to this device was refused (usePatternLibrary's saveFailed). */
  saveFailed: boolean
  /** The open Pattern doesn't fit a single QR code (ADR 0015). */
  qrTooLarge?: boolean
  /** A PNG or PDF is being drawn: those two wait, so a second press doesn't start a second one, and a long one says so. */
  exporting?: 'png' | 'pdf'
  /** The open Pattern's name, for what the wait says it is doing. */
  patternName?: string
  /** The maker's name printed on the exports (ticket 161); empty when not set. */
  makerName?: string
}>()

const emit = defineEmits<{
  save: []
  'export-qr': []
  'export-png': []
  'export-pdf': []
  /** The open Pattern as a Pattern file: the way out when it is too large for a QR code (ticket 158). */
  'export-pattern': []
  /** Change or Add the maker's name, from the Export menu's last row (ticket 161). */
  'edit-maker-name': []
}>()

const { t } = useI18n()
</script>

<template>
  <section class="save-box" :aria-label="t.saveBox.saveButton" data-testid="save-box">
    <p class="save-box__state" :class="{ 'save-box__state--failed': saveFailed }" data-testid="save-state">
      <AppIcon :name="saveFailed ? 'warning' : 'check'" :size="14" />
      <span>{{ saveFailed ? t.saveBox.failedState : t.saveBox.savedState }}</span>
    </p>
    <div class="save-box__buttons">
      <AppButton
        class="save-box__save"
        variant="primary"
        size="lg"
        icon="save"
        :title="`${t.saveBox.saveButton} (Ctrl/Cmd+S)`"
        data-testid="save-button"
        @click="emit('save')"
      >
        {{ t.saveBox.saveButton }}
      </AppButton>
      <div class="save-box__export">
        <AppMenu :label="t.saveBox.exportButton" icon="export" variant="in-box" size="lg" align="end" data-testid="export-menu-button" data-tour="export">
          <AppMenuItem icon="qr-code" :disabled="qrTooLarge" data-testid="export-qr" @select="emit('export-qr')">
            {{ t.saveBox.menuQr }}
          </AppMenuItem>
          <template v-if="qrTooLarge">
            <p class="save-box__reason" data-testid="export-qr-reason">{{ t.transfer.qrTooLargeMessage }}</p>
            <AppMenuItem icon="export" data-testid="export-qr-way-out" @select="emit('export-pattern')">
              {{ t.saveBox.exportPatternFile }}
            </AppMenuItem>
          </template>
          <AppMenuItem icon="image" :disabled="!!exporting" data-testid="export-png" @select="emit('export-png')">
            {{ t.saveBox.menuPng }}
          </AppMenuItem>
          <AppMenuItem icon="pdf" :disabled="!!exporting" data-testid="export-pdf" @select="emit('export-pdf')">
            {{ t.saveBox.menuPdf }}
          </AppMenuItem>
          <!-- The Export menu ends with the name on exports (NameOnExports card). -->
          <template #footer>
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
      :text="(exporting === 'pdf' ? t.saveBox.makingPdf : t.saveBox.makingPng).replace('{name}', patternName ?? '')"
    />
  </section>
</template>

<style scoped>
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
  min-width: 0;
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

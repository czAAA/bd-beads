<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../i18n/useI18n'
import AppModal from './AppModal.vue'
import IconButton from './IconButton.vue'

/**
 * The `?` shortcuts help overlay (ticket 96): every keyboard shortcut from tickets 87, 88, 90, 91, 92, 93, 94, 95,
 * grouped under the same five Tool group names the Toolbox itself uses (CONTEXT.md's Tool group entry) -- Del
 * (ticket 90) and Space+drag (ticket 95) are canvas-wide rather than tied to a single button, and are grouped
 * under Tools as the closest fit; Paste (ticket 92) has no Toolbox button of its own, and sits under Edit next to
 * Copy. Key labels (digits, letters, "Ctrl/Cmd+C") are locale-neutral and written out directly here rather than
 * translated, matching the shortcut hints already appended to Toolbox tooltips.
 *
 * The Modal template (ticket 151; ShortcutsHelp card): two columns of groups in the Toolbox's order, each a `label`
 * heading, each row the action and its keys as Kbd chips.
 */
const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const groups = computed(() => [
  {
    title: t.value.toolbox.groups.tools,
    shortcuts: [
      { keys: '1', label: t.value.tools.paintLabel },
      { keys: '2', label: t.value.tools.fillLabel },
      { keys: '3', label: t.value.tools.selectLabel },
      { keys: 'Del', label: t.value.shortcutsHelp.eraseOrClearSelection },
      { keys: 'Space + drag', label: t.value.shortcutsHelp.panCanvas },
    ],
  },
  {
    title: t.value.toolbox.groups.colors,
    shortcuts: [{ keys: 'Shift+1…9, Shift+0, Q, W', label: t.value.shortcutsHelp.paletteColors }],
  },
  {
    title: t.value.toolbox.groups.edit,
    shortcuts: [
      { keys: 'R', label: t.value.palette.rotateButton },
      { keys: 'Ctrl/Cmd+C', label: t.value.tools.copyButton },
      { keys: 'Ctrl/Cmd+V', label: t.value.tools.pasteLabel },
      { keys: 'Ctrl/Cmd+S', label: t.value.tools.saveButton },
    ],
  },
  {
    title: t.value.toolbox.groups.mirror,
    shortcuts: [
      { keys: '−', label: t.value.mirror.decreaseLeftRightButton },
      { keys: '=', label: t.value.mirror.increaseLeftRightButton },
      { keys: '[', label: t.value.mirror.decreaseTopBottomButton },
      { keys: ']', label: t.value.mirror.increaseTopBottomButton },
      { keys: 'M', label: t.value.mirror.copyModeLabel },
      { keys: 'H', label: t.value.mirror.mirrorCurrentHorizontalButton },
      { keys: 'V', label: t.value.mirror.mirrorCurrentVerticalButton },
    ],
  },
  {
    title: t.value.toolbox.groups.rowProgress,
    shortcuts: [
      { keys: 'P', label: t.value.rowProgress.enabledLabel },
      { keys: 'D', label: t.value.rowProgress.directionButton },
      { keys: 'Enter', label: t.value.rowProgress.nextButton },
      { keys: 'Shift+Enter', label: t.value.rowProgress.previousButton },
    ],
  },
])

/** A shortcut's keys as chips: "Shift+1…9, Shift+0" is two alternatives, each a chord of keys. */
function chords(keys: string): string[][] {
  return keys.split(', ').map((chord) => chord.split(/\s*\+\s*/))
}
</script>

<template>
  <AppModal
    :title="t.shortcutsHelp.title"
    size="panel"
    scrim-testid="shortcuts-help-backdrop"
    initial-focus="dialog"
    data-testid="shortcuts-help-dialog"
    @cancel="emit('close')"
  >
    <template #header>
      <IconButton
        icon="close"
        shape="round"
        :label="t.shortcutsHelp.closeButton"
        data-testid="shortcuts-help-close"
        @click="emit('close')"
      />
    </template>

    <div class="shortcuts-help__groups">
      <section v-for="group in groups" :key="group.title" class="shortcuts-help__group" data-testid="shortcuts-help-group">
        <h3 class="shortcuts-help__group-title">{{ group.title }}</h3>
        <dl class="shortcuts-help__list">
          <div v-for="shortcut in group.shortcuts" :key="shortcut.keys" class="shortcuts-help__row">
            <dt class="shortcuts-help__label">{{ shortcut.label }}</dt>
            <dd class="shortcuts-help__keys">
              <template v-for="(chord, alternative) in chords(shortcut.keys)" :key="alternative">
                <span v-if="alternative > 0" class="shortcuts-help__or" aria-hidden="true">,</span>
                <template v-for="(key, index) in chord" :key="index">
                  <span v-if="index > 0" class="shortcuts-help__plus" aria-hidden="true">+</span>
                  <kbd class="shortcuts-help__kbd" aria-hidden="true">{{ key }}</kbd>
                </template>
              </template>
              <span class="shortcuts-help__spoken">{{ shortcut.keys }}</span>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </AppModal>
</template>

<style scoped>
.shortcuts-help__groups {
  columns: 2;
  column-gap: var(--space-24);
}

.shortcuts-help__group {
  break-inside: avoid;
  margin-bottom: var(--space-16);
}

.shortcuts-help__group-title {
  margin: 0 0 var(--space-6);
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.shortcuts-help__list {
  margin: 0;
}

.shortcuts-help__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-8);
  padding: var(--space-4) 0;
  min-height: var(--control-height);
  border-top: 1px solid var(--line-soft);
}

.shortcuts-help__label {
  flex: 1 0 auto;
  font: var(--type-body);
  color: var(--body);
}

.shortcuts-help__keys {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 0 auto;
}

/* Kbd (ShortcutsHelp card): 22px, DM Mono 12, a line-strong edge with a 2px bottom, radius-xs, on elevated. */
.shortcuts-help__kbd {
  display: inline-grid;
  place-items: center;
  box-sizing: border-box;
  min-width: var(--kbd-height);
  height: var(--kbd-height);
  padding: 0 var(--space-4);
  font: var(--type-meta-small);
  color: var(--ink);
  background: var(--elevated);
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: var(--radius-xs);
}

.shortcuts-help__plus,
.shortcuts-help__or {
  font: var(--type-meta-tiny);
  color: var(--muted);
}

/* The keys as one phrase for screen readers and for copying; the chips are for the eye. */
.shortcuts-help__spoken {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>

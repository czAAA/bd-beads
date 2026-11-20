<script setup lang="ts">
import { computed } from 'vue'
import { deviceKeyboard, useKeyHints } from '../../composables/ui/useKeyHints'
import { useI18n } from '../../i18n/useI18n'
import KeyChip from '../ui/KeyChip.vue'
import PanelSection from './PanelSection.vue'
import PanelSwitchRow from './PanelSwitchRow.vue'
import { ARROWS, chordLine, chordParts, keyParts, plusBefore } from '../../domain/chord'
import { CONTROLS, CONTROL_GROUPS, GESTURE_HELP, type ControlGroup } from '../../composables/shell/controlRegistry'

// Keyboard shortcuts, Menu's Subpanel (tickets 96, 329, 1159; ADR 0035; ShortcutsHelp card): read from the control
// registry and its gestures list, grouped as in the Toolbox. Each group's rows run in two columns down the left first,
// one chord per row, its keys in a fixed track after the name. Key labels are locale-neutral, for the device's keyboard.

const { t } = useI18n()
/** Keys are written for this device's keyboard: ⌘, ⌥ and ⌫ on an Apple one, Ctrl, Alt and Del elsewhere (ticket 0993). */
const keyboard = deviceKeyboard()

/** The switch for hotkey chips (ticket 438): reads the effective state, and its first flip keeps a choice on this
 * device. */
const { shown: hintsShown, setShown: setHintsShown } = useKeyHints()

interface ShownRow {
  id: string
  label: string
  keys: readonly string[]
}

const groupTitles = computed<Record<ControlGroup, string>>(() => ({
  tools: t.value.toolbox.groups.tools,
  colors: t.value.toolbox.groups.colors,
  edit: t.value.toolbox.groups.edit,
  canvas: t.value.shortcutsHelp.canvasGroup,
  handle: t.value.shortcutsHelp.handleGroup,
  rowProgress: t.value.toolbox.groups.rowProgress,
}))

/** The line under a group's heading saying when its keys work (on a handle: once it has focus). */
const groupHints = computed<Partial<Record<ControlGroup, string>>>(() => ({ handle: t.value.shortcutsHelp.handleHint }))

const groups = computed(() =>
  CONTROL_GROUPS.map((group) => {
    const rows: ShownRow[] = [
      ...CONTROLS.filter((control) => control.group === group && control.chords.length > 0).flatMap((control) =>
        (control.help ?? [{ name: control.name }]).map((row, index) => ({
          id: `${control.id}-${index}`,
          label: row.name(t.value),
          keys: row.keys ? keyParts(row.keys, keyboard) : chordParts(control.chords[0], keyboard),
        })),
      ),
      ...GESTURE_HELP.filter((row) => row.group === group).map((row, index) => ({
        id: `${group}-gesture-${index}`,
        label: row.name(t.value),
        keys: keyParts(row.keys, keyboard),
      })),
    ]
    return { group, title: groupTitles.value[group], hint: groupHints.value[group], rows, rowsPerColumn: Math.ceil(rows.length / 2) }
  }),
)

/** A word on a chip (Shift, wheel, right-click) gets the wider padding; arrows in one chip their letter spacing. */
function chipClass(key: string): string | undefined {
  if (key.length > 1 && [...key].every((part) => ARROWS.includes(part))) return 'kbd-chip--arrows'
  return /^[A-Za-z-]{2,}$/.test(key) ? 'kbd-chip--word' : undefined
}
</script>

<template>
  <div class="shortcuts-help" data-testid="shortcuts-help">
    <div class="shortcuts-help__switch">
      <PanelSwitchRow icon="keyboard" :model-value="hintsShown" :label="t.shortcutsHelp.keyHints" testid="shortcuts-help-key-hints" @update:model-value="setHintsShown" />
    </div>

    <PanelSection v-for="group in groups" :id="`shortcuts:${group.group}`" :key="group.group" :label="group.title" always-open data-testid="shortcuts-help-group">
      <p v-if="group.hint" class="shortcuts-help__hint">{{ group.hint }}</p>
      <dl class="shortcuts-help__list" :style="{ '--rows': group.rowsPerColumn }">
        <div v-for="row in group.rows" :key="row.id" class="shortcuts-help__row">
          <dt class="shortcuts-help__label">{{ row.label }}</dt>
          <dd class="shortcuts-help__keys">
            <template v-for="(key, index) in row.keys" :key="index">
              <span v-if="plusBefore(row.keys, index)" class="shortcuts-help__plus" aria-hidden="true">+</span>
              <KeyChip always class="kbd-chip" :class="chipClass(key)" aria-hidden="true">{{ key }}</KeyChip>
            </template>
            <span class="shortcuts-help__spoken">{{ chordLine(row.keys) }}</span>
          </dd>
        </div>
      </dl>
    </PanelSection>
  </div>
</template>

<style scoped>
/* Its own width decides the columns: a group falls to one where two would be under 22rem each. The full panel's padding
 * and edge leave them a hair less, so the line is at 44rem. */
.shortcuts-help {
  container-type: inline-size;
}

.shortcuts-help__switch {
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--line-soft);
}

.shortcuts-help__hint {
  margin: 0 0 var(--space-4);
  padding: 0 var(--space-10);
  font: var(--type-meta-small);
  color: var(--muted);
}

/* One grid per group: two equal columns filled down the left first, so neighbours across share a row's height. */
.shortcuts-help__list {
  display: grid;
  grid-template-rows: repeat(var(--rows), auto);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-flow: column;
  column-gap: var(--space-16);
  margin: 0;
}

@container (width < 44rem) {
  .shortcuts-help__list {
    grid-template-rows: none;
    grid-template-columns: minmax(0, 1fr);
    grid-auto-flow: row;
  }
}

/* The name, then the keys in a fixed track on its first line; a long name wraps in its own track. */
.shortcuts-help__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--shortcut-keys-width);
  align-content: center;
  align-items: baseline;
  column-gap: var(--space-8);
  box-sizing: border-box;
  min-height: var(--panel-item-height);
  padding: var(--space-4) var(--space-10);
  border-radius: var(--radius-sm);
}

@media (hover: hover) and (pointer: fine) {
  .shortcuts-help__row:hover {
    background: var(--hover-fill);
  }
}

.shortcuts-help__label {
  min-width: 0;
  font: var(--type-body);
  color: var(--ink);
  /* A word longer than a phone's narrow name track breaks rather than push the keys out or under it. */
  overflow-wrap: anywhere;
}

.shortcuts-help__keys {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin: 0;
  white-space: nowrap;
}

.shortcuts-help__plus {
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

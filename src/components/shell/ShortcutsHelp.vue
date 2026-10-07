<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import AppModal from '../ui/AppModal.vue'
import IconButton from '../ui/IconButton.vue'
import { CONTROLS, CONTROL_GROUPS, POINTER_HELP, chordParts, type ControlGroup } from '../../composables/shell/controlRegistry'

/**
 * The `?` shortcuts help overlay (ticket 96), generated from the control registry (ADR 0035, ticket 329): every
 * action with a key, grouped under the same Tool group names the Toolbox itself uses (CONTEXT.md's Tool group entry),
 * plus the two pointer gestures that have no key (Space+drag, Ctrl/Cmd+wheel). Key labels (digits, letters,
 * "Ctrl/Cmd+C") are locale-neutral and written out directly rather than translated.
 *
 * The Modal template (ticket 151; ShortcutsHelp card): two columns of groups in the Toolbox's order, each a `label`
 * heading, each row the action and its keys as Kbd chips.
 */
const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

interface HelpRow {
  id: string
  label: string
  /** Alternatives, each a chord of keys. */
  keys: readonly (readonly string[])[]
}

const groupTitles = computed<Record<ControlGroup, string>>(() => ({
  tools: t.value.toolbox.groups.tools,
  canvas: t.value.shortcutsHelp.canvasGroup,
  colors: t.value.toolbox.groups.colors,
  edit: t.value.toolbox.groups.edit,
  rowProgress: t.value.toolbox.groups.rowProgress,
}))

const groups = computed(() =>
  CONTROL_GROUPS.map((group) => {
    const rows: HelpRow[] = [
      ...CONTROLS.filter((control) => control.group === group && control.chords.length > 0).map((control) => ({
        id: control.id,
        label: (control.help?.name ?? control.name)(t.value),
        keys: control.help?.keys ?? control.chords.map(chordParts),
      })),
      ...POINTER_HELP.filter((row) => row.group === group).map((row) => ({
        id: row.keys.flat().join('-'),
        label: row.name(t.value),
        keys: row.keys,
      })),
    ]
    return { group, title: groupTitles.value[group], shortcuts: rows }
  }),
)

/** A row's keys as one phrase for screen readers and for copying. */
function spoken(keys: HelpRow['keys']): string {
  return keys.map((chord) => chord.join('+')).join(', ')
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
      <section v-for="group in groups" :key="group.group" class="shortcuts-help__group" data-testid="shortcuts-help-group">
        <h3 class="shortcuts-help__group-title">{{ group.title }}</h3>
        <dl class="shortcuts-help__list">
          <div v-for="shortcut in group.shortcuts" :key="shortcut.id" class="shortcuts-help__row">
            <dt class="shortcuts-help__label">{{ shortcut.label }}</dt>
            <dd class="shortcuts-help__keys">
              <template v-for="(chord, alternative) in shortcut.keys" :key="alternative">
                <span v-if="alternative > 0" class="shortcuts-help__or" aria-hidden="true">,</span>
                <template v-for="(key, index) in chord" :key="index">
                  <span v-if="index > 0" class="shortcuts-help__plus" aria-hidden="true">+</span>
                  <kbd class="shortcuts-help__kbd" aria-hidden="true">{{ key }}</kbd>
                </template>
              </template>
              <span class="shortcuts-help__spoken">{{ spoken(shortcut.keys) }}</span>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </AppModal>
</template>

<style scoped>
.shortcuts-help__groups {
  /* Two columns when each has room, one on a phone (ticket 231). */
  columns: 2 11rem;
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
  flex: 1 1 auto;
  min-width: 0;
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

<script setup lang="ts">
import { computed } from 'vue'
import IconButton from '../components/ui/IconButton.vue'
import { useI18n } from '../i18n/useI18n'
import { stepName, type HomepageSection } from './sections'

// The phone's own bar (ticket 0827; Homepage card, the phone's bar): in place of the Progress bar on a phone, the
// section's name, a segment per section and the counter over ↑, the way into the editor (the slot) and ↓. ↑ and ↓ turn
// the page as Back and Next do; the page gives the way in, so it is the strip's own action.
const props = defineProps<{
  /** The section shown, from 0. */
  section: number
  /** The Homepage's sections in order; the shown one's step name, or its heading, names it. */
  sections: readonly Pick<HomepageSection, 'id' | 'heading' | 'step'>[]
}>()
const emit = defineEmits<{ go: [section: number] }>()
const { t } = useI18n()

const last = computed(() => props.sections.length - 1)
const current = computed(() => (props.sections[props.section] ? stepName(props.sections[props.section]!) : ''))
</script>

<template>
  <div class="phone-bar" data-testid="phone-bar">
    <div class="phone-bar__where">
      <p class="phone-bar__name" data-testid="phone-bar-name">{{ current }}</p>
      <span
        class="phone-bar__segments"
        role="progressbar"
        :aria-label="t.homepage.sections.label"
        aria-valuemin="1"
        :aria-valuemax="sections.length"
        :aria-valuenow="section + 1"
        :aria-valuetext="`${section + 1}/${sections.length} · ${current}`"
        data-testid="phone-bar-track"
      >
        <span
          v-for="(entry, index) in sections"
          :key="entry.id"
          class="phone-bar__segment"
          :class="{ 'phone-bar__segment--reached': index <= section }"
          data-testid="phone-bar-segment"
        />
      </span>
      <p class="phone-bar__counter" aria-hidden="true" data-testid="phone-bar-counter">{{ section + 1 }}/{{ sections.length }}</p>
    </div>
    <div class="phone-bar__moves">
      <IconButton
        variant="box"
        icon="arrow-up"
        :icon-size="22"
        :label="t.homepage.sections.back"
        tooltip
        :disabled="section === 0"
        :disabled-body="t.homepage.sections.firstBody"
        data-testid="phone-bar-back"
        @click="emit('go', section - 1)"
      />
      <slot />
      <IconButton
        variant="box"
        icon="arrow-down"
        :icon-size="22"
        :label="t.homepage.sections.next"
        tooltip
        :disabled="section === last"
        :disabled-body="t.homepage.sections.lastBody"
        data-testid="phone-bar-next"
        @click="emit('go', section + 1)"
      />
    </div>
  </div>
</template>

<style scoped>
/* At the box's foot: `box`, a hairline on top, two rows 10px apart, clear of the screen's bottom inset. */
.phone-bar {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-10);
  padding: var(--space-10) var(--space-12) calc(var(--space-12) + env(safe-area-inset-bottom, 0px));
  background: var(--box);
  border-top: 1px solid var(--line);
}

.phone-bar__where {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  min-width: 0;
}

.phone-bar__name {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font: var(--type-label);
  color: var(--ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.phone-bar__segments {
  display: flex;
  flex: 1 1 auto;
  gap: var(--space-4);
  min-width: var(--space-32);
}

.phone-bar__segment {
  flex: 1 1 0;
  height: var(--phone-bar-segment);
  background: var(--track);
  border-radius: var(--radius-full);
}

.phone-bar__segment--reached {
  background: var(--accent);
}

.phone-bar__counter {
  flex: none;
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

/* ↑, the way in and ↓, all 48px tall; the way in takes what the two squares leave. */
.phone-bar__moves {
  display: grid;
  grid-template-columns: var(--phone-bar-button) minmax(0, 1fr) var(--phone-bar-button);
  gap: var(--space-8);
}

.phone-bar__moves :deep(.icon-btn) {
  width: var(--phone-bar-button);
  height: var(--phone-bar-button);
}

/* At an end the square is only an outline, its arrow faint. */
.phone-bar__moves :deep(.icon-btn[aria-disabled='true']) {
  color: var(--faint);
  background: none;
  border-color: var(--line);
}

.phone-bar__moves > :deep(.app-button),
.phone-bar__moves > :deep(.app-button-wrap) {
  min-width: 0;
}

/* A long language's way in takes two lines rather than run out of the button. */
.phone-bar__moves :deep(.app-button) {
  width: 100%;
  height: var(--phone-bar-button);
  font: var(--type-title);
  line-height: var(--space-20);
  text-align: center;
  white-space: normal;
  text-wrap: balance;
}
</style>

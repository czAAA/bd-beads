<script setup lang="ts">
import type { Pattern } from '../domain/pattern'
import { summarizePattern } from '../domain/pattern'
import { useI18n } from '../i18n/useI18n'

defineProps<{
  patterns: Pattern[]
  activePatternId?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  remove: [id: string]
}>()

const { t } = useI18n()
</script>

<template>
  <section v-if="patterns.length > 0" class="pattern-list" data-testid="pattern-list">
    <h2>{{ t.patterns.heading }}</h2>
    <ul>
      <li
        v-for="pattern in patterns"
        :key="pattern.id"
        class="pattern-list__item"
        data-testid="pattern-item"
        :class="{ 'pattern-list__item--active': pattern.id === activePatternId }"
      >
        <button
          type="button"
          class="pattern-list__select"
          :data-testid="`select-pattern-${pattern.id}`"
          :aria-pressed="pattern.id === activePatternId"
          @click="emit('select', pattern.id)"
        >
          {{ summarizePattern(pattern) }}
        </button>
        <button
          type="button"
          class="pattern-list__remove button--danger icon-button"
          :data-testid="`remove-pattern-${pattern.id}`"
          :aria-label="`${t.patterns.removeButton}: ${summarizePattern(pattern)}`"
          @click="emit('remove', pattern.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h16" />
            <path d="M9 7V4h6v3" />
            <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.pattern-list h2 {
  margin: 0 0 12px;
}

.pattern-list ul {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pattern-list__item {
  display: flex;
  align-items: stretch;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.pattern-list__item--active {
  border-color: var(--color-wedgewood);
}

.pattern-list__select {
  color: var(--color-ink);
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 8px 14px;
}

.pattern-list__item--active .pattern-list__select {
  color: var(--color-wedgewood-ink);
  background: var(--color-wedgewood);
}

.pattern-list__remove {
  border: none;
  border-left: var(--border-width) solid var(--color-ink);
  border-radius: 0;
  padding: 0;
}
</style>

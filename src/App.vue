<script setup lang="ts">
import { computed, ref } from 'vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import NewPatternForm from './components/NewPatternForm.vue'
import PatternGrid from './components/PatternGrid.vue'
import PatternList from './components/PatternList.vue'
import { createPattern, summarizePattern, type CreatePatternInput, type Pattern } from './domain/pattern'
import { loadPatterns, removePattern, savePattern } from './domain/patternStorage'
import { provideI18n } from './i18n/useI18n'

const { t } = provideI18n()

const patterns = ref<Pattern[]>(loadPatterns())
const activePatternId = ref<string | undefined>(mostRecentlyUpdated(patterns.value)?.id)

const activePattern = computed(() =>
  patterns.value.find((pattern) => pattern.id === activePatternId.value),
)

function mostRecentlyUpdated(list: Pattern[]): Pattern | undefined {
  return list.reduce<Pattern | undefined>(
    (latest, pattern) => (!latest || pattern.updatedAt > latest.updatedAt ? pattern : latest),
    undefined,
  )
}

function onCreatePattern(payload: CreatePatternInput) {
  const created = createPattern(payload)
  savePattern(created)
  patterns.value.push(created)
  activePatternId.value = created.id
}

function onSelectPattern(id: string) {
  activePatternId.value = id
}

function onRemovePattern(id: string) {
  removePattern(id)
  patterns.value = patterns.value.filter((pattern) => pattern.id !== id)

  if (activePatternId.value === id) {
    activePatternId.value = mostRecentlyUpdated(patterns.value)?.id
  }
}

function onNewPattern() {
  activePatternId.value = undefined
}
</script>

<template>
  <main>
    <header class="app-header">
      <h1>{{ t.app.title }}</h1>
      <LanguageSwitcher />
    </header>

    <div class="pattern-toolbar">
      <button type="button" data-testid="new-pattern-button" @click="onNewPattern">
        {{ t.patterns.newPatternButton }}
      </button>
      <p v-if="activePattern" class="current-pattern" data-testid="current-pattern-summary">
        {{ t.patterns.currentLabel }}: {{ summarizePattern(activePattern) }}
      </p>
    </div>

    <NewPatternForm v-if="!activePattern" @submit="onCreatePattern" />
    <PatternGrid v-else :pattern="activePattern" />

    <PatternList
      :patterns="patterns"
      :active-pattern-id="activePatternId"
      @select="onSelectPattern"
      @remove="onRemovePattern"
    />
  </main>
</template>

<style scoped>
main {
  padding: 24px;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px 24px;
  background: var(--color-pink);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.app-header h1 {
  margin: 0;
  color: var(--color-pink-ink);
}

.pattern-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.current-pattern {
  margin: 0;
}
</style>

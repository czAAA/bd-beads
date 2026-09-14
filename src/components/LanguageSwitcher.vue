<script setup lang="ts">
import { useI18n } from '../i18n/useI18n'
import type { Locale } from '../i18n/translations'

const { locale, setLocale, t } = useI18n()

function isActive(candidate: Locale) {
  return locale.value === candidate
}
</script>

<template>
  <div class="language-switcher" role="group" :aria-label="t.languageSwitcher.ariaLabel">
    <button
      type="button"
      data-testid="language-ru"
      class="language-switcher__option"
      :class="{ 'language-switcher__option--active': isActive('ru') }"
      :aria-pressed="isActive('ru')"
      @click="setLocale('ru')"
    >
      RU
    </button>
    <button
      type="button"
      data-testid="language-en"
      class="language-switcher__option"
      :class="{ 'language-switcher__option--active': isActive('en') }"
      :aria-pressed="isActive('en')"
      @click="setLocale('en')"
    >
      EN
    </button>
  </div>
</template>

<style scoped>
.language-switcher {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-pill);
}

.language-switcher__option {
  min-width: 2.5em;
  padding: 4px 10px;
  font: inherit;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--color-ink);
  background: transparent;
  border: none;
  border-radius: var(--radius-pill);
  cursor: pointer;
}

.language-switcher__option:hover {
  background: var(--color-paper);
}

.language-switcher__option--active {
  color: var(--color-wedgewood-ink);
  background: var(--color-wedgewood);
}

.language-switcher__option--active:hover {
  background: var(--color-wedgewood);
}
</style>

<script setup lang="ts">
import { useI18n } from '../../i18n/useI18n'
import type { Locale } from '../../i18n/translations'

/**
 * EN / RU (ticket 142; Header and ThemeToggle cards): one secondary button, the current language in `ink` and the other
 * in `subtle`. Pressing it switches to the other language; each code can also be pressed on its own.
 */
const { locale, setLocale, t } = useI18n()

function toggle() {
  setLocale(locale.value === 'en' ? 'ru' : 'en')
}

function choose(next: Locale) {
  setLocale(next)
}
</script>

<template>
  <button
    type="button"
    class="ui-control language-switcher"
    :aria-label="t.languageSwitcher.switchLabel"
    data-testid="language-switcher"
    @click="toggle"
  >
    <span
      data-testid="language-en"
      :class="{ 'language-switcher__current': locale === 'en' }"
      :aria-current="locale === 'en' ? 'true' : undefined"
      lang="en"
      @click.stop="choose('en')"
      >EN</span
    >
    <span class="language-switcher__slash" aria-hidden="true">/</span>
    <span
      data-testid="language-ru"
      :class="{ 'language-switcher__current': locale === 'ru' }"
      :aria-current="locale === 'ru' ? 'true' : undefined"
      lang="ru"
      @click.stop="choose('ru')"
      >RU</span
    >
  </button>
</template>

<style scoped>
.language-switcher {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-4);
  box-sizing: border-box;
  height: var(--control-height);
  padding: 0 var(--space-12);
  font: var(--type-control);
  color: var(--subtle);
  background: var(--button);
  border: 1px solid var(--button-line);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    transform var(--duration-instant) var(--ease-standard);
}

.language-switcher__current {
  color: var(--ink);
}

@media (hover: hover) {
  .language-switcher:hover {
    background: var(--hover-fill);
  }
}

.language-switcher:active {
  background: var(--press-fill);
  transform: scale(var(--press-scale));
}

.language-switcher:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

:root[data-theme='contrast'] .language-switcher {
  border-width: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .language-switcher:active {
    transform: none;
  }
}
</style>

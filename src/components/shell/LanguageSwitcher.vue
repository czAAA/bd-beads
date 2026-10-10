<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { LOCALES, localeCode, type Locale } from '../../domain/locale'

/**
 * EN / RU / ZH / ES / PL (ticket 142, 368; Header and ThemeToggle cards): one secondary button listing every language,
 * the current one in `ink` and the others in `subtle`. Pressing it moves to the next language in the list; each code
 * can also be pressed on its own.
 */
const { locale, setLocale, t } = useI18n()

const next = computed(() => LOCALES[(LOCALES.indexOf(locale.value) + 1) % LOCALES.length])
const label = computed(() =>
  t.value.languageSwitcher.switchLabel
    .replace('{current}', t.value.languageSwitcher.names[locale.value])
    .replace('{next}', t.value.languageSwitcher.names[next.value]),
)

function choose(picked: Locale) {
  setLocale(picked)
}
</script>

<template>
  <button
    type="button"
    class="ui-control language-switcher"
    :aria-label="label"
    data-testid="language-switcher"
    @click="choose(next)"
  >
    <template v-for="(code, index) in LOCALES" :key="code">
      <span v-if="index > 0" class="language-switcher__slash" aria-hidden="true">/</span>
      <span
        :data-testid="`language-${code}`"
        :class="{ 'language-switcher__current': locale === code }"
        :aria-current="locale === code ? 'true' : undefined"
        :lang="code"
        @click.stop="choose(code)"
        >{{ localeCode(code) }}</span
      >
    </template>
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

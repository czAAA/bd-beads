<script setup lang="ts">
import { useI18n } from '../../i18n/useI18n'
import { LOCALES, LOCALE_NAMES, localeCode } from '../../domain/locale'
import AppMenuItem from '../ui/AppMenuItem.vue'
import MenuButton from '../ui/MenuButton.vue'

// The language switcher (tickets 142, 368; Header and ThemeToggle cards): a button showing the current language's code
// that opens a list of every language, each named in itself (below the button, or above where there is no room).
// Choosing one switches the whole app.
const { locale, setLocale, t } = useI18n()
</script>

<template>
  <MenuButton
    :label="localeCode(locale)"
    :aria-label="`${t.languageSwitcher.ariaLabel}: ${LOCALE_NAMES[locale]}`"
    align="end"
    data-testid="language-switcher"
  >
    <AppMenuItem
      v-for="code in LOCALES"
      :key="code"
      :chosen="locale === code"
      :lang="code"
      :data-testid="`language-${code}`"
      @select="setLocale(code)"
    >
      {{ LOCALE_NAMES[code] }}
    </AppMenuItem>
  </MenuButton>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppLogo from '../ui/AppLogo.vue'
import AppMenu from '../ui/AppMenu.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import AppSelect from '../ui/AppSelect.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import BeadPill from '../palette/BeadPill.vue'
import IconButton from '../ui/IconButton.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import PatternImport from '../import/PatternImport.vue'
import PhoneThemeButton from './PhoneThemeButton.vue'
import ThemeToggle from './ThemeToggle.vue'
import { useAppShell } from '../../composables/shell/useAppShell'
import { useFitByPriority } from '../../composables/ui/useFitByPriority'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { summarizePattern } from '../../domain/pattern'
import { overviewUrl } from '../../overview/overviewRoute'
import { beadLabel } from '../../domain/beads'
import { useThemePick } from '../../theme/useThemePick'
import type { IconName } from '../ui/icons'

const {
  t,
  locale,
  patterns,
  activePattern,
  saveFailed,
  onNewPattern,
  activeBeadLabel,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  replaceBeadCandidates,
  onPickReplaceBead,
  onImportPatterns,
  decodeImage,
  onImportToast,
  makerName,
  nameOnExportsOpen,
  drawerOpen,
  openPhoneSheet,
  themeSheetOpen,
  phoneNewPatternOpen,
  shortcutsHelpOpen,
  tour,
} = useAppShell()

/** The header, and whether it has had to drop the imports' labels to stay on one line (ticket 142). */
const headerEl = ref<HTMLElement>()
const compactImports = useFitByPriority(headerEl, [() => locale.value, () => !!activePattern.value])

/** At 1024px and up the header's own controls stay where they are, so the menu holds only its links (HeaderMenu card). */
const wide = useMediaQuery('(min-width: 1024px)')
const overviewHref = overviewUrl(import.meta.env.BASE_URL)

/** The phone header's own theme icon (ticket 188): the current pick's icon, tapped open into a small four-way sheet, the same choice ThemeToggle itself offers in the header menu. */
const THEME_ICONS: Record<string, IconName> = { device: 'device', light: 'sun', dark: 'moon', contrast: 'contrast' }
const { pick: themePick } = useThemePick()
const themeIcon = computed(() => THEME_ICONS[themePick.value] ?? 'device')
</script>

<template>
  <!--
    The header (ticket 142; Header card): 64px, in order — the brand; the open Pattern's summary and Bead pill (only
    while a Pattern is open) and Replace bead; a flexible gap; the two imports with their one-line results; New
    Pattern; EN / RU; the theme control; Keyboard shortcuts. Nothing shrinks but the Pattern's name. When it still
    doesn't fit, it fits by priority (`writing.md`, Fitting longer text): the imports drop their labels first
    (compactImports).
  -->
  <header ref="headerEl" class="app-header" :class="{ 'app-header--compact': compactImports }" data-testid="app-topbar">
    <!--
      Tools opens the Drawer (ticket 168; Drawer card): the iPad mini tier's own way into the left column, shown
      only 744-1023px -- at 1024px and up the column is docked and this button has nothing to do.
    -->
    <span class="app-header__tools">
      <IconButton
        icon="sidebar"
        :label="t.header.toolsButton"
        :selected="drawerOpen"
        data-testid="drawer-open-button"
        data-tour="header-tools"
        @click="drawerOpen = !drawerOpen"
      />
    </span>
    <h1 class="app-header__brand">
      <AppLogo class="app-header__mark app-header__phone-hide" :size="22" />
      <span class="app-header__name app-header__phone-hide">{{ t.app.title }}</span>
    </h1>
    <!-- The phone brand (ticket 188): the bead's own icon, apart from the wordmark <h1> so the two never both render its text; the wordmark is its hover/focus label. -->
    <AppTooltip class="app-header__phone-only" :text="t.app.title" :announce="false">
      <AppIcon name="bead" :size="18" />
    </AppTooltip>

    <!--
      The header menu (ticket 210; HeaderMenu card), next to the logo at every size, replacing the header menu (ticket
      168, 79). 744-1023px: Import a file/QR code, Language, Theme and Name on exports; below 744px it drops Import
      (the Pattern sheet's job there) and adds Keyboard shortcuts (any-pointer: fine only) and a Theme item that opens
      the theme sheet. Every tier ends with a rule and Overview (ticket 77; Take the tour joins it in ticket 80); at
      1024px and up those are all it holds.
    -->
    <span class="app-header__menu">
      <AppMenu :label="t.header.menuButton" icon="menu" icon-only data-testid="header-menu">
        <!--
          The Pattern name, its size and save state (ticket 188): moved here from the header's own row, which the
          name and size used to dominate the width of at the phone tier -- see app-header__phone-pattern's own note.
        -->
        <p v-if="activePattern" class="app-header__phone-only app-header__phone-pattern" data-testid="phone-pattern-info">
          <span class="app-header__summary" data-testid="phone-pattern-summary" :title="summarizePattern(activePattern)">
            {{ summarizePattern(activePattern) }}
          </span>
          <AppIcon :name="saveFailed ? 'warning' : 'check'" :size="14" :class="{ 'app-header__phone-save--failed': saveFailed }" class="app-header__phone-save" />
        </p>
        <template v-if="!wide">
        <AppMenuItem class="app-header__menu-theme-item" icon="device" data-testid="menu-item-theme" @select="themeSheetOpen = true">
          {{ t.theme.groupLabel }}
        </AppMenuItem>
        <div class="app-header__menu-imports">
          <PatternImport :decode-image="decodeImage" :patterns="patterns" toast-results testid-prefix="menu-" @import="onImportPatterns" @import-result="onImportToast" />
        </div>
        <div class="app-header__menu-row">
          <span class="app-header__menu-label">{{ t.languageSwitcher.ariaLabel }}</span>
          <LanguageSwitcher />
        </div>
        <!-- Redundant on phone once PhoneThemeButton sits in the header itself; stays for the iPad mini tier, which has no room for a standalone icon. -->
        <div class="app-header__menu-row app-header__menu-row--wrap app-header__menu-theme">
          <span class="app-header__menu-label">{{ t.theme.groupLabel }}</span>
          <ThemeToggle />
        </div>
        <AppMenuItem class="app-header__menu-shortcuts" icon="keyboard" data-testid="menu-item-shortcuts" @select="shortcutsHelpOpen = true">
          {{ t.shortcutsHelp.title }}
        </AppMenuItem>
        <div class="app-header__menu-row" data-testid="menu-item-name-on-exports">
          <span class="app-header__menu-label">{{ t.saveBox.nameOnExports }}</span>
          <AppMenuItem data-testid="menu-item-name-on-exports-change" @select="nameOnExportsOpen = true">
            {{ makerName ? t.saveBox.changeName : t.saveBox.addName }}
          </AppMenuItem>
        </div>
        <div class="app-header__menu-rule" role="separator" />
        </template>
        <AppMenuItem icon="bead" :href="overviewHref" data-testid="menu-item-overview">
          {{ t.header.overviewItem }}
        </AppMenuItem>
        <AppMenuItem icon="info" data-testid="menu-item-tour" @select="tour.start()">
          {{ t.header.tourItem }}
        </AppMenuItem>
      </AppMenu>
    </span>

    <!--
      Technique/schema and theme (ticket 188; responsive.md, 0-743px): each its own icon, the current bead or
      theme, with a hover/focus label and a tap that opens its picker (the Pattern sheet's Bead pill row, or a
      small four-way theme sheet) -- reclaiming the width the name/size readout (now under the header menu) used to
      take, so nothing after it (Undo, Redo) is pushed out of viewport.
    -->
    <span v-if="activePattern" class="app-header__phone-only">
      <IconButton icon="size" shape="round" :label="activeBeadLabel ?? ''" data-testid="phone-bead-button" @click="openPhoneSheet = 'pattern'" />
    </span>
    <span class="app-header__phone-only">
      <IconButton :icon="themeIcon" shape="round" :label="t.theme.groupLabel" data-testid="phone-theme-button" @click="themeSheetOpen = true" />
    </span>

    <template v-if="activePattern">
      <p class="app-header__editing app-header__phone-hide" data-testid="pattern-info">
        <span class="app-header__summary" data-testid="current-pattern-summary" :title="summarizePattern(activePattern)">
          {{ summarizePattern(activePattern) }}
        </span>
        <BeadPill data-testid="current-pattern-bead">{{ activeBeadLabel }}</BeadPill>
      </p>
      <span class="app-header__phone-hide">
        <AppSelect
          variant="primary"
          data-testid="replace-bead-select"
          :aria-label="t.replaceBead.selectLabel"
          :value="''"
          @change="onPickReplaceBead($event.target as HTMLSelectElement)"
        >
          <option value="" disabled>{{ t.replaceBead.selectLabel }}</option>
          <option v-for="bead in replaceBeadCandidates" :key="bead.id" :value="bead.id">
            {{ beadLabel(bead) }}
          </option>
        </AppSelect>
      </span>
    </template>

    <span class="app-header__gap" />

    <!-- Imported Patterns go straight into the library, which decides what to open and persists them. Moves into the header menu at the iPad mini tier (ticket 168), where a toast reports the result instead; at the phone tier it lives in the Pattern sheet. -->
    <div class="app-header__imports app-header__phone-hide" data-testid="pattern-actions">
      <PatternImport :decode-image="decodeImage" :patterns="patterns" :compact="compactImports" @import="onImportPatterns" />
    </div>
    <span class="app-header__phone-hide">
      <AppButton
        variant="primary"
        icon="plus"
        data-testid="new-pattern-button"
        :disabled="patterns.length === 0"
        @click="onNewPattern"
      >
        {{ t.patterns.newPatternButton }}
      </AppButton>
    </span>
    <!-- Undo/Redo (ticket 79): the phone header's own, alongside the Dock's four tools/colour -- the same history as every other Undo/Redo in the app. -->
    <template v-if="activePattern">
      <span class="app-header__phone-only">
        <IconButton icon="undo" shape="round" :label="t.palette.undoButton" data-testid="phone-undo-button" :disabled="!canUndo" @click="onUndo" />
      </span>
      <span class="app-header__phone-only">
        <IconButton icon="redo" shape="round" :label="t.palette.redoButton" data-testid="phone-redo-button" :disabled="!canRedo" @click="onRedo" />
      </span>
    </template>
    <span class="app-header__wide-only"><LanguageSwitcher /></span>
    <span class="app-header__wide-only"><ThemeToggle /></span>
    <!-- Keyboard shortcuts only helps a fine pointer or a keyboard (ticket 166; responsive.md "Input, not width"); at the phone tier it moves into the header menu instead of its own button. -->
    <span class="app-header__shortcuts app-header__phone-hide">
      <IconButton
        icon="keyboard"
        shape="round"
        :label="t.shortcutsHelp.title"
        data-testid="shortcuts-button"
        @click="shortcutsHelpOpen = true"
      />
    </span>
  </header>

  <!--
    The phone header's second row (redesign-feedback.md): Replace bead, New Pattern and Theme, each its own icon
    with the full label on hover/long-press. Full header width to itself, below the name row, rather than sharing
    it as a nested column -- the icons plus a truncating Bead pill left no room to also fit Undo/Redo/More on some
    very narrow phones once inside the same shrinking box.
  -->
  <p v-if="activePattern" class="app-header__phone-only app-header__phone-tools" data-testid="phone-header-tools">
    <AppTooltip :text="t.replaceBead.selectLabel" :announce="false">
      <button
        type="button"
        class="ui-control app-header__phone-bead"
        :aria-label="`${t.replaceBead.selectLabel}: ${activeBeadLabel}`"
        data-testid="phone-header-bead"
        @click="openPhoneSheet = 'pattern'"
      >
        {{ activeBeadLabel }}
      </button>
    </AppTooltip>
    <IconButton
      icon="plus"
      shape="round"
      :label="t.patterns.newPatternButton"
      data-testid="phone-header-new-pattern"
      @click="phoneNewPatternOpen = true"
    />
    <PhoneThemeButton />
  </p>
</template>

<style scoped>
/*
 * The header (ticket 142; Header card): 64px on `canvas`, a `line-soft` rule under it, items 10px apart, none
 * shrinking but the Pattern's name.
 */
.app-header {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-10);
  box-sizing: border-box;
  min-height: var(--header-height);
  /* Screen edges (ticket 166; responsive.md): grows past 64px for a notch/dynamic island, `env()` falling back to 0. */
  padding: env(safe-area-inset-top) var(--space-32) 0;
  background: var(--canvas);
  border-bottom: 1px solid var(--line-soft);
}

/* The 24" and larger tier (ticket 83; responsive.md, bp-desktop): header padding 0 40 (no 40px spacing token: 2.5rem). */
@media (min-width: 1920px) {
  .app-header {
    padding-right: 2.5rem;
    padding-left: 2.5rem;
  }
}

/* The phone tier (ticket 79): 52px, tighter side padding; a phone on its side (responsive.md, bp-phone-landscape) drops to 44px. */
@media (max-width: 743px) {
  .app-header {
    min-height: var(--header-height-phone);
    /* Tighter than the reference tier's 10px (ticket 188): several small icon controls now share this row, and
       every px the gaps between them save is a px Undo and Redo stay clear of the edge. */
    gap: var(--space-4);
    padding-right: var(--space-16);
    padding-left: var(--space-16);
  }
}

@media (max-width: 743px) and (max-height: 499px) {
  .app-header {
    min-height: var(--header-height-phone-landscape);
  }
}

.app-header > * {
  flex: none;
}

.app-header__shortcuts {
  display: none;
}

@media (any-pointer: fine) {
  .app-header__shortcuts {
    display: inline-flex;
  }
}

/*
 * The iPad mini tier (ticket 168; responsive.md, 744-1023px): Tools opens the Drawer, and Import/Language/Theme move
 * into the header menu -- everything a wider tier keeps inline in the header. The header menu carries on below 744px
 * (the phone tier, ticket 79) too, since it holds the same Theme/Language/Name on exports there; only the Tools
 * button and the header menu's own Import row are specific to 744-1023px (below that the phone header has no Drawer to
 * open, and imports move into the Pattern sheet instead -- see .app-header__menu-imports and .app-header__phone-*).
 */
.app-header__tools,
.app-header__menu,
.app-header__phone-only {
  display: none;
}

@media (max-width: 1023px) {
  /*
   * !important (ticket 188): a utility hide class has to win over whatever else sets `display` on the same element
   * -- several header rows (.app-header__editing among them) set their own `display: flex` later in this file, at
   * equal specificity, and were quietly winning the cascade over this rule, leaking a few invisible-but-still-laid-
   * out px into the phone header's overflow.
   */
  .app-header__wide-only,
  .app-header__phone-hide {
    display: none !important;
  }

  .app-header__menu {
    display: inline-flex;
  }
}

/* At 1024px and up the menu is shown too (ticket 77): it holds Overview (and, from ticket 80, Take the tour). */
@media (min-width: 1024px) {
  .app-header__menu {
    display: inline-flex;
  }
}

.app-header__menu-rule {
  margin: var(--space-4) 0;
  border-top: 1px solid var(--line-soft);
}

@media (min-width: 744px) and (max-width: 1023px) {
  .app-header__tools {
    display: inline-flex;
  }
}

@media (max-width: 743px) {
  .app-header__phone-only {
    display: inline-flex;
  }

  .app-header__menu-imports {
    display: none;
  }
}

.app-header__menu-imports {
  padding: var(--space-4);
}

.app-header__menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding: var(--space-4) var(--space-8);
}

.app-header__menu-row--wrap {
  flex-wrap: wrap;
}

.app-header__menu-label {
  font: var(--type-body);
  color: var(--body);
}

/* The phone header's combined Pattern name/size + save state (ticket 79), now a row in the header menu (ticket 188). */
.app-header__phone-pattern {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--space-6);
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: var(--space-4) var(--space-8);
}

.app-header__phone-save {
  flex: none;
  color: var(--accent-strong);
}

.app-header__phone-save--failed {
  color: var(--danger);
}

/*
 * The phone header's second row (redesign-feedback.md): Replace bead, New Pattern and Theme. A sibling of <header>,
 * not nested inside it -- see the template comment above app-header__phone-tools -- so it gets the full header width
 * to itself instead of negotiating space with Undo/Redo.
 */
.app-header__phone-tools {
  display: none;
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  margin: 0;
  padding: var(--space-8) var(--space-16);
  background: var(--canvas);
  border-bottom: 1px solid var(--line-soft);
}

@media (max-width: 743px) {
  .app-header__phone-tools {
    display: flex;
  }
}

/* The only text in the row: a compact pill, same look as the wide tier's read-only Bead pill, but a real button here (it opens the Pattern sheet). */
.app-header__phone-bead {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 12rem;
  overflow: hidden;
  padding: var(--space-4) var(--space-12);
  font: var(--type-pill);
  color: var(--ink);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--pill);
  border: 0;
  border-radius: var(--radius-full);
  cursor: pointer;
}

.app-header__phone-bead:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

/* Keyboard shortcuts inside the phone's header menu only helps a fine pointer or keyboard, same rule as ticket 166's standalone header button. */
.app-header__menu-shortcuts {
  display: none;
}

@media (max-width: 743px) and (any-pointer: fine) {
  .app-header__menu-shortcuts {
    display: flex;
  }
}

/* The phone's Theme item opens the four-way sheet (HeaderMenu card); the iPad mini tier has the ThemeToggle row instead. */
.app-header__menu-theme-item {
  display: none;
}

@media (max-width: 743px) {
  .app-header__menu-theme-item {
    display: flex;
  }
}

/* Theme has its own icon in the phone header now (PhoneThemeButton); the header menu's copy only earns its keep at the iPad mini tier, which has no room for a standalone icon. */
@media (max-width: 743px) {
  .app-header__menu-theme {
    display: none;
  }
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin: 0 var(--space-10) 0 0;
}

/* bd-beads doesn't earn its keep at 52px next to the Pattern name and the header's own controls (redesign-feedback.md). */
@media (max-width: 743px) {
  .app-header__brand {
    display: none;
  }
}

.app-header__mark {
  color: var(--accent);
}

.app-header__name {
  font: var(--type-brand);
  letter-spacing: var(--tracking-brand);
  color: var(--ink);
}

/* The Pattern's summary and its Bead pill. */
.app-header__editing {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  margin: 0;
}

/*
 * Only once the imports have dropped their labels may the Pattern's name give way, cut with an ellipsis (the second
 * fitting step); the Bead pill keeps its size.
 */
.app-header--compact > .app-header__editing {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
}

.app-header__summary {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.app-header > .app-header__gap {
  flex: 1 1 0;
}

.app-header__imports {
  display: flex;
  align-items: center;
  gap: var(--space-10);
}

@media (max-width: 1023px) {
  .app-header__imports {
    display: none;
  }
}
</style>

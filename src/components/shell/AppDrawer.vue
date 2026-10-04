<script setup lang="ts">
import { inTourCard } from '../../composables/ui/tourDom'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useEscapeLayer } from '../../composables/ui/useEscapeLayer'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'

/**
 * The design system's Drawer (ticket 168; Drawer card): the iPad mini tier's left column, sliding in over the canvas
 * from the left when the header's Tools button is pressed. Always mounted -- the same Toolbox/save box/Beads
 * needed/Saved Projects instances the wider tiers show as a plain docked sidebar live in its slot at every tier, so
 * their own state (an expanded panel, a roving tab stop) isn't duplicated across two copies. CSS alone repositions
 * it: `display: contents` at 1024px and up leaves the slot as an ordinary grid child of `.app-shell__body`, and only
 * `@media (min-width: 744px) and (max-width: 1023px)` turns it into a fixed, scrimmed overlay that slides with
 * `transform` (so the canvas never resizes, ADR 0018).
 *
 * Its dialog behaviour -- the focus trap, Escape, `role="dialog"` -- only ever matters in that same range: `open`
 * only becomes true from the Tools button CSS already hides outside it. `isDrawerTier` (`useMediaQuery`) still gates
 * all of it explicitly instead of trusting that, so a window resized wide while the drawer happens to be open falls
 * back to a plain, undialogued sidebar rather than leaving a stale focus trap behind.
 */
const props = defineProps<{ open: boolean; label: string }>()
const emit = defineEmits<{ close: [] }>()

const isDrawerTier = useMediaQuery('(min-width: 744px) and (max-width: 1023px)')
const trapActive = ref(false)
watch([() => props.open, isDrawerTier], ([open, drawerTier]) => (trapActive.value = open && drawerTier), { immediate: true })

const drawerEl = ref<HTMLElement>()
let opener: HTMLElement | null = null

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  return [...(drawerEl.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
}

/** Same, but for where opening focus lands: `data-skip-autofocus` (ticket 188) opts a control with a focus side
 * effect (SizeControls' info button opens its tooltip on focus) out of being that landing spot. */
function initialFocusable(): HTMLElement | undefined {
  return focusables().find((el) => !el.hasAttribute('data-skip-autofocus'))
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
      void nextTick(() => (initialFocusable() ?? focusables()[0] ?? drawerEl.value)?.focus())
    } else if (opener?.isConnected) {
      opener.focus()
    }
  },
)

function onKeydown(event: KeyboardEvent) {
  if (!trapActive.value || event.key !== 'Tab') return
  const list = focusables()
  const first = list[0]
  const last = list.at(-1)
  if (!first || !last) {
    event.preventDefault()
    return
  }
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === drawerEl.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function onFocusIn(event: FocusEvent) {
  if (!trapActive.value) return
  const target = event.target as Node | null
  if (drawerEl.value && target && !drawerEl.value.contains(target) && !inTourCard(target)) {
    ;(initialFocusable() ?? focusables()[0] ?? drawerEl.value)?.focus()
  }
}

onMounted(() => document.addEventListener('focusin', onFocusIn))
onBeforeUnmount(() => document.removeEventListener('focusin', onFocusIn))

useEscapeLayer(() => trapActive.value, () => emit('close'))
</script>

<template>
  <div
    class="drawer-scrim"
    :class="{ 'drawer-scrim--open': open }"
    data-testid="drawer-scrim"
    @click="emit('close')"
  />
  <div
    ref="drawerEl"
    class="drawer"
    :class="{ 'drawer--open': open }"
    :role="trapActive ? 'dialog' : undefined"
    :aria-modal="trapActive ? 'true' : undefined"
    :aria-label="trapActive ? label : undefined"
    :inert="isDrawerTier && !open ? true : undefined"
    tabindex="-1"
    data-testid="drawer"
    @keydown="onKeydown"
  >
    <slot />
  </div>
</template>

<style scoped>
/* 1024px and up (ticket 167's reference/iPad 13" tiers): an invisible wrapper, so the slot is an ordinary grid child. */
.drawer {
  display: contents;
}

.drawer-scrim {
  display: none;
}

/*
 * The phone tier (ticket 79; responsive.md, under 744px): hidden altogether, not just closed -- the Dock's own
 * ToolSheets reach every control this held through their own markup instead (Toolbox and the rest stay mounted here,
 * just invisible, so their own state -- an expanded panel, a roving tab stop -- isn't lost while the tier is this
 * narrow, only unreachable). isDrawerTier/trapActive never see true down here, so its dialog behaviour never engages.
 */
@media (max-width: 743px) {
  .drawer {
    display: none;
  }
}

@media (min-width: 744px) and (max-width: 1023px) {
  .drawer {
    display: flex;
    flex-direction: column;
    position: fixed;
    inset: 0 auto 0 0;
    z-index: var(--z-drawer);
    box-sizing: border-box;
    width: var(--drawer-width);
    max-width: 100%;
    padding: var(--space-24) 0 var(--space-24) var(--space-24);
    background: var(--canvas);
    box-shadow: var(--elevation-3);
    transform: translateX(-100%);
    transition: transform var(--duration-base) var(--ease-out);
  }

  .drawer--open {
    transform: translateX(0);
  }

  /* Dark and high contrast use a border instead of relying on the shadow token alone (Modal card's own project). */
  :root[data-theme='dark'] .drawer {
    border-right: 1px solid var(--line-strong);
  }

  :root[data-theme='contrast'] .drawer {
    border-right: 2px solid var(--line-strong);
    box-shadow: none;
  }

  .drawer-scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-drawer) - 1);
    background: var(--scrim);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-base) var(--ease-out);
  }

  .drawer-scrim--open {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .drawer,
  .drawer-scrim {
    transition: none;
  }
}
</style>

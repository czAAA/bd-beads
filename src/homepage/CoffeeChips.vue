<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { useElementSize } from '../composables/ui/useElementSize'
import { useOverlayLayer } from '../composables/ui/useOverlayLayer'
import { useI18n } from '../i18n/useI18n'
import CoffeeAction from './CoffeeAction.vue'
import { coffeeChips, type CoffeeChip } from './coffeeCopy'

// The chips under the coffee screen's band (ticket 0880; Homepage card, where the rules of opening are): one row of
// icons, each opening sideways to its name, Open source and Say hello also to their action, one at a time. An open chip
// rises over its neighbours toward the side with room, so the row never moves and no chip leaves it.
const emit = defineEmits<{ feedback: [] }>()

const { t } = useI18n()
const chips = computed(() => coffeeChips(t.value))

/** What opened the open chip: a mouse over it, the focus on it, or a click, which keeps it open. */
type OpenedBy = 'hover' | 'focus' | 'click'
const open = ref<{ id: CoffeeChip['id']; by: OpenedBy; leftward: boolean; room: number } | null>(null)
const row = ref<HTMLElement>()

const isOpen = (id: CoffeeChip['id']) => open.value?.id === id

/** Which way a chip opens and how wide its words may be: rightward where they fit, else leftward where they fit, else
 * toward the roomier side, wrapping within it. Measured in the row's own px, so the Homepage's zoom doesn't matter. */
function placeOf(item: HTMLElement): { leftward: boolean; room: number } {
  const words = item.querySelector<HTMLElement>('.coffee-chip__words')!.offsetWidth
  // A px off each side, as the offsets are rounded.
  const right = row.value!.clientWidth - item.offsetLeft - item.offsetWidth - 1
  const left = item.offsetLeft - 1
  const leftward = words > right && (words <= left || left > right)
  return { leftward, room: leftward ? left : right }
}

/** Opens a chip, or says what keeps an open one open; `again` measures an open one's side afresh. */
function show(id: CoffeeChip['id'], by: OpenedBy, { again = false } = {}) {
  if (isOpen(id) && !again) {
    open.value = { ...open.value!, by }
    return
  }
  const item = row.value?.querySelector<HTMLElement>(`[data-chip="${id}"]`)
  // Measured with no room set, so the words show their whole width.
  item?.style.removeProperty('--coffee-chip-room')
  open.value = { id, by, ...(item ? placeOf(item) : { leftward: false, room: 0 }) }
}

function close() {
  open.value = null
}

// The row's width changes with the box and the Homepage's zoom: an open chip finds its side again.
const rowWidth = useElementSize(row).width
watch(rowWidth, () => {
  if (open.value) show(open.value.id, open.value.by, { again: true })
})

function onEnter(event: PointerEvent, id: CoffeeChip['id']) {
  // A finger or a pen passing over is the start of a tap: the click that follows opens it.
  if (event.pointerType === 'mouse' && !isOpen(id)) show(id, 'hover')
}

function onLeave(event: PointerEvent, id: CoffeeChip['id']) {
  if (event.pointerType === 'mouse' && isOpen(id) && open.value!.by === 'hover') close()
}

function onFocus(id: CoffeeChip['id']) {
  if (!(isOpen(id) && open.value!.by === 'click')) show(id, 'focus')
}

function onFocusOut(event: FocusEvent, id: CoffeeChip['id']) {
  const item = event.currentTarget as Element
  if (event.relatedTarget instanceof Node && item.contains(event.relatedTarget)) return
  if (isOpen(id) && open.value!.by === 'focus') close()
}

/** A click on the chip, its icon or its name, toggles it; a click on its action only acts. */
function onClick(event: MouseEvent, id: CoffeeChip['id']) {
  if ((event.target as Element).closest('.coffee-chip__action')) return
  if (isOpen(id) && open.value!.by === 'click') close()
  else show(id, 'click')
}

// A chip a click or the focus opened closes on Escape or a press outside the row, which still does what it does.
useOverlayLayer({ isOpen: () => open.value !== null && open.value.by !== 'hover', root: () => row.value, close, outside: 'through' })
</script>

<template>
  <ul ref="row" class="coffee-chips" data-testid="homepage-chips">
    <li
      v-for="chip in chips"
      :key="chip.id"
      class="coffee-chip"
      :class="{ 'coffee-chip--open': isOpen(chip.id), 'coffee-chip--leftward': isOpen(chip.id) && open!.leftward }"
      :style="isOpen(chip.id) ? { '--coffee-chip-room': `${open!.room}px` } : undefined"
      :data-chip="chip.id"
      :data-testid="`homepage-chip-${chip.id}`"
      @pointerenter="onEnter($event, chip.id)"
      @pointerleave="onLeave($event, chip.id)"
      @focusout="onFocusOut($event, chip.id)"
    >
      <div class="coffee-chip__face" @click="onClick($event, chip.id)">
        <button type="button" class="coffee-chip__icon" :aria-expanded="isOpen(chip.id)" @focus="onFocus(chip.id)">
          <AppIcon :name="chip.icon" :size="18" />
          <!-- What a screen reader hears: the name, then its line (the stop keeps them apart). -->
          <span class="coffee-chip__said">{{ chip.name }}. {{ chip.text }}</span>
        </button>
        <span class="coffee-chip__more" :inert="!isOpen(chip.id) || undefined">
          <span class="coffee-chip__clip">
            <span class="coffee-chip__words">
              <span class="coffee-chip__name" aria-hidden="true">{{ chip.name }}</span>
              <CoffeeAction v-if="chip.id === 'openSource' || chip.id === 'sayHello'" class="coffee-chip__action" :of="chip.id" @feedback="emit('feedback')" />
            </span>
          </span>
        </span>
      </div>
    </li>
  </ul>
</template>

<style scoped>
/* One row, centred, never wrapping. The hit targets touch (the 18px icons stand a target apart), and the row reaches
   16px into the band's padding: so the eight targets, 396px at the app's 18px rem, keep to it at a 481px box. */
.coffee-chips {
  position: relative;
  display: flex;
  justify-content: center;
  margin: 0 calc(-1 * var(--space-16));
  padding: 0;
  list-style: none;
}

/* Each chip's place in the row: the icon's hit target. The open chip's face stands out of it, over its neighbours. */
.coffee-chip {
  position: relative;
  flex: none;
  width: var(--touch-target);
  height: var(--touch-target);
}

.coffee-chip--open {
  z-index: 1;
}

.coffee-chip__face {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  width: max-content;
  min-height: var(--touch-target);
  border-radius: calc(var(--touch-target) / 2);
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);
}

/* Opening leftward: anchored at the icon's right edge, the words before it. */
.coffee-chip--leftward .coffee-chip__face {
  right: 0;
  left: auto;
  flex-direction: row-reverse;
}

/* Open: on `elevated`, a 1px `panel-line` edge and `elevation-2`, so it reads as lying over the row. */
.coffee-chip--open .coffee-chip__face {
  background: var(--elevated);
  box-shadow:
    0 0 0 1px var(--panel-line),
    var(--elevation-2);
}

.coffee-chip__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--touch-target);
  height: var(--touch-target);
  padding: 0;
  color: var(--accent-strong);
  background: transparent;
  border: 0;
  border-radius: calc(var(--touch-target) / 2);
  cursor: pointer;
}

.coffee-chip__icon:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: calc(-1 * var(--focus-width));
}

.coffee-chip__said {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* The words open by their own width, from none to all of it, over `duration-base`; closed, they are hidden once they
   have closed. */
.coffee-chip__more {
  display: grid;
  grid-template-columns: 0fr;
  visibility: hidden;
  transition:
    grid-template-columns var(--duration-base) var(--ease-standard),
    visibility 0s linear var(--duration-base);
}

.coffee-chip--open .coffee-chip__more {
  grid-template-columns: 1fr;
  visibility: visible;
  transition-delay: 0s;
}

.coffee-chip__clip {
  min-width: 0;
  overflow: hidden;
}

/* The name and the action on one line, wrapping under it only where the side has no room. 4px all round keeps the
   action's focus ring inside the clip. */
.coffee-chip__words {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4) var(--space-12);
  box-sizing: border-box;
  width: max-content;
  max-width: var(--coffee-chip-room, none);
  padding: var(--space-4) var(--space-14) var(--space-4) var(--space-4);
}

.coffee-chip--leftward .coffee-chip__words {
  justify-content: flex-end;
  padding-inline: var(--space-14) var(--space-4);
}

.coffee-chip__name {
  font: var(--type-promise);
  color: var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  .coffee-chip__face,
  .coffee-chip__more {
    transition: none;
  }
}
</style>

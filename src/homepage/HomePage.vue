<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowReactive, shallowRef, watch, watchEffect } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import ConfirmModal from '../components/ui/ConfirmModal.vue'
import ProjectsLibrary from '../components/project/ProjectsLibrary.vue'
import { controlAction } from '../composables/shell/controlRegistry'
import type { ProjectLibrary } from '../composables/project/useProjectLibrary'
import type { LibraryEntry } from '../composables/project/useSavedProjectConfirms'
import type { Project } from '../domain/project'
import type { SealedProject } from '../domain/sealedProject'
import CanvasStrip from '../components/canvas/CanvasStrip.vue'
import MenuPanel from '../components/shell/MenuPanel.vue'
import PanelHost from '../components/shell/PanelHost.vue'
import { useElementSize } from '../composables/ui/useElementSize'
import { useMediaQuery } from '../composables/ui/useMediaQuery'
import AppLogo from '../components/ui/AppLogo.vue'
import { positionMarkBackground } from '../rendering/positionMarks'
import { useCanvasBackground } from '../theme/useCanvasBackground'
import CoffeeScreen from './CoffeeScreen.vue'
import { wheelPixels } from './wheelTurn'
import WhatsInside from './inside/WhatsInside.vue'
import MoreBelow from './MoreBelow.vue'
import NextLine from './NextLine.vue'
import PhoneBar from './PhoneBar.vue'
import PlanTiles from './PlanTiles.vue'
import SectionBar from './SectionBar.vue'
import type { HomepageSection } from './sections'
import { useFreeGrowth } from './useFreeGrowth'
import { useMoreBelow } from './useMoreBelow'
import { useScrollNudge } from './useScrollNudge'
import { useSectionInput } from './useSectionInput'
import { provideI18n } from '../i18n/useI18n'
import { HOMEPAGE_MAX_ZOOM_PERCENT, HOMEPAGE_MIN_ZOOM_PERCENT, useHomepageZoom } from './homepageZoom'
import { fillBlanks } from '../domain/fillBlanks'
import { findBead } from '../domain/beads'
import { beadCell, type Technique } from '../domain/weave'
import FeedbackSheet from '../components/shell/FeedbackSheet.vue'
import ToastRegion from '../components/ui/ToastRegion.vue'
import { useDialogs } from '../composables/shell/useDialogs'
import { useFeedbackFlow } from '../composables/shell/useFeedbackFlow'
import { useToasts } from '../composables/ui/useToasts'
import type { FeedbackService } from '../services/feedback'

// The Homepage (ticket 77; Homepage card): one canvas box like the editor's (ticket 540, ADR 0073) mid-page: the Canvas
// strip (its slogan and the way into the editor, ticket 0822), one section at a time, the Progress bar. Scrolling turns
// the box to the next section (ticket 0739); it never moves. It only reports which way in was chosen, not where it goes.
const props = defineProps<{
  /** How many Projects this device has saved, read without decoding any; none means a new visitor. */
  projectCount: number
  /** Sending a Report: the Menu's Send feedback works here too (spec 0698), so a beader can say the app won't start. */
  feedback: FeedbackService
  /** The library, opened only once its Saved Projects are shown in the Menu (ticket 0716). */
  openLibrary?: () => HomepageLibrary
}>()
const emit = defineEmits<{
  makeFirstProject: []
  openEditor: []
  /** The editor with no Project open and the Menu on Saved Projects (ticket 0716). */
  openSavedProjects: []
  /** The editor on the Project picked in the Menu's Saved Projects. */
  openProject: [id: string]
  exportAll: [projects: Project[], sealed: SealedProject[]]
}>()

/** What the Homepage's Saved Projects needs of the library (ticket 0716). */
type HomepageLibrary = Pick<ProjectLibrary, 'projects' | 'sealed' | 'removeProject' | 'addProjects' | 'entryOf'>

const { t, locale } = provideI18n()
watchEffect(() => {
  document.title = `${t.value.homepage.pageTitle} · ${t.value.app.title}`
})

const menuOpen = ref(false)
// The Homepage has no app shell: its one dialog, the Feedback sheet, has a registry and toasts of its own.
const dialogs = useDialogs()
const { toasts, show: showToast, dismiss: dismissToast } = useToasts()
const feedback = useFeedbackFlow({ feedback: props.feedback, locale: () => locale.value, messages: () => t.value, showToast, dialogs })
const zoom = useHomepageZoom()
/** The width from which What's inside has its editor, as in the CSS (481px): a phone has the plain list (ticket 0797). */
const EDITOR_FROM = 481
const bodyEl = ref<HTMLElement>()
const bodySize = useElementSize(bodyEl)
/** A phone's box (ticket 0827): its own bar in place of the Progress bar, the way in on it, and no zoom. */
const phone = computed(() => (bodySize.width.value || window.innerWidth) < EDITOR_FROM)
const zoomPercent = computed(() => (phone.value ? 100 : zoom.percent.value))
/** The content's own width once zoomed: the width its layout is made for (the CSS asks the container the same). */
const pageWidth = computed(() => (bodySize.width.value || window.innerWidth) / (zoomPercent.value / 100))
/** The sections laid out for a phone's width: What's inside's and the promises' grouped lists, the plans stacked, and
 * each section's end saying what is next (ticket 0827). */
const narrow = computed(() => pageWidth.value < EDITOR_FROM)
const canvasBackground = useCanvasBackground()
/** What the page's background is woven in (ticket 0734: its every other column hangs half a bead lower). */
const BACKGROUND: { technique: Technique } = { technique: 'peyote' }
/** The Delica 11/0's real cell, the one an editor Project in that Bead draws (ticket 0724). */
const DELICA_CELL = beadCell(findBead('miyuki/delica/11-0'), BACKGROUND.technique)
// The page's background is the editor Canvas's empty positions of a Miyuki Delica 11/0 Project worked in peyote, in the
// Bead's real cell, outlined in the theme's Position mark color, sized by the zoom.
const boxStyle = computed(() => {
  const color = canvasBackground.background.value?.color
  const zoomScale = zoomPercent.value / 100
  const pixelRatio = window.devicePixelRatio || 1
  const marks = positionMarkBackground({
    technique: BACKGROUND.technique,
    cell: DELICA_CELL,
    deviceScale: zoomScale * pixelRatio,
    pixelRatio,
    color: canvasBackground.projectTheme.value.positionMark,
  })
  return {
    ...(color ? { '--canvas-bg': color } : undefined),
    ...(marks ? { '--canvas-marks': `url(${marks.url})`, '--canvas-tile': `${marks.width}px ${marks.height}px` } : undefined),
  }
})

// The sections (tickets 0739, 0744, 0801): one at a time in the box, which never moves; the page itself never scrolls.
// This list is the one place they are named and ordered: the page draws them and turns between them, the Progress bar
// its steps.
const sections = computed<HomepageSection[]>(() => [
  {
    id: 'inside',
    heading: t.value.homepage.whatsInside,
    title: 'inside',
    shows: WhatsInside,
    with: (): Record<string, unknown> => ({ class: narrow.value ? undefined : 'homepage__fill', withEditor: !narrow.value, shown: sections.value[section.value]?.id === 'inside' }),
  },
  {
    id: 'coffee',
    heading: t.value.homepage.coffee.title,
    title: 'hidden',
    centred: true,
    shows: CoffeeScreen,
    // Say hello's Send feedback opens the Feedback sheet as the Menu's row does (ticket 0823).
    with: () => ({ phone: narrow.value, onFeedback: () => feedback.onOpenFeedback('general') }),
  },
  {
    id: 'plans',
    heading: t.value.homepage.plans.heading,
    title: 'inside',
    shows: PlanTiles,
    // A phone's list has no growing and no fade: Show all opens it (ticket 0827).
    with: () => ({
      phone: narrow.value,
      freeHeight: narrow.value ? undefined : freeGrowth.height.value,
      freeOpen: narrow.value || freeGrowth.open.value,
      onOpenEditor: () => emit('openEditor'),
    }),
  },
])
const plansIndex = computed(() => sections.value.findIndex((entry) => entry.id === 'plans'))
const pageEl = ref<HTMLElement>()
/** The section shown: the one truth of where the Homepage is, which every way of turning it sets (ticket 0801). */
const section = ref(0)
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

/** The section shown, as drawn: what the keys and More below scroll when it is taller than its room. */
function shownSection() {
  return sectionEls.get(sections.value[section.value]!.id)
}

/** Back, Next, the steps and every scroll and key: the box turns to the section at once, however far it is. */
function goTo(index: number) {
  if (index === section.value || index < 0 || index >= sections.value.length) return
  section.value = index
}

// Wheel, trackpad, swipe and keys turn the box one section at a time; a section taller than its room scrolls inside
// itself first, the plans' scroll growing the free list.
const input = useSectionInput({
  section,
  count: () => sections.value.length,
  page: () => pageEl.value,
  shown: shownSection,
  held: () => menuOpen.value || !!dialogs.open.value || !!pendingRemove.value,
  reducedMotion,
  turn: goTo,
})
const nudge = useScrollNudge({ onFirst: () => section.value === 0, reducedMotion })

/** The demo editor in What's inside pans on a wheel and holds it from the page; until the beader takes it over the wheel
 * is the page's own, so a section taller than its room scrolls (and turns) over the editor too. */
function onWheelFirst(event: WheelEvent) {
  if (!(event.target instanceof Element) || !event.target.closest('.inside-editor:not([data-taken-over])')) return
  event.stopPropagation()
  onWheel(event)
  // The editor's panel lets no scroll chain past it, so the section is scrolled by hand.
  const room = event.target.closest('.homepage__section')
  if (!event.defaultPrevented && room) {
    event.preventDefault()
    room.scrollTop += wheelPixels(event, pageEl.value?.clientHeight ?? window.innerHeight)
  }
}

function onWheel(event: WheelEvent) {
  nudge.scrolled()
  input.onWheel(event)
}

function onTouchStart(event: TouchEvent) {
  nudge.acted()
  input.onTouchStart(event)
}

function onTouchEnd(event: TouchEvent) {
  if (input.onTouchEnd(event)) nudge.scrolled()
}

/** A key that scrolls or turns the page means the beader knows it scrolls; any other only holds the nudge off. */
function onKeydown(event: KeyboardEvent) {
  input.onKeydown(event)
  if (event.defaultPrevented) nudge.scrolled()
  else nudge.acted()
}

/** Where a section is drawn: the one shown, or the side it slid out to. */
function sectionState(index: number) {
  return index === section.value ? 'shown' : index < section.value ? 'before' : 'after'
}

// The page holds the focus when it opens, so a screen reader starts in it; the keys turn it from anywhere.
onMounted(() => {
  pageEl.value?.focus({ preventScroll: true })
  // Capturing, to come before the editor's own wheel; the listener goes with the page element.
  pageEl.value?.addEventListener('wheel', onWheelFirst, { capture: true })
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// The free list (tickets 0742, 0801): scrolling the plans section grows No account's list, the plans scrolling up as it
// grows, and the section reaches as far as the whole list needs.
const sectionEls = shallowReactive(new Map<string, HTMLElement>())
/** What each section shows, by its id: the plans' tiles are what the free list is measured in. */
const shownIn = shallowReactive(new Map<string, unknown>())
const plans = computed(() => shownIn.get('plans') as InstanceType<typeof PlanTiles> | undefined)
const plansSection = computed(() => sectionEls.get('plans'))
const freeGrowth = useFreeGrowth({
  section: plansSection,
  freeWindow: () => plans.value?.freeWindow,
  freeTile: () => plans.value?.freeTile,
  zoom: () => zoomPercent.value / 100,
})
const remeasureFree = () => void nextTick(freeGrowth.remeasure)
onMounted(() => {
  remeasureFree()
  void document.fonts?.ready.then(remeasureFree)
})
watch([locale, zoomPercent, bodySize.width, bodySize.height, () => section.value === plansIndex.value], remeasureFree)

// More below (ticket 0826): a press scrolls the section on, or turns to the next as Next does.
const moreBelow = useMoreBelow({
  section,
  count: () => sections.value.length,
  shown: shownSection,
  phone: () => narrow.value,
})

/** A section's own scroll: the plans' grows the free list. */
function onSectionScroll(id: string, event: Event) {
  if (id === 'plans') freeGrowth.scrolled((event.target as HTMLElement).scrollTop)
}

// The Menu's Saved Projects (ticket 0716): the editor's list, its Remove asking first, a pick opening the editor on it.
const library = shallowRef<HomepageLibrary>()
const count = computed(() => (library.value ? library.value.projects.value.length + library.value.sealed.value.length : props.projectCount))
const pendingRemove = ref<LibraryEntry>()

function showSavedProjects() {
  library.value ??= props.openLibrary?.()
}

function confirmRemove() {
  const entry = pendingRemove.value
  pendingRemove.value = undefined
  if (entry) library.value?.removeProject(entry.id)
}

const isNew = computed(() => count.value === 0)

/** The phone bar's main button: into the editor as the strip's way in goes, a new visitor making their first Project. */
function goIn() {
  if (isNew.value) emit('makeFirstProject')
  else emit('openEditor')
}
/** The Menu row's action, whose name the strip's library button shows with the count (tickets 0716, 0822). */
const savedProjects = controlAction('saved-projects')
</script>

<template>
  <div
    ref="pageEl"
    class="homepage-page"
    tabindex="-1"
    data-testid="homepage-page"
    @wheel="onWheel"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
    @touchcancel.passive="input.onTouchCancel"
    @pointerdown="nudge.acted"
  >
    <div class="homepage-page__stage" :style="{ '--progress': section / Math.max(1, sections.length - 1) }">
      <!-- The two faint X1 marks beside the box, drifting a little as the box turns. -->
      <span class="homepage-page__marks">
        <AppLogo class="homepage-page__mark homepage-page__mark--large" :size="420" data-testid="homepage-mark" />
        <AppLogo class="homepage-page__mark homepage-page__mark--small" :size="120" data-testid="homepage-mark" />
      </span>

      <div class="homepage" :style="boxStyle" data-testid="homepage">
        <div class="homepage__strip">
          <CanvasStrip
            page="homepage"
            :open-panel="menuOpen ? 'menu' : null"
            :zoom-percent="zoom.percent.value"
            :zoom-min-percent="HOMEPAGE_MIN_ZOOM_PERCENT"
            :zoom-max-percent="HOMEPAGE_MAX_ZOOM_PERCENT"
            @select-panel="menuOpen = !menuOpen"
            @zoom-in="zoom.zoomIn"
            @zoom-out="zoom.zoomOut"
            @reset="zoom.reset"
          >
            <!-- On a phone the way in is the phone bar's; the strip keeps Projects library, its icon and count (ticket 0827). -->
            <template v-if="phone && !isNew" #way-in>
              <AppButton
                variant="box"
                :action="savedProjects"
                :aria-label="fillBlanks(t.homepage.library, { library: savedProjects.name(t), count })"
                data-testid="homepage-saved-projects"
                @click="emit('openSavedProjects')"
              >
                {{ count }}
              </AppButton>
            </template>
            <!-- The way into the editor beside Menu (ticket 0822): the hero's buttons, moved into the strip. -->
            <template v-else-if="!phone" #way-in>
              <AppButton v-if="isNew" variant="primary" size="sm" data-testid="homepage-make-first" @click="emit('makeFirstProject')">
                {{ t.homepage.makeFirstProject }}
              </AppButton>
              <template v-else>
                <AppButton variant="primary" size="sm" data-testid="homepage-open-editor" @click="emit('openEditor')">
                  {{ t.homepage.openEditor }}
                </AppButton>
                <!-- Projects library (ticket 0716): the editor with no Project open and the Menu on its list. -->
                <AppButton size="sm" :action="savedProjects" data-testid="homepage-saved-projects" @click="emit('openSavedProjects')">
                  <span class="canvas-strip__way-in-name">{{ savedProjects.name(t) }}</span> · {{ count }}
                </AppButton>
              </template>
            </template>
          </CanvasStrip>
        </div>
        <PanelHost v-if="menuOpen" open="menu" :only="['menu']" :sub-title="t.projects.heading" :sub-meta="String(count)" @close="menuOpen = false">
          <MenuPanel page="homepage" :project-count="count" @saved-projects="showSavedProjects" @feedback="feedback.onOpenFeedback" />
          <template #sub="{ depth }">
            <ProjectsLibrary
              v-if="depth === 1 && library"
              :projects="library.projects.value"
              :sealed="library.sealed.value"
              @select="emit('openProject', $event)"
              @remove="pendingRemove = library.entryOf($event)"
              @import="library.addProjects"
              @export-all="emit('exportAll', library.projects.value, library.sealed.value)"
            />
          </template>
        </PanelHost>
        <ConfirmModal
          v-if="pendingRemove"
          data-testid="remove-project-modal"
          :title="t.removeProject.title"
          :message="fillBlanks(t.removeProject.message, { name: pendingRemove.name })"
          :confirm-label="t.removeProject.confirmButton"
          :cancel-label="t.removeProject.cancelButton"
          @confirm="confirmRemove"
          @cancel="pendingRemove = undefined"
        />
        <FeedbackSheet
          v-if="dialogs.open.value === 'feedback' && feedback.feedbackRequest.value"
          :request="feedback.feedbackRequest.value"
          :verify="feedback.verifyFeedback"
          :send="feedback.sendReport"
          :copy="feedback.copyReport"
          @cancel="feedback.onCloseFeedback"
        />
        <ToastRegion :toasts="toasts" @dismiss="dismissToast" />

        <div ref="bodyEl" class="homepage__body" data-testid="homepage-body">
          <main class="homepage__page" :style="{ zoom: zoomPercent / 100 }">
            <div class="homepage__sections">
              <section
                v-for="(entry, index) in sections"
                :key="entry.id"
                :ref="(el) => el ? sectionEls.set(entry.id, el as HTMLElement) : sectionEls.delete(entry.id)"
                class="homepage__section"
                :class="[
                  `homepage__section--${sectionState(index)}`,
                  `homepage__section--${entry.id}`,
                  {
                    'homepage__section--centred': entry.centred,
                    'homepage__section--nudge': index === 0 && section === 0 && nudge.nudging.value,
                  },
                ]"
                :aria-labelledby="entry.title === 'above' ? `homepage-${entry.id}` : undefined"
                :aria-label="entry.title === 'hidden' ? entry.heading : undefined"
                :data-testid="`homepage-section-${entry.id}`"
                @scroll.passive="onSectionScroll(entry.id, $event)"
              >
                <h2 v-if="entry.title === 'above'" :id="`homepage-${entry.id}`" class="homepage__heading">{{ entry.heading }}</h2>
                <component
                  :is="entry.shows"
                  v-bind="entry.with?.()"
                  :ref="(shown: unknown) => (shown ? shownIn.set(entry.id, shown) : shownIn.delete(entry.id))"
                />
                <!-- On a phone each section but the last ends saying what is next (ticket 0827). -->
                <NextLine v-if="narrow && index < sections.length - 1" :section="sections[index + 1]!.heading" />
                <!-- The plans section reaches on as far as the free list grows (ticket 0742). -->
                <span
                  v-if="entry.id === 'plans' && !narrow"
                  class="homepage__free-room"
                  :style="{ height: `calc(100% + ${freeGrowth.room.value}px)` }"
                  aria-hidden="true"
                />
              </section>
            </div>
          </main>
          <!-- At the drawing area's foot, so it rides on whatever bar sits under it (ticket 0826). -->
          <MoreBelow v-if="moreBelow.shows.value" :fade="moreBelow.continues.value" @more="input.more" />
        </div>
        <PhoneBar v-if="phone" :section="section" :sections="sections" @go="goTo">
          <AppButton variant="primary" data-testid="homepage-phone-way-in" data-wrap-ok @click="goIn">
            {{ isNew ? t.homepage.makeFirstProject : t.homepage.openEditor }}
          </AppButton>
        </PhoneBar>
        <SectionBar v-else :section="section" :sections="sections" :nudging="nudge.nudging.value" @go="goTo" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The page (tickets 0739, 0801): the theme's own ground, never scrolling itself; the stage holds the box in its middle,
 * and a section turns in it by every way of scrolling. */
.homepage-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
  overscroll-behavior: none;
  color: var(--ink);
  background: var(--page-ground);
  outline: none;
}

.homepage-page__stage {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: max(var(--space-8), env(safe-area-inset-top)) max(var(--space-8), env(safe-area-inset-right))
    max(var(--space-8), env(safe-area-inset-bottom)) max(var(--space-8), env(safe-area-inset-left));
}

@media (min-width: 744px) {
  .homepage-page__stage {
    padding: var(--space-24);
  }
}

/* Two faint X1 marks outside the box (the drawn layer is gone): `accent`, behind it, drifting as the box turns from the
 * first section (`--progress` 0) to the last (1); cut at the screen's edge. */
.homepage-page__marks {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.homepage-page__mark {
  position: absolute;
  z-index: 0;
  color: var(--accent);
  pointer-events: none;
  transition: transform var(--section-turn) var(--ease-standard);
}

.homepage-page__mark--large {
  top: 14%;
  left: calc(50% - var(--homepage-box-width) / 2 - var(--homepage-mark-large) / 2 - var(--space-24));
  stroke-width: 1.4;
  opacity: 0.07;
  transform: translateY(calc(5rem - 13.75rem * var(--progress)));
}

.homepage-page__mark--small {
  right: calc(50% - var(--homepage-box-width) / 2 - var(--homepage-mark-small) - var(--space-32));
  bottom: 10%;
  stroke-width: 2.6;
  opacity: 0.16;
  transform: translateY(calc(-3.75rem + 10.625rem * var(--progress)));
}

/* The canvas box (ticket 540, ADR 0073): the Canvas strip on top, one section under it, the Progress bar below, as the
 * editor's box is laid out. */
.homepage {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: var(--homepage-box-width);
  height: 100%;
  max-height: var(--homepage-box-height);
  overflow: hidden;
  color: var(--ink);
  background: var(--box);
  border-radius: var(--canvas-box-radius);
}

/* The drawing area: today's Canvas background with its peyote position marks. */
.homepage__body {
  position: relative;
  display: flex;
  flex: 1 1 0;
  min-height: 0;
  background-color: var(--canvas-bg, var(--canvas));
  background-image: var(--canvas-marks, none);
  background-size: var(--canvas-tile);
}

/* The zoom scales the content; the layout is made for the width it ends up with, so the text reflows and the page never
 * scrolls sideways. */
/* The strip sizes itself by the box's width, as the editor's by its shell's (ticket 0797). */
.homepage__strip {
  container: shell / inline-size;
}

.homepage__page {
  container: homepage / inline-size;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

/* One section at a time in the room left (ticket 0739): the one shown, the ones before slid up and faded, the ones after
 * waiting below; a section taller than the room scrolls inside itself. */
.homepage__sections {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
}

.homepage__section {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-width: 67.5rem;
  margin: 0 auto;
  padding: var(--space-4) var(--space-8) var(--space-12);
  overflow-y: auto;
  overscroll-behavior: contain;
  transition:
    opacity var(--section-turn) var(--ease-standard),
    transform var(--section-turn) var(--ease-standard),
    visibility 0s linear var(--section-turn);
}

@container homepage (min-width: 744px) {
  .homepage__section {
    padding: var(--space-8) var(--space-24) var(--space-24);
  }
}

@container homepage (min-width: 1024px) {
  .homepage__section {
    padding-right: var(--space-32);
    padding-left: var(--space-32);
  }
}

/* On a phone every section 16 16 24 (ticket 0827). */
@container homepage (max-width: 480px) {
  .homepage__section {
    padding: var(--space-16) var(--space-16) var(--space-24);
  }
}

/* What's inside gives its demo the box's whole width (ticket 0825); the phone's plain list keeps the phone's room. */
@container homepage (min-width: 481px) {
  .homepage__section--inside {
    max-width: none;
    padding: var(--space-8) var(--space-16) var(--space-16);
  }
}

.homepage__section--shown {
  transition-delay: 0s;
}

/* The nudge (ticket 0784): the first section lifts and settles once, the way it starts to turn. */
.homepage__section--nudge {
  animation: homepage-nudge var(--nudge-length) both;
}

@keyframes homepage-nudge {
  0% {
    transform: none;
    opacity: 1;
    animation-timing-function: var(--ease-out);
  }

  40% {
    transform: translateY(calc(var(--nudge-lift) * -1));
    opacity: var(--nudge-fade);
    animation-timing-function: var(--ease-standard);
  }

  100% {
    transform: none;
    opacity: 1;
  }
}

.homepage__section--before,
.homepage__section--after {
  visibility: hidden;
  opacity: 0;
}

.homepage__section--before {
  transform: translateY(calc(var(--section-shift) * -1)) scale(var(--section-scale));
}

.homepage__section--after {
  transform: translateY(var(--section-shift)) scale(var(--section-scale));
}

/* The room the plans section scrolls on into as the free list grows (tickets 0742, 0801): its own scroll grows the list. */
.homepage__free-room {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  pointer-events: none;
  visibility: hidden;
}

/* Centred while it fits; taller than its room it starts at the top, so the whole of it scrolls into view. */
.homepage__section--centred {
  justify-content: center;
  justify-content: safe center;
}

.homepage__heading {
  flex: none;
  margin: 0 0 var(--space-12);
  font: var(--type-serif-heading);
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}

.homepage__fill {
  flex: 1 1 0;
  min-height: 0;
}

/* Reduced motion: the sections swap without sliding. */
@media (prefers-reduced-motion: reduce) {
  .homepage__section {
    transform: none !important;
    transition: none;
    animation: none;
  }

  .homepage-page__mark {
    transition: none;
  }
}
</style>

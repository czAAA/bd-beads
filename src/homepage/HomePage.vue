<script setup lang="ts">
import { computed, ref, shallowRef, watchEffect } from 'vue'
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
import { positionMarkBackground } from '../rendering/positionMarks'
import { useCanvasBackground } from '../theme/useCanvasBackground'
import DrawnLayer from './DrawnLayer.vue'
import CoffeeTile from './CoffeeTile.vue'
import FeatureCarousel from './FeatureCarousel.vue'
import PlanTiles from './PlanTiles.vue'
import RollingSlogan from './RollingSlogan.vue'
import { provideI18n } from '../i18n/useI18n'
import { HOMEPAGE_MAX_ZOOM_PERCENT, HOMEPAGE_MIN_ZOOM_PERCENT, useHomepageZoom } from './homepageZoom'
import { fillBlanks } from '../domain/fillBlanks'
import { findBead } from '../domain/beads'
import { beadCell } from '../domain/weave'
import FeedbackSheet from '../components/shell/FeedbackSheet.vue'
import ToastRegion from '../components/ui/ToastRegion.vue'
import { useDialogs } from '../composables/shell/useDialogs'
import { useFeedbackFlow } from '../composables/shell/useFeedbackFlow'
import { useToasts } from '../composables/ui/useToasts'
import type { FeedbackService } from '../services/feedback'

// The Homepage (ticket 77; Homepage card): the page outside the editor that introduces openbeads, a canvas box like the
// editor's (ticket 540, ADR 0073): the Canvas strip on top, the content scrolling between, an empty Canvas footer below.
// It only reports which way in was chosen: the entry decides where that goes.
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
/** The content's own width once zoomed: the width its layout is made for (the CSS asks the container the same). */
/** The width from which the carousel is a tablist, as in the CSS (1024px). */
const WIDE_FROM = 1024
const scrollEl = ref<HTMLElement>()
const scrollSize = useElementSize(scrollEl)
const pageWidth = computed(() => (scrollSize.width.value || window.innerWidth) / (zoom.percent.value / 100))
const canvasBackground = useCanvasBackground()
/** The Delica 11/0's real cell, the one an editor Project in that Bead draws (ticket 0724). */
const DELICA_CELL = beadCell(findBead('miyuki/delica/11-0'))
// The page's background is the editor Canvas's empty positions of a Miyuki Delica 11/0 Project worked in peyote (each
// row shifted half a bead), in the Bead's real cell, outlined in the theme's Position mark color, sized by the zoom.
const boxStyle = computed(() => {
  const color = canvasBackground.background.value?.color
  const zoomScale = zoom.percent.value / 100
  const pixelRatio = window.devicePixelRatio || 1
  const marks = positionMarkBackground({
    technique: 'peyote',
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
const savedProjects = controlAction('saved-projects')
/** "Saved Projects · 3": the Menu row's name with the count (ticket 0716). */
const savedProjectsLabel = computed(() => `${savedProjects.name(t.value)} · ${count.value}`)
</script>

<template>
  <div class="homepage" :style="boxStyle" data-testid="homepage">
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
    />
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

    <div ref="scrollEl" class="homepage__scroll" data-testid="homepage-scroll">
      <div class="homepage__page" :style="{ zoom: zoom.percent.value / 100 }">
    <main class="homepage__main">
      <section class="homepage__hero">
        <DrawnLayer section="hero" />
        <RollingSlogan />
        <p class="homepage__tagline">
          <span class="homepage__tagline-text">{{ t.homepage.tagline }}</span>
          <span class="homepage__aside homepage__aside--us" aria-hidden="true" data-testid="homepage-note-on-us">
            <svg class="homepage__arrow" width="18" height="8" viewBox="0 0 18 8"><path d="M17 4 H2 M6 1 L2 4 L6 7" /></svg>
            <span class="homepage__note homepage__note--accent">{{ t.homepage.notes.onUs }}</span>
          </span>
        </p>
        <div class="homepage__actions">
          <template v-if="isNew">
            <span class="homepage__buttons">
              <AppButton variant="primary" size="lg" data-testid="homepage-make-first" @click="emit('makeFirstProject')">
                {{ t.homepage.makeFirstProject }}
              </AppButton>
              <AppButton size="lg" data-testid="homepage-open-editor" @click="emit('openEditor')">
                {{ t.homepage.openEditor }}
              </AppButton>
            </span>
          </template>
          <template v-else>
            <span class="homepage__buttons">
              <AppButton variant="primary" size="lg" data-testid="homepage-open-editor" @click="emit('openEditor')">
                {{ t.homepage.openEditor }}
              </AppButton>
              <!-- Saved Projects (ticket 0716): the editor with no Project open and the Menu on its list. -->
              <AppButton size="lg" icon="library" data-testid="homepage-saved-projects" @click="emit('openSavedProjects')">
                {{ savedProjectsLabel }}
              </AppButton>
            </span>
          </template>
        </div>
      </section>

      <section class="homepage__inside" aria-labelledby="homepage-inside">
        <DrawnLayer section="inside" />
        <h2 id="homepage-inside" class="homepage__heading">{{ t.homepage.whatsInside }}</h2>
        <FeatureCarousel :wide="pageWidth >= WIDE_FROM" />
      </section>

      <div class="homepage__coffee">
        <DrawnLayer section="coffee" />
        <CoffeeTile />
      </div>

      <PlanTiles @open-editor="emit('openEditor')" />
    </main>
      </div>
    </div>
    <div class="homepage__footer" data-testid="canvas-footer" />
  </div>
</template>

<style scoped>
/* The canvas box (ticket 540, ADR 0073): the screen, the Canvas strip on top, the content scrolling between it and the
 * empty Canvas footer, as the editor's box is laid out. */
.homepage {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  overflow: hidden;
  color: var(--ink);
  background: var(--box);
  border-radius: var(--canvas-box-radius);
}

.homepage__scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden auto;
  background-color: var(--canvas-bg, var(--canvas));
  background-image: var(--canvas-marks, none);
  background-size: var(--canvas-tile);
  background-attachment: local;
}

/* The zoom scales the content; the layout is made for the width it ends up with, so the text reflows and the page never
 * scrolls sideways. The drawn layer measures its placements from the main column's edge in this width. */
.homepage__page {
  container: homepage / inline-size;
}

/* The same height as the editor's Progress bar, so the box doesn't change between pages. */
.homepage__footer {
  flex: none;
  box-sizing: border-box;
  height: var(--progress-height);
  border: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
  border-bottom: 0;
  border-radius: 0 0 var(--canvas-box-radius) var(--canvas-box-radius);
}

.homepage__main {
  box-sizing: border-box;
  max-width: 67.5rem;
  margin: 0 auto;
  padding: var(--space-32) var(--space-16) var(--space-32);
}

@container homepage (min-width: 744px) {
  .homepage__main {
    padding-right: var(--space-24);
    padding-left: var(--space-24);
  }
}

@container homepage (min-width: 1024px) {
  .homepage__main {
    padding-right: var(--space-32);
    padding-left: var(--space-32);
  }
}

@container homepage (min-width: 1920px) {
  .homepage__main {
    max-width: 75rem;
    padding-right: 2.5rem;
    padding-left: 2.5rem;
  }
}

.homepage__hero,
.homepage__inside,
.homepage__coffee {
  /* The drawn layer (ticket 221) sits behind the section's content and never above it. */
  position: relative;
  isolation: isolate;
}

.homepage__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-32) 0;
}

.homepage__tagline {
  position: relative;
  margin: var(--space-16) 0 0;
  font: var(--type-meta);
  color: var(--muted);
}

.homepage__tagline-text {
  display: inline-block;
}

/* The hand-written notes (Homepage card): decorative, never over text, muted unless they say otherwise. */
.homepage__note {
  position: absolute;
  font: var(--type-note);
  color: var(--muted);
  white-space: nowrap;
  pointer-events: none;
}

.homepage__note--accent {
  color: var(--accent-strong);
}

.homepage__aside {
  pointer-events: none;
}

.homepage__arrow {
  overflow: visible;
  fill: none;
  stroke: var(--muted);
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* "on us": above the line's right end on a phone, beside it from 744. */
.homepage__aside--us {
  position: absolute;
  top: 0;
  right: 0;
  left: auto;
}

.homepage__aside--us .homepage__note {
  top: -1.125rem;
  right: -0.25rem;
  transform: rotate(-6deg);
}

.homepage__aside--us .homepage__arrow {
  display: none;
}

@container homepage (min-width: 744px) {
  .homepage__aside--us {
    top: 0.0625rem;
    left: calc(100% + 0.25rem);
    right: auto;
  }

  .homepage__aside--us .homepage__note {
    top: 0;
    right: auto;
    left: 1.375rem;
  }

  .homepage__aside--us .homepage__arrow {
    display: block;
    margin-top: 0.4375rem;
  }
}

.homepage__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-12);
  margin-top: var(--space-24);
}

.homepage__buttons {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-12);
}

.homepage__inside {
  padding: var(--space-16) 0;
}

.homepage__coffee {
  margin-top: var(--space-16);
}

.homepage__heading {
  margin: 0 0 var(--space-16);
  font: var(--type-serif-heading);
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}
</style>

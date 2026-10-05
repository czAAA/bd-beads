<script setup lang="ts">
import { computed } from 'vue'
import { piecesOf } from '../../domain/pieces'
import { resolveProjectBead, type Project } from '../../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import IconButton from '../ui/IconButton.vue'
import CanvasColorPicker from './CanvasColorPicker.vue'
import ZoomControls from './ZoomControls.vue'

/**
 * The canvas box's header strip (ticket 143; CanvasStrip card): what is on the canvas, whether rulers show, and how far
 * it is zoomed. With no Frame it reads "Canvas · 3 pieces · no Frame" ("setting Frame" while one is being drawn); with a
 * Frame, "Project · 21 columns · 19 rows · 3.4 × 3.0 cm" While a picture
 * is being framed it shows the Project that picture will make instead; with nothing to show it holds just the title.
 */
const props = defineProps<{
  /** The open Project, whose pieces and Frame the strip describes. */
  project?: Project
  /** The size of the Project a framed picture will make (Convert image), shown in place of the Project's own. */
  size?: { columns: number; rows: number }
  zoomPercent?: number
  /** The zoom range the buttons stop at, when it isn't the Project canvas's (the framing step has its own). */
  zoomMinPercent?: number
  zoomMaxPercent?: number
  /** Shown while the Project has keyboard focus: "arrows move · space paints · esc leaves" (BeadCursor card). */
  hint?: string
  /** What is on the board, when it isn't the Project: the framing step names itself here (ConvertImage card). */
  title?: string
  /** Whether the Frame is being set right now ("3 pieces · setting Frame"). */
  settingFrame?: boolean
  /** Whether ruler numbers show (the Rulers toggle); undefined hides the button. */
  rulers?: boolean
  /** Whether the Canvas color button shows (ticket 252): with a Project open on the drawing area. Hidden in high contrast either way. */
  canvasColor?: boolean
}>()
const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  reset: []
  'toggle-rulers': []
}>()

const { t, locale } = useI18n()

const sizeText = (size: { columns: number; rows: number }) =>
  `${plural(locale.value, size.columns, t.value.canvas.columnsCount)} · ${plural(locale.value, size.rows, t.value.canvas.rowsCount)}`

const pieces = computed(() => (props.project ? piecesOf(props.project.beads, props.project.technique) : []))

/** The Project's measured size, "3.4 × 3.0 cm": an estimate from the Frame and the Bead (Estimated size). */
const estimate = computed(() => {
  const project = props.project
  const bead = project ? resolveProjectBead(project) : undefined
  if (!project?.frame || !bead) return undefined
  return formatSizeMm(estimatedSizeMm(project, bead), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value)
})

const framed = computed(() => !props.title && props.project?.frame !== undefined)

const heading = computed(() => props.title ?? (props.project ? (framed.value ? t.value.canvas.stripTitle : t.value.canvas.canvasTitle) : t.value.canvas.stripTitle))

const sizeMeta = computed(() => {
  if (props.size) return sizeText(props.size)
  const project = props.project
  if (!project) return undefined
  if (project.frame) return [sizeText(project.frame), estimate.value].filter(Boolean).join(' · ')
  return `${plural(locale.value, pieces.value.length, t.value.canvas.piecesCount)} · ${props.settingFrame ? t.value.canvas.settingFrame : t.value.canvas.noFrame}`
})
</script>

<template>
  <div class="canvas-strip" data-testid="canvas-strip">
    <AppIcon name="grid" :size="16" />
    <span class="canvas-strip__title" data-testid="canvas-strip-title">{{ heading }}</span>
    <span v-if="sizeMeta" class="canvas-strip__meta" data-testid="canvas-strip-size">{{ sizeMeta }}</span>
    <span v-if="hint" class="canvas-strip__hint" data-testid="canvas-strip-hint">{{ hint }}</span>
    <IconButton
      v-if="rulers !== undefined"
      class="canvas-strip__rulers"
      icon="ruler"
      variant="plain"
      :icon-size="16"
      :label="t.canvas.rulersLabel"
      :selected="rulers"
      data-testid="rulers-toggle"
      @click="emit('toggle-rulers')"
    />
    <CanvasColorPicker v-if="canvasColor" class="canvas-strip__color" />
    <ZoomControls
      v-if="zoomPercent !== undefined"
      class="canvas-strip__zoom"
      :zoom-percent="zoomPercent"
      :min-percent="zoomMinPercent"
      :max-percent="zoomMaxPercent"
      @zoom-in="emit('zoom-in')"
      @zoom-out="emit('zoom-out')"
      @reset="emit('reset')"
    />
  </div>
</template>

<style scoped>
.canvas-strip {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-12);
  box-sizing: border-box;
  height: var(--strip-height);
  padding: 0 var(--space-10) 0 var(--space-16);
  color: var(--ink);
  border-bottom: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
}

.canvas-strip__title {
  font: var(--type-control);
}

.canvas-strip__meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font: var(--type-meta);
  color: var(--box-muted);
  text-transform: lowercase;
  white-space: nowrap;
}

.canvas-strip__hint {
  min-width: 0;
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  font: var(--type-meta-small);
  color: var(--box-muted);
  text-transform: lowercase;
  white-space: nowrap;
}

.canvas-strip__hint + .canvas-strip__rulers,
.canvas-strip__hint + .canvas-strip__zoom {
  margin-left: 0;
}

/* The Rulers toggle sits first on the right; pressed is the IconButton's selected look: an `ink` fill with a `canvas` icon (CanvasStrip card). */
.canvas-strip__rulers {
  margin-left: auto;
}

.canvas-strip__color {
  margin-left: auto;
}

.canvas-strip__rulers + .canvas-strip__color,
.canvas-strip__hint + .canvas-strip__color {
  margin-left: 0;
}

.canvas-strip__color + .canvas-strip__zoom,
.canvas-strip__rulers + .canvas-strip__zoom {
  margin-left: 0;
}

.canvas-strip__zoom {
  /* Never squeezed out by the title, meta or hint: zoom out, zoom in and Fit stay on screen at 1024px (ticket 300). */
  flex: none;
  margin-left: auto;
}
</style>

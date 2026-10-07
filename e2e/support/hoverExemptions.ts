import type { InfoPopover } from './hoverSource'

/**
 * What the hover text check lets be (ticket 264). Each entry has a written reason; add one only with a reason a
 * reviewer would accept, and delete it when the thing it excuses is gone.
 */

const NATIVE = 'native, cannot be clipped'

/**
 * Native `title` attributes that show hover text today, as `file|what` (what names the text: the translation it reads,
 * or the expression). The browser draws them outside the page, so no ancestor can cut them off; they stay until a ticket
 * moves them onto the Tooltip, so that they get its look, its keyboard and touch way in, and this check's measuring.
 */
export const NATIVE_TITLES: Record<string, string> = Object.fromEntries(
  [
    'components/export/SaveBox.vue|t.saveBox.saveButton',
    'components/project/FrameControls.vue|t.size.lockedReason',
    'components/project/NewProjectForm.vue|limitsHint',
    'components/shell/AppHeader.vue|summarizeProject(activeProject)',
    'components/shell/PhoneSheets.vue|t.size.lockedReason',
    'components/tools/ContextBar.vue|t.frame.fitToDrawing',
    'components/tools/ContextBar.vue|t.frame.removeFrame',
    'components/tools/ContextBar.vue|rotateOff',
    'components/tools/MirrorControls.vue|t.mirror.decreaseLeftRightButton',
    'components/tools/MirrorControls.vue|t.mirror.increaseLeftRightButton',
    'components/tools/MirrorControls.vue|t.mirror.decreaseTopBottomButton',
    'components/tools/MirrorControls.vue|t.mirror.increaseTopBottomButton',
    'components/tools/MirrorControls.vue|t.mirror.copyModeLabel',
    'components/tools/MirrorControls.vue|t.mirror.mirrorCurrentHorizontalButton',
    'components/tools/MirrorControls.vue|t.mirror.mirrorCurrentVerticalButton',
    'components/tools/Toolbox.vue|t.size.lockedReason',
    'components/tools/Toolbox.vue|t.tools.removeLineButton',
    'components/tools/Toolbox.vue|t.deleteAll.confirmButton',
    'components/tour/TourLayer.vue|t.tour.backToLoomName',
    'components/ui/ProgressBar.vue|t.rowProgress.previousButton',
    'components/ui/ProgressBar.vue|t.rowProgress.nextButton',
  ].map((key) => [key, NATIVE]),
)

/**
 * The hand-made hover texts: info popovers, opened by click (or the info button's focus) rather than hover, whose own
 * `role="tooltip"` is not the shared Tooltip's. The text fit check measures them (ticket 229); the hover text check
 * only needs them listed once, here, and seen open. Another one made by hand is a failure of the source guard.
 */
export const INFO_POPOVERS: InfoPopover[] = [
  { file: 'components/project/NewProjectForm.vue', testid: 'new-project-estimate-tooltip' },
]

/**
 * Places in the source that make a Tooltip which no screen opens, by component name (or `info:<test id>`), each with
 * why. The first thing to try for one that is not seen open is a screen that reaches its state, in
 * e2e/visual/textFit.spec.ts; an exemption is for a Tooltip no state of the app can show.
 */
export const UNREACHED: Record<string, string> = {
  MirrorControls: 'not mounted anywhere in the app today (ticket 79 pulled it out of the Toolbox for a Mirror ToolSheet that is not built); only its own unit test renders it',
}

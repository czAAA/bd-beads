/** What the hover text check lets be (ticket 264): each entry needs a written reason a reviewer would accept; delete
 * it when moot. The source guards' lists are in src/testUtils/hoverExemptions.ts (ticket 552). */

// Places in the source that make a Tooltip no screen opens, by component name (or `info:<test id>`), each with why.
// First try a screen that reaches its state, in e2e/visual/textFit.spec.ts; an exemption is only for a Tooltip no app
// state can show.
export const UNREACHED: Record<string, string> = {
  AppMenuItem: 'ticket 439: a disabled item\'s reason Tooltip stopped being opened by any screen once the Colour sheet and Select all button went; not yet traced to the state that showed it, so a follow-up should add a screen for it and delete this entry',
  // A false positive of the source scan (TOOLTIP_MAKERS treats every IconButton as one): the notice row's close
  // button (AppMessage.vue) gives IconButton neither `tooltip` nor `action`, so IconButton's own tooltipProps is
  // always undefined there -- it renders a plain button, never AppTooltip. Nothing a screen could ever open.
  AppMessage: 'the close button (its only IconButton) is given neither `tooltip` nor `action`, so IconButton never renders a Tooltip there (see IconButton.vue tooltipProps): a source-scan false positive, not a state to reach',
}

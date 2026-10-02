/** The attribute on the Tour's step card, so a modal, sheet or drawer that traps focus can tell the card isn't "outside" it (ticket 80). */
export const TOUR_CARD_ATTRIBUTE = 'data-tour-card'

/** Whether a node is inside the Tour's step card; the dialogs' focus traps and press-outside-to-close leave the card alone. */
export function inTourCard(node: Node | EventTarget | null): boolean {
  return node instanceof Element && node.closest(`[${TOUR_CARD_ATTRIBUTE}]`) !== null
}

// The margin sheet's sizes (MarginSheet card, ticket 0683): one source for its form rule, the canvas that
// draws it and the controls laid over it. Their CSS twins (design-values.css, bundle.css, tokens.json) are held to these
// by marginSizes.test.ts.

/** The margin sheet's px at scale 1, which `marginScale` multiplies (ticket 0698). The compact places serve the folded
 * form too. */
export const MARGIN_PX = {
  /** The drafting sheet's band, where the scale is 1, and the scale's bounds (ticket 0698). The least is 1 (ticket 0851):
   * the sheet's smallest words, the name tab's 11px, and its smallest buttons, the compact tools, Row done, the tab and
   * the Move bar at 24px, are `legible` there and no smaller; under it the sheet changes form. The Homepage demo's is
   * 0.6: its view is set for its box and its tour presses the band, so its sheet shrinks rather than go bare. */
  scale: { band: 72, min: 1, max: 1.5, demo: 0.6 },
  /** The least the sheet's words and buttons are drawn at on screen (ticket 0851, accessibility.md): smaller, they are
   * specks no one reads or hits. */
  legible: { text: 11, button: 24 },
  /** The band height, at scale 1, from which each form fits (MarginSheet card, Zoom forms; ticket 0682 for folded). */
  band: {
    /** The full form's two-row title block, 10px in, clear of the Frame's line. */
    full: 68,
    /** The compact row, 8px in, clear of the Frame's line; under it the sheet folds. */
    compact: 40,
    /** The folded row, 24px, between the sheet's edge and the Frame's line; under it the sheet is bare. */
    folded: 31,
  },
  /** The band's row down from the sheet's top and in from its sides, and the inner border's inset. */
  place: { full: { top: 14, side: 14, border: 10 }, compact: { top: 8, side: 10, border: 6 } },
  /** The sheet's outer corners. */
  sheetRadius: { full: 12, compact: 10 },
  /** The inner border's corners. */
  borderRadius: 6,
  /** A tool in the full form's row, and that row's height. */
  tool: 28,
  /** The folded title block's name tab, the Move bar outside the full form, and the compact and folded row's height. */
  tab: 24,
  /** The Move bar's hit area, the gutter handle's width. */
  moveWidth: 56,
  /** Between the band's Row progress, Move bar and tools. */
  gap: 4,
  /** A tool's icon. */
  icon: { full: 16, compact: 14 },
  /** The current pass's mark (ticket 0685): the pill's room round its number, and the tick's thickness. */
  pass: { pillPad: 2, tick: 3 },
} as const

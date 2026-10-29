// The margin sheet's sizes in screen px (MarginSheet card, ticket 0683): one source for its form rule, the canvas that
// draws it and the controls laid over it. Their CSS twins (design-values.css, bundle.css, tokens.json) are held to these
// by marginSizes.test.ts.

/** The margin sheet's screen px. The compact places serve the folded form too. */
export const MARGIN_PX = {
  /** The band height from which each form fits (MarginSheet card, Zoom forms; ticket 0682 for folded). */
  band: {
    /** The full form's two-row title block, 10px in, clear of the Frame's line (about 85%). */
    full: 68,
    /** The compact row, 8px in, clear of the Frame's line; under it the sheet folds (about 50%). */
    compact: 40,
    /** The folded row, 24px, between the sheet's edge and the Frame's line (about 39%); under it the sheet is bare. */
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
} as const

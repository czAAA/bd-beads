// The margin sheet's sizes (MarginSheet card, ticket 0683): one source for its form rule, the canvas that
// draws it and the controls laid over it. Their CSS twins (design-values.css, bundle.css, tokens.json) are held to these
// by marginSizes.test.ts.

/** The margin sheet's px at scale 1, which `marginScale` multiplies (ticket 0698). The compact places serve the folded
 * form too. */
export const MARGIN_PX = {
  /** The drafting sheet's band, where the scale is 1 (80, ticket 1213; 72 until then), and the scale's bounds (0698). The
   * least is 1 (0851), where the smallest words' 11px and the 24px compact tools, chips, Row done and Move bar are `legible`;
   * the Homepage demo's 0.6, as its tour presses the band in a view it cannot grow. */
  scale: { band: 80, min: 1, max: 1.5, demo: 0.6 },
  /** The least the sheet's words and buttons are drawn at on screen (ticket 0851, accessibility.md): smaller, they are
   * specks no one reads or hits. */
  legible: { text: 11, button: 24 },
  /** The band height, at scale 1, from which each form fits (MarginSheet card, Zoom forms; ticket 0682 for folded). */
  band: {
    /** The full form (ticket 1213): its two-row foot (tickets 1176, 1258), 12px up, the 24px facts and the 26px strip,
     * stands clear of the Frame's line and its outset. */
    full: 80,
    /** The compact form's two-row foot (tickets 1197, 1258): from here the legend stands over Row progress; under it
     * they share one line. 10px in, the 14px legend, a finger's 8px, the 24px strip and the 7px the Frame's line and its
     * outset keep, with room over. */
    stacked: 68,
    /** The compact row, 8px in, clear of the Frame's line; under it the sheet folds. */
    compact: 40,
    /** The folded row, 24px, between the sheet's edge and the Frame's line; under it the sheet is bare. */
    folded: 31,
  },
  /** The band's row down from the sheet's top and in from its sides, and the inner border's inset. */
  place: { full: { top: 14, side: 14, border: 10 }, compact: { top: 8, side: 10, border: 6 } },
  /** The foot's inset from the sheet's sides and bottom edge (ticket 1258): clear inside the border; compact as the
   * band's. */
  foot: { full: { side: 14, bottom: 12 }, compact: { side: 10, bottom: 10 } },
  /** The sheet's outer corners. */
  sheetRadius: { full: 12, compact: 10 },
  /** The inner border's corners. */
  borderRadius: 6,
  /** The Frame's name in the band at its least, cut with an ellipsis, and what stands between it and Expand the Frame
   * (ticket 1258). */
  nameLeast: 80,
  nameGap: { mouse: 4, touch: 12 },
  /** A tool in the full form's row, and that row's height. */
  tool: 28,
  /** The Move bar outside the full form, and the compact and folded row's height. */
  tab: 24,
  /** Row progress's strip in the foot (ticket 1176). */
  strip: 26,
  /** The Move bar's hit area, the gutter handle's width. */
  moveWidth: 56,
  /** Between the band's Row progress, Move bar and tools. */
  gap: 4,
  /** A tool's icon. */
  icon: { full: 16, compact: 14 },
  /** The current pass's mark (ticket 0685): the pill's room round its number, and the tick's thickness. */
  pass: { pillPad: 2, tick: 3 },
  /** Expand the Frame (MarginSheet card, tickets 1169, 1260): the room round its line where no numbers stand
   * (`inset`, smaller under bp-tablet), the room between the numbers and the line (`numbers`), and the bead pitch its
   * rows are woven at, smaller in a drawing area up to `narrowAt` wide. */
  expanded: { inset: { full: 6, compact: 4 }, numbers: 3, pitch: { wide: 28, narrow: 26 }, narrowAt: 1500 },
} as const

import type { PluralForms } from '../plural'

/** What the PDF and PNG exports print, Beads needed among it. */
export interface PrintTranslations {
  quantities: {
    heading: string
    noProjectMessage: string
    noColorsMessage: string
    colorHeading: string
    countHeading: string
    /** The grams column's heading and the unit after each weight (g / г). */
    weightHeading: string
    gramsUnit: string
    totalLabel: string
    showAll: string
    showFewer: string
    /** The Estimated weight's Info button body (tickets 155, 328, 0852); `{grams}` is the Bead's average weight of one bead. */
    weightInfo: string
    /** The accessible name of that Info button, in Beads needed's header (ticket 0852). */
    weightInfoLabel: string
    /** Under the table on a Kaleidocycle (ticket 0876): the counts are one face, `{count}` the whole piece's total. */
    pieceTotal: string
    /** The whole piece's lines under a Kaleidocycle's counts (ticket 0877): its triangles and the beads that join them. */
    pieceLines: Record<'triangles' | 'edgeBeads' | 'hingeBeads' | 'tips' | 'hingePins', string>
    /** Under the table on a Star (ticket 0875): the counts are the whole star, front and back. */
    frontBackNote: string
    /** Under the rows when a color has no catalog code (ticket 0974): they are Palette colors, not beads to buy. */
    paletteNote: string
    /** Why, behind the header's Info button (ticket 0974), after the weight's line when there is one. */
    paletteInfo: string
    /** The header Info button's name once it says why too (ticket 0974); `weightInfoLabel` while it explains the weight only. */
    infoLabel: string
  }
  /** What the PDF and PNG exports print (tickets 162–164; printed-output.md, `writing.md`). */
  print: {
    /** "60×80 · TOHO Cube 1.5mm · ≈ 9 × 12 cm" */
    metaLine: string
    /** The same line for a Bead with no Estimated size: "60×80 · Unknown bead". */
    metaLineNoEstimate: string
    /** On page 1, when the chart is split over pages. */
    readParts: string
    /** The Beads needed line that stands in for the table when it does not fit (ticket 0580). */
    beadsNeededSee: string
    columnColor: string
    columnCode: string
    columnBeads: string
    columnGrams: string
    /** A part's pill on page 1: "part A · page 2", and the short form for a narrow part. */
    partPage: string
    partPageShort: string
    beadsNeeded: string
    total: string
    /** Beads needed's two columns. */
    beadsGrams: string
    beadsCount: PluralForms
    /** Under the Total: how the grams are worked out. */
    gramsNote: string
    spares: string
    noColors: string
    /** On the PNG: "by Maria". */
    byMaker: string
    /** A part's label above its board (ticket 578): "Part B · columns 101–130 · rows 1–100". */
    partArea: string
    continuesBoth: string
    continuesRight: string
    continuesBelow: string
    /** A sheet whose parts continue on the next sheet, not to the right or below. */
    continuesOn: string
    lastPart: string
    /** The heading over a chart page's color key. */
    keyOnPage: string
    /** The line on how the numbers on a chart page read. */
    /** The Word chart pages (tickets 0574, 0586): words only, letters and numbers are not translated. */
    wordChart: {
      title: string
      /** The key's item for an empty position, next to `*`. */
      empty: string
      /** The footer where the rows go on: "Rows 83–120 on page 8 →". */
      nextRows: string
      /** Where the first row is, by its number (`row`): the printed ruler's, 1 unless the rows are worked from the bottom or
       * the right (ticket 1129). */
      firstTop: string
      firstRight: string
      firstBottom: string
      firstLeft: string
      loomRead: string
      evenCount: string
      oddCount: string
      sides: string
      runNote: string
      /** Where a Custom frame's Word chart starts, by its Row order (ticket 0594). */
      firstCentre: string
      firstPoint: string
      firstBase: string
      partsThenJoins: string
      /** A Kaleidocycle's note (ticket 0876): the chart is one face, and each other face is a Frame of its own. */
      faceNote: string
      /** What a round's corner pair and a side's end look like in it (ticket 0873). */
      pairNote: string
      /** What a Kite row's middle pair, its spine pair, looks like in it (ticket 0874). */
      middlePairNote: string
    }
  }
}

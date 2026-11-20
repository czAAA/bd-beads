import type { PluralForms } from '../plural'

/** The Canvas, Row progress and removing a line. */
export interface CanvasTranslations {
  canvas: {
    zoomInLabel: string
    zoomOutLabel: string
    zoomResetLabel: string
    /** A Project with no Frame, in the Saved Projects list ("no Frame"). */
    noFrame: string
    /** The Rulers toggle's name (Rulers card). */
    rulersLabel: string
    rotateCanvasLabel: string
    announceCanvasRotated: string
    /** The Canvas color button's name and the picker's label (CanvasBackground card), the swatch name ("Stone, 3 of
     * 5") and the ten background names. */
    canvasColor: {
      label: string
      pickerLabel: string
      swatchLabel: string
      names: Record<'studio' | 'stone' | 'pebble' | 'night' | 'ink' | 'slate', string>
    }
    /** The hint in the drawing area's bottom-left corner (CanvasHint card), in pieces around its key chips. */
    hint: {
      scrollOr: string
      spaceKey: string
      dragToMove: string
      scrollToZoom: string
      hand: string
      rulers: string
      /** The keyboard line's last part (ticket 1064): how the Radial toolbox opens with a mouse. */
      rightClickForTools: string
      holdCanvasForTools: string
      /** On touch (ticket 0846): the line in finger words, with no key chips. */
      twoFingersToMove: string
      pinchToZoom: string
      /** On touch (ticket 0927): a half-second hold on a button shows its Tooltip. */
      holdForName: string
    }
    /** The welcome over an empty Project (FirstRunHints card, tickets 0795, 0798 and 0920): its quiet line on where
     * Projects are kept, and its lead line off touch, the Paint tool's Tooltip (`tooltips.paint`) in mouse words. */
    firstRun: {
      storage: string
      paintMouse: string
    }
  }
  rowProgress: {
    enabledLabel: string
    directionButton: string
    highlightButton: string
    resetButton: string
    resetConfirmTitle: string
    resetConfirmMessage: string
    resetConfirmCancel: string
    positionLabel: string
    previousButton: string
    nextButton: string
    /** The same two buttons while rows run down the columns (ticket 411): the weaver works a column at a time. */
    columnPreviousButton: string
    columnNextButton: string
    /** The success toast after Turn row direction names the direction the rows now run. */
    directionToastRows: string
    directionToastColumns: string
    directionToastRowsReversed: string
    directionToastColumnsReversed: string
    /** The Frame's own rows or columns as seen across, the Frame or the Canvas turned a quarter (ticket 1101). */
    directionToastRowsLeftToRight: string
    directionToastRowsRightToLeft: string
    directionToastColumnsTopToBottom: string
    directionToastColumnsBottomToTop: string
    /** The Progress bar's meta after "Row 12": "of {total} · {direction}" (ticket 144). */
    ofTotal: string
    topToBottom: string
    leftToRight: string
    bottomToTop: string
    rightToLeft: string
    /** The progress track's accessible name. */
    finishedLabel: string
    /** A Custom frame's pass (ticket 0594): a round, a row, a part's round, a strand (ticket 0597) or a join, `{parts}`
     * as `1–2`. */
    stepRound: string
    stepStrand: string
    stepRow: string
    stepPartRound: string
    stepZip: string
    /** A Kaleidocycle's joins (ticket 0877): a triangle's Strip and Tetra, a Mirror pair, two pairs joined into the ring. */
    stepTetra: string
    stepPair: string
    stepRing: string
    stepClose: string
    ofSteps: string
    stepOfSteps: string
    /** The toast when rows marked done take a drawing back (ticket 0848), naming Back a row, or Back a column (ticket 0972). */
    markedDoneToast: string
    columnMarkedDoneToast: string
    /** The counter's Tooltip where a line takes two passes (peyote, ticket 0849): what it counts, passes, not rows. */
    passesBody: string
    columnPassesBody: string
    /** After the counter there: the rulers' row of the pass, "3/27 · row 2". */
    passLine: string
    columnPassLine: string
    /** The counter once every pass is done (ticket 0849), with a check, and the Tooltip of it and of the greyed Row done. */
    patternDone: string
    everyRowDone: string
    everyColumnDone: string
    /** The track's accessible name while rows run down the columns. */
    columnFinishedLabel: string
    /** After the Turn row direction toast, while the way left has rows marked done: they are kept, not lost. */
    rowsKeptToast: string
    columnsKeptToast: string
    /** Go to row (ticket 0849): the counter opens it; a field for the row (or the pass, on peyote) and Go. */
    goToRow: string
    goToColumn: string
    goToRowBody: string
    goToColumnBody: string
    passLabel: string
    columnLabel: string
    goButton: string
    /** The Turn row direction toast with the kept sentence after it: `{toast} {kept}`, with no space in Chinese. */
    directionKeptToast: string
    /** The Go to row Tooltip on a Kaleidocycle (ticket 0876): the triangles here are this face's, `{then}` its usual sentence. */
    faceBody: string
    /** The counter, and what the announcer says after Back a row, Row done and Go to row (tickets 0934, 0972): "Row 7
     * of 10" (`unit` is Row, Column or Pass), and on peyote that `step` with the rulers' row, "Pass 3 of 27, row 2". */
    announcePosition: string
    announcePass: string
    announceColumnPass: string
    /** Go to row's button that brings the current row back into view after the beader panned away (ticket 0934). */
    showRow: string
    showColumn: string
    /** Go to row's name where it counts passes, on peyote and a Custom frame (ticket 0972): one noun with the counter. */
    goToPass: string
    /** The name of Go to row's Info button that holds the passes sentence on peyote (ticket 0972). */
    passesInfoName: string
    /** Turn row direction's list (ticket 0973): its Switch that shows and hides the ring and the number pill, Row highlight. */
    showRowMarks: string
    /** Go to row's line under its field when the number typed doesn't exist, the field's description (ticket 0980). */
    goToRange: string
  }
  /** Remove row/column's question where it touches finished rows (ticket 0647), worded for rows or columns as the rows
   * run: `{number}` is the line's number the way the rows run, `{backTo}` the row Row progress shows after. */
  removeLine: {
    rowTitle: string
    columnTitle: string
    finishedRow: string
    finishedColumn: string
    rowsShift: string
    columnsShift: string
    acrossRows: PluralForms
    acrossColumns: PluralForms
    confirmButton: string
    cancelButton: string
  }
}

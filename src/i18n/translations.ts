import type { PluralForms } from './plural'

export type Locale = 'en' | 'ru'

export interface Translations {
  app: {
    title: string
  }
  form: {
    nameLabel: string
    beadLabel: string
    techniqueLabel: string
    techniqueLoom: string
    techniquePeyote: string
    techniqueBrick: string
    widthLabel: string
    heightLabel: string
    unitLabel: string
    /** The unit a Pattern's size can be stated in when it is a count of beads (ADR 0017) — the default. */
    unitBeads: string
    unitMm: string
    unitCm: string
    submit: string
    /** Right of an optional field's label (TextField card). */
    optional: string
    /** Field errors say what to enter (`writing.md`, Field error). */
    enterWidth: string
    enterHeight: string
    enterWholeBeads: string
    /** Under Convert image while it waits for a size. */
    enterSizeFirst: string
    /** Between Create Pattern and Convert image. */
    or: string
    /** Beside Unit: the stated size in the other unit, "≈ 40×30 beads". */
    estimateBeads: string
  }
  /** Keyboard and screen-reader words (ticket 159; `accessibility.md`, ScreenReaders card). */
  a11y: {
    skipToPattern: string
    toolsLandmark: string
    /** Announced as the bead cursor moves. */
    cursorPosition: string
    /** Announced after Space or Enter uses the current tool. */
    painted: string
    filled: string
    erased: string
    emptyBead: string
    /** The Pattern's accessible name: "{name}, {columns} by {rows} beads, {colors}" plus, with Row progress on, the progress. */
    patternLabel: string
    colorsCount: PluralForms
    progressDone: string
    /** Shown in the canvas strip while the Pattern has keyboard focus. */
    keyboardHint: string
    /** A message's close ×. */
    closeMessage: string
    /** An expandable panel's expand button (BeadsNeeded, SavedPatterns cards). */
    expandPanel: string
    collapsePanel: string
  }
  /** The Palette's color names (`writing.md`, Color names). */
  colorNames: Record<string, string>
  /** The header's theme control (ticket 139). */
  theme: {
    groupLabel: string
    matchDevice: string
    light: string
    dark: string
    contrast: string
  }
  languageSwitcher: {
    ariaLabel: string
    /** EN / RU's accessible name: what pressing it does, in the language it switches from. */
    switchLabel: string
  }
  patterns: {
    heading: string
    newPatternButton: string
    removeButton: string
    currentLabel: string
    unknownBeadLabel: string
    noSavedPatternsMessage: string
    /** Saved Patterns' meta: how many of the library the box shows ("5 of 12"). */
    shownOf: string
  }
  canvas: {
    zoomInLabel: string
    zoomOutLabel: string
    zoomResetLabel: string
    /** The canvas strip's title (ticket 143). */
    stripTitle: string
    /** The strip's size meta, "40 columns · 30 rows": each count in its plural form, joined by a spaced middle dot. */
    columnsCount: PluralForms
    rowsCount: PluralForms
  }
  shell: {
    /** Under 'No Pattern open yet': what to do (EmptyCanvas card). */
    canvasPlaceholderHint: string
    canvasPlaceholder: string
  }
  /** Storage's own voice in the UI: what it says when a write to this device didn't get through (ticket 55). */
  storage: {
    saveFailedMessage: string
  }
  palette: {
    pickerLabel: string
    colorLabel: string
    undoButton: string
    redoButton: string
    rotateButton: string
    /** CONTEXT.md's Custom color glossary entry: the native-picker slot at the end of the Colors group. */
    customColorLabel: string
  }
  tools: {
    paintLabel: string
    fillLabel: string
    selectLabel: string
    /** The 4th Tool group member (ticket 89): flood-erases a clicked region's connected same-color cells. */
    eraseLabel: string
    copyButton: string
    /** The Edit group's Save (ticket 115): reassurance that the edit is on this device, not a new kind of storage (ADR 0012). */
    saveButton: string
    /** The brief confirmation Save shows once storage took the write. */
    savedConfirmation: string
    /** Ctrl/Cmd+V (ticket 92) has no Toolbox button of its own — only the shortcuts help overlay (ticket 96) names it. */
    pasteLabel: string
    /** The Tools-group button next to Erase (ticket 123): removes the selected whole row/column, enabled only while the Selection is exactly one. */
    removeLineButton: string
    /** Its link text under the tool tabs (ToolTabs card); the full name stays its tooltip. */
    removeLineShort: string
  }
  /** The row and column rulers (ticket 123): each number is now a button that selects that whole line, the same Selection a Select-tool drag across it would leave. */
  rulers: {
    /** `{number}` is the 1-based row/column number shown. */
    selectRowLabel: string
    selectColumnLabel: string
  }
  rowProgress: {
    enabledLabel: string
    directionButton: string
    positionLabel: string
    previousButton: string
    nextButton: string
    /** The Progress bar's meta after "Row 12": "of {total} · {direction}" (ticket 144). */
    ofTotal: string
    topToBottom: string
    leftToRight: string
    /** The progress track's accessible name. */
    finishedLabel: string
  }
  quantities: {
    heading: string
    noPatternMessage: string
    noColorsMessage: string
    colorHeading: string
    countHeading: string
    /** The grams column's heading and the unit after each weight (g / г). */
    weightHeading: string
    gramsUnit: string
    totalLabel: string
    /** The info icon's accessible name; its tooltip is `weightInfo`. */
    weightInfoButton: string
    /** The Estimated weight tooltip (ticket 155); `{grams}` is the Bead's average weight of one bead. */
    weightInfo: string
  }
  /** Export/import (CONTEXT.md's Pattern file), plus QR export/import (ticket 68, ADR 0015). */
  /** What the PDF and PNG exports print (tickets 162–164; printed-output.md, `writing.md`). */
  print: {
    /** "60×80 · TOHO Cube 1.5mm · ≈ 9 × 12 cm" */
    metaLine: string
    /** On page 1, when the chart is split over pages. */
    readParts: string
    beadsNeeded: string
    total: string
    /** Beads needed's two columns. */
    beadsGrams: string
    beadsCount: PluralForms
    /** Under the Total: how the grams are worked out. */
    gramsNote: string
    spares: string
    noColors: string
    madeBy: string
    technique: string
    bead: string
    size: string
    estimatedSize: string
    /** On the PNG: "by Maria". */
    byMaker: string
    page: string
    part: string
    /** A part on a sheet it shares with others (ticket 163): "Part 2 · columns 39–76". */
    partColumns: string
    partRows: string
    continuesBoth: string
    continuesRight: string
    continuesBelow: string
    lastPart: string
  }
  /** The save box (ticket 148; SaveBox and SaveStates cards). */
  saveBox: {
    saveButton: string
    exportButton: string
    /** The label row: the library's save state on this device. */
    savedState: string
    failedState: string
    menuQr: string
    menuPng: string
    menuPdf: string
    formatsHint: string
    /** While an export is drawn (Loading card): what is happening, to which Pattern. */
    makingPng: string
    makingPdf: string
    /** The way out when a Pattern is too large for a QR code, or a save fails: the Pattern as a file. */
    exportPatternFile: string
    /** The Export menu's last row and its modal (NameOnExports card). */
    nameOnExports: string
    nameNotSet: string
    changeName: string
    addName: string
    yourName: string
    nameHint: string
    saveName: string
    cancelName: string
  }
  transfer: {
    /** Under the QR code: how to use it (QrExport card). */
    qrScanHint: string
    exportPatternButton: string
    exportLibraryButton: string
    importLabel: string
    importedLabel: string
    importErrorLabel: string
    /** Encodes the open Pattern as a single scannable QR code (compact encoding, ADR 0009), shown inline below. */
    exportQrButton: string
    /** Shown instead of the code when the Pattern doesn't fit a single QR code's capacity (ADR 0015's size cap) -- points at Export Pattern above as the fallback rather than duplicating a download of its own. */
    qrTooLargeMessage: string
    /** Picture and print exports of the open Pattern (tickets 73, 74). */
    exportPngButton: string
    exportPdfButton: string
    /** With {page} and {pages}. */
    /** With {across}, {acrossTotal}, {down} and {downTotal}: which piece of a chart cut over several pages this is. */
    closeQrButton: string
    /** A picture believed to hold one of this app's QR exports (a photo/screenshot of the code shown on another device). */
    importQrLabel: string
    qrImportedLabel: string
    qrImportErrorLabel: string
  }
  mirror: {
    mirrorCurrentHorizontalButton: string
    mirrorCurrentVerticalButton: string
    /** The two per-direction axis counters (ticket 44), named for what they do on screen -- rotating the Pattern
     * swaps which grid axis each shows. */
    leftRightLabel: string
    topBottomLabel: string
    decreaseLeftRightButton: string
    increaseLeftRightButton: string
    decreaseTopBottomButton: string
    increaseTopBottomButton: string
    /** Mirror's copy-mode switch (ticket 45): one switch for both directions. */
    copyModeLabel: string
    /** The Mirror row's line holding the two Mirror current buttons (ticket 75). */
    mirrorCurrentLabel: string
  }
  /** Titles of the Toolbox's five Tool groups (CONTEXT.md), shown in each group's top-left corner (ticket 40). */
  toolbox: {
    groups: {
      tools: string
      colors: string
      edit: string
      mirror: string
      size: string
      rowProgress: string
    }
  }
  /**
   * The Size Tool group (CONTEXT.md's Estimated size and Resize, ADR 0017): the open Pattern's estimate, and the rows
   * and columns inputs that change it. "Columns" and "Rows" are as seen on screen, so rotating the Pattern swaps which
   * of the grid's two directions each one drives.
   */
  size: {
    /** Names the Estimated size readout for assistive technology. */
    estimateLabel: string
    /** The info icon's accessible name; its tooltip is `estimateWarning`. */
    estimateInfoButton: string
    /** The warning tooltip on the Estimated size: it is a guide, not a measurement. */
    estimateWarning: string
    columnsLabel: string
    rowsLabel: string
    /** The −/+ buttons either side of each count (ticket 123, matching Mirror's axis-counter look): one row/column at a time, from whichever end "change from" points at. */
    decreaseColumnsButton: string
    increaseColumnsButton: string
    decreaseRowsButton: string
    increaseRowsButton: string
    /** Prefix of the "change from: end | start" choice, one per direction. */
    changeFromLabel: string
    fromEnd: string
    fromStart: string
    /** Hover text on the counters while Row progress is on and they are disabled. */
    lockedReason: string
    /** Stated near the rows input while it moves in steps of 2 (peyote and brick stitch, from the start). */
    pairsHint: string
  }
  /** The Delete all control (CONTEXT.md) and its confirmation modal (ticket 42). */
  /** Change size (ticket 153): the Size group's button and the modal that sets the grid in beads, mm or cm. */
  changeSize: {
    button: string
    title: string
    columnsLabel: string
    rowsLabel: string
    /** A beads-to-beads change; `{from}` and `{to}` are "columns × rows". */
    messageBeads: string
    /** A mm/cm change; `{from}` and `{to}` are in beads, `{size}` is "width × height" and `{unit}` the chosen unit. */
    messagePhysical: string
    shrinkWarning: string
    problemEmpty: string
    problemNotANumber: string
    problemNotPositive: string
    problemNotWhole: string
    problemNoBead: string
    confirmButton: string
    cancelButton: string
  }
  /** Importing while a Pattern is open asks first whether to switch to what came in (ticket 154). */
  importSwitch: {
    title: string
    /** `{current}` and `{imported}` are Pattern names. */
    messageOne: string
    /** `{count}` Patterns came in, and `{imported}` is the one that would open. */
    messageMany: string
    /** The open Pattern's last save didn't get through. */
    unsavedMessage: string
    switchButton: string
    switchAnywayButton: string
    keepButton: string
    saveButton: string
  }
  deleteAll: {
    button: string
    confirmTitle: string
    confirmMessage: string
    confirmButton: string
    cancelButton: string
  }
  /**
   * Convert image (CONTEXT.md, ADR 0010/0011): the file input in the New Pattern form, the framing step that takes the
   * canvas panel over, and Image colors in the Colors group.
   *
   * Every string here holding `{formats}`, `{maxSizeMb}` or `{maxMegapixels}` is filled in by formatImageLimits (see
   * domain/imageConversion.ts) from the very constants the validation enforces, so the limits the UI advertises and the
   * limits it applies cannot drift apart. Never write the numbers out here.
   */
  convertImage: {
    /** While a chosen picture is read (Loading card). */
    readingPicture: string
    /** The file input's own label in the New Pattern form. */
    fileLabel: string
    /** The limits, shown as helper text under the file input and repeated as its `title`. */
    limitsHint: string
    /**
     * The heads-up shown once the current Bead + Technique + size implies a grid past that Technique's
     * isSlowFramingSize threshold (ticket 61) — informational, not an error, and never blocks the file input.
     * `{technique}` is filled in with the chosen Technique's own localized name (form.techniqueLoom etc).
     */
    slowFramingWarning: string
    /** The framing step's heading in the canvas panel. */
    heading: string
    /** How to move the picture under the frame. */
    panHint: string
    createButton: string
    cancelButton: string
    /** The adjustable ceiling on how many colors the conversion may keep. */
    maxColorsLabel: string
    decreaseColorsButton: string
    increaseColorsButton: string
    /** Prefix for how many colors this conversion actually found, e.g. "Colors found: 6". */
    foundColorsLabel: string
    /** Names the Image colors swatches in the Colors group (CONTEXT.md's Image colors). */
    imageColorsLabel: string
    /** Why Image colors is off: the Pattern wasn't made from a picture (ColorPickers card). */
    noImageColors: string
    /** One per reason a picture can be turned away (see domain/imageConversion.ts's ImageRejection). */
    errors: {
      heic: string
      svg: string
      unsupportedFormat: string
      tooLarge: string
      tooManyPixels: string
      decodeFailed: string
    }
  }
  /** The Replace Bead control (CONTEXT.md, ADR 0017) next to the open Pattern's Bead, and its confirmation modal (ticket 48). */
  replaceBead: {
    selectLabel: string
    confirmTitle: string
    /**
     * `{bead}` is the new Bead's label, `{new}` and `{old}` the Estimated size with it and with the current one (e.g.
     * "3.3 × 6.6 cm"). Says the size changes, the design and its bead count don't, and that rows and columns can be
     * adjusted afterwards to get the size back.
     */
    confirmMessage: string
    confirmButton: string
    cancelButton: string
  }
  /** The `?` shortcuts help overlay (ticket 96): every keyboard shortcut, grouped by Tool group. Key labels
   * themselves (digits, letters, "Ctrl/Cmd+C") are locale-neutral and built inline in ShortcutsHelp.vue rather than
   * translated here — only the description of what each one does needs a translation. */
  shortcutsHelp: {
    title: string
    closeButton: string
    /** Ticket 90: Del either activates Erase or clears the active Selection, depending on context. */
    eraseOrClearSelection: string
    /** Ticket 95: Space+drag. */
    panCanvas: string
    /** Ticket 88's whole Colors group, summarized as one row rather than one per swatch. */
    paletteColors: string
  }
}

import type { Locale } from '../domain/locale'
import type { TourStepId } from '../domain/tour'
import type { PluralForms } from './plural'

export type { Locale }

/** One Overview feature; `tabName` and `tabLine` are shorter wordings for the carousel tab where the full ones don't fit. */
interface FeatureCopy {
  name: string
  text: string
  tabName?: string
  tabLine?: string
}

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
    /** Stepper buttons beside Width and Height (ticket 181), each named for screen readers like Stepper's own. */
    decreaseWidthButton: string
    increaseWidthButton: string
    decreaseHeightButton: string
    increaseHeightButton: string
    unitLabel: string
    /** The unit a Project's size can be stated in when it is a count of beads (ADR 0017) — the default. */
    unitBeads: string
    unitMm: string
    unitCm: string
    /** This Project's own maker's name (ticket 182), overriding the device-wide one; blank by default. */
    makerNameLabel: string
    makerNamePlaceholder: string
    submit: string
    /** Right of an optional field's label (TextField card). */
    optional: string
    /** Field errors say what to enter (`writing.md`, Field error). */
    enterWidth: string
    enterHeight: string
    enterWholeBeads: string
    /** Under Convert image while it waits for a size. */
    frameLabel: string
    frameHint: string
    convertNeedsFrame: string
    /** Between Create Project and Convert image. */
    or: string
    /** Beside Unit: the stated size in the other unit, "≈ 40×30 beads". */
    estimateBeads: string
    /** The Unit picker's conversion row info tooltip trigger's accessible name (ticket 179). */
    sizeConversionInfoButton: string
    /** The conversion row's tooltip: it is a mathematical estimate, and a real result may differ (ticket 179). */
    sizeConversionInfo: string
  }
  /** Keyboard and screen-reader words (ticket 159; `accessibility.md`, ScreenReaders card). */
  a11y: {
    skipToProject: string
    toolsLandmark: string
    /** Announced as the bead cursor moves. */
    cursorPosition: string
    /** Announced after Space or Enter uses the current tool. */
    painted: string
    filled: string
    erased: string
    emptyBead: string
    /** The Project's accessible name: "{name}, {columns} by {rows} beads, {colors}" plus, with Row progress on, the progress. */
    projectLabel: string
    /** The Project's name for a screen reader while it has no Frame: an open canvas, with no size to state. */
    canvasLabel: string
    colorsCount: PluralForms
    progressDone: string
    /** Shown in the canvas strip while the Project has keyboard focus. */
    keyboardHint: string
    /** A message's close ×. */
    closeMessage: string
    /** An expandable panel's expand button (BeadsNeeded, SavedProjects cards). */
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
  projects: {
    heading: string
    newProjectButton: string
    removeButton: string
    unknownBeadLabel: string
    noSavedProjectsMessage: string
    /** Saved Projects' meta: how many of the library the box shows ("5 of 12"). */
    shownOf: string
  }
  canvas: {
    zoomInLabel: string
    zoomOutLabel: string
    zoomResetLabel: string
    /** Announced once when Alt + an arrow key moves the Zoom pill (ticket 302), (ticket 321: no corner to name any more). */
    zoomPillMovedAnnouncement: string
    /** The canvas strip's title (ticket 143). */
    stripTitle: string
    /** The strip's size meta, "40 columns · 30 rows": each count in its plural form, joined by a spaced middle dot. */
    columnsCount: PluralForms
    rowsCount: PluralForms
    /** The strip's title while the canvas has no Frame (CanvasStrip card, v16). */
    canvasTitle: string
    /** "3 pieces": how many Pieces the canvas holds. */
    piecesCount: PluralForms
    /** The strip's meta with no Frame ("3 pieces · no Frame") and while the Frame is being set ("3 pieces · setting Frame"). */
    noFrame: string
    settingFrame: string
    /** The Rulers toggle's name (Rulers card). */
    rulersLabel: string
    /** The Zoom pill's toggle that shows or hides the Progress bar (ticket 296). */
    progressBarLabel: string
    /** The Canvas color button's name and the picker's label (CanvasBackground card), the swatch name ("Sage, 3 of 5") and the eleven background names. */
    canvasColor: {
      label: string
      pickerLabel: string
      swatchLabel: string
      /** The Dots | Squares choice under the swatches (ticket 348). */
      positionMarks: { label: string; dots: string; squares: string; dotsBody: string; squaresBody: string }
      names: Record<'studio' | 'linen' | 'sage' | 'mist' | 'blush' | 'night' | 'ink' | 'midnight' | 'olive' | 'umber' | 'ash', string>
    }
    /** The hint in the drawing area's bottom-left corner (CanvasHint card), in pieces around its key chips. */
    hint: {
      scrollOr: string
      spaceKey: string
      dragToMove: string
      scrollToZoom: string
      hand: string
      setFrame: string
      rulers: string
    }
  }
  shell: {
    /** Under 'No Project open yet': what to do (EmptyCanvas card). */
    canvasPlaceholderHint: string
    canvasPlaceholder: string
  }
  /** Storage's own voice in the UI: what it says when a write to this device didn't get through (ticket 55). */
  storage: {
    saveFailedMessage: string
  }
  /** The header's own addition at the iPad mini tier (ticket 168): the More button (OverflowMenu card). */
  header: {
    menuButton: string
    overviewItem: string
    tourItem: string
    /** The HeaderMenu's link to the repository (ADR 0031, ticket 269): the AGPL-3.0 network clause requires a hosted copy to offer one. */
    sourceItem: string
    /** The Dock's sixth button and the sheet it opens (ticket 79; Dock/ToolSheet cards): Save/Export, the Bead pill, Beads needed, Saved Projects, New Project, Import. */
    projectSheetLabel: string
  }
  /** The Tour (ticket 80; TourStep card): the step card's words, step by step, and what it says when it moves. */
  tour: {
    /** The card's accessible name. */
    stepLabel: string
    progress: string
    next: string
    skip: string
    backToLoom: string
    backToLoomName: string
    backToLoomNote: string
    /** Shown in Remove line's step until a whole row or column is selected. */
    selectLineHint: string
    offScreen: string
    skipToast: string
    /** The polite status line when the pointer moves: "Next: Yellow, in Colors." */
    pointer: string
    steps: Record<TourStepId, { title: string; body: string }>
    final: { title: string; body: string; keepEditing: string; export: string }
  }
  /** The ContextBar (ticket 168; ContextBar card): what a Selection can do, floating above the Progress bar. */
  overview: {
    pageTitle: string
    sloganLead: string
    sloganLast: string
    tagline: string
    makeFirstProject: string
    openEditor: string
    projectsSaved: string
    whatsInside: string
    /** The carousel's ‹ › buttons. */
    previousFeature: string
    nextFeature: string
    /** The hand-written notes of the hero (Overview card); decorative, hidden from screen readers. */
    notes: { you: string; onUs: string; elevenSteps: string; youllMakeThis: string }
    /** The coffee tile (ticket 219; Overview card). */
    coffee: { title: string; text: string; button: string }
    /** The plan tiles (ticket 220; Overview card): placeholders until accounts and payment exist. */
    plans: {
      label: string
      heading: string
      why: string
      youAreHere: string
      tiles: Array<{ name: string; price: string; meta: string; text: string; button: string; includes: string; items: string[] }>
    }
    features: {
      techniques: FeatureCopy
      projectEditing: FeatureCopy
      convertImage: FeatureCopy
      rowProgress: FeatureCopy
      beadsNeeded: FeatureCopy
      exports: FeatureCopy
      savedProjects: FeatureCopy
    }
    /** The words inside the carousel's examples (ticket 218; Overview card): decorative, so hidden from screen readers with them. */
    examples: {
      loom: string
      peyote: string
      brick: string
      picture: string
      sixColors: string
      /** "Row 6" and "of 18" on the mini Progress bar. */
      row: string
      ofRows: string
      brickRed: string
      ivory: string
      /** The PDF page's own small print. */
      page: string
      by: string
      maker: string
      projectFile: string
      /** The Saved Projects gallery's six names: Gold strip, Poppy, Heart, Hills, Stripes, Checks. */
      names: [string, string, string, string, string, string]
    }
  }
  contextBar: {
    label: string
    clearButton: string
    pasteHint: string
    cancelButton: string
  }
  palette: {
    pickerLabel: string
    colorLabel: string
    undoButton: string
    redoButton: string
    rotateButton: string
    /** CONTEXT.md's Custom color glossary entry: the native-picker slot at the end of the Colors group. */
    customColorLabel: string
    limitReached: string
    /** The toast after an added swatch is removed (ticket 228); its Undo is `undoButton`. */
    removed: string
    /** A removal button's accessible name; `{hex}` is the swatch's color. */
    removeSwatch: string
    /** The confirmation before an added swatch is removed (ticket 304); `{hex}` in the message is the swatch's color. */
    removeConfirmTitle: string
    removeConfirmMessage: string
    removeConfirmButton: string
    removeCancelButton: string
  }
  tools: {
    paintLabel: string
    fillLabel: string
    selectLabel: string
    /** The 4th Tool group member (ticket 89): flood-erases a clicked region's connected same-color cells. */
    eraseLabel: string
    /** The Hand tool (v16): moves the open canvas by dragging and never changes a bead. */
    handLabel: string
    /** The one-line descriptions in the Tool buttons' Tooltips (ticket 251); Eraser needs none. */
    paintHint: string
    fillHint: string
    selectHint: string
    handHint: string
    copyButton: string
    /** The Edit group's Save (ticket 115): reassurance that the edit is on this device, not a new kind of storage (ADR 0012). */
    saveButton: string
    /** The brief confirmation Save shows once storage took the write. */
    savedConfirmation: string
    /** Ctrl/Cmd+V (ticket 92) has no Toolbox button of its own — only the shortcuts help overlay (ticket 96) names it. */
    pasteLabel: string
    /** The Tools-group button next to Eraser (ticket 123): removes the selected whole row/column, enabled only while the Selection is exactly one. */
    removeLineButton: string
    /** Its link text under the tool tabs (ToolTabs card); the full name stays its tooltip. */
    removeLineShort: string
    removeLineName: string
  }
  /** The input mode toggle (ticket 325; CONTEXT.md: Pen mode, Mouse mode). */
  inputMode: {
    penLabel: string
    mouseLabel: string
    penHint: string
    mouseHint: string
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
    noProjectMessage: string
    noColorsMessage: string
    colorHeading: string
    countHeading: string
    /** The grams column's heading and the unit after each weight (g / г). */
    weightHeading: string
    gramsUnit: string
    totalLabel: string
    /** The Estimated weight Note (tickets 155, 328); `{grams}` is the Bead's average weight of one bead. */
    weightInfo: string
  }
  /** Export/import (CONTEXT.md's Project file), plus QR export/import (ticket 68, ADR 0015). */
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
    /** While an export is drawn (Loading card): what is happening, to which Project. */
    makingPng: string
    makingPdf: string
    /** The toast once a PNG or PDF is made where sharing needs a fresh tap (iPhone, iPad; ticket 306), and its action. */
    readyPng: string
    readyPdf: string
    readySave: string
    /** The way out when a Project is too large for a QR code, or a save fails: the Project as a file. */
    exportProjectFile: string
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
    exportProjectButton: string
    exportLibraryButton: string
    importLabel: string
    importedLabel: string
    importErrorLabel: string
    /** Shown instead of the code when the Project doesn't fit a single QR code's capacity (ADR 0015's size cap) -- points at Export Project above as the fallback rather than duplicating a download of its own. */
    qrTooLargeMessage: string
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
    /** The two per-direction axis counters (ticket 44), named for what they do on screen -- rotating the Project
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
      rowProgress: string
    }
  }
  /**
   * The Frame (CONTEXT.md, ADR 0026) and everything that needs one. The action is always "Set Frame"; "Frame" alone names
   * the thing, the Toolbox row and the Dock button. The Russian is proposed in the design system and not yet reviewed.
   */
  frame: {
    title: string
    setFrame: string
    /** The description line in Set Frame's Tooltip (ticket 251). */
    setFrameHint: string
    notSet: string
    /** The number chip's accessible name: pressing it brings the Frame into view. */
    numberLabel: string
    numberName: string
    fitToDrawing: string
    removeFrame: string
    done: string
    columnsLabel: string
    rowsLabel: string
    fewerColumns: string
    moreColumns: string
    fewerRows: string
    moreRows: string
    /** The one line under a Frame control that says what the Frame is. */
    explainer: string
    /** The size tooltip at the Frame's bottom-right corner while it is being set: "13×13 · 2.1 × 2.1 cm". */
    sizeTooltip: string
    announceSet: string
    announceRemoved: string
    /** Fit to drawing with nothing drawn: there is nothing to wrap. */
    announceNothingToFit: string
    announceRotated: string
    /** Export without a Frame opens a dialog with this title. */
    exportPromptTitle: string
    countNeedsFrame: string
    progressNeedsFrame: string
    /** Rotate's accessible name while it is disabled for want of a Frame. */
    /** The Message after Rotate moved pieces out of the way ("{count}" of them): the singular and plural of the sentence. */
    rotatedMessage: PluralForms
    /** The lead of the margin Message, by what was done to the Frame. */
    marginLead: Record<'set' | 'moved' | 'resized', string>
    /** The rest of the margin Message, after the lead: how many beads were in the margin. */
    marginClearedMessage: PluralForms
    /** The cursor and the keyboard while the Frame is being set. */
    keyboardHint: string
  }
  size: {
    /** Names the Estimated size readout for assistive technology. */
    estimateLabel: string
    /** The info icon's accessible name; its tooltip is `estimateWarning`. */
    estimateInfoButton: string
    /** The warning tooltip on the Estimated size: it is a guide, not a measurement. */
    estimateWarning: string
    /** Hover/focus text on the Frame's controls while Row progress is on and they are disabled. */
    lockedReason: string
  }
  /** Importing while a Project is open asks first whether to switch to what came in (ticket 154). */
  importSwitch: {
    title: string
    /** `{current}` and `{imported}` are Project names. */
    messageOne: string
    /** `{count}` Projects came in, and `{imported}` is the one that would open. */
    messageMany: string
    /** The open Project's last save didn't get through. */
    unsavedMessage: string
    switchButton: string
    switchAnywayButton: string
    keepButton: string
    saveButton: string
  }
  removeProject: {
    title: string
    /** `{name}` is the Project's name. */
    message: string
    confirmButton: string
    cancelButton: string
  }
  switchProject: {
    title: string
    /** `{current}` is the open Project and `{picked}` the one being opened. */
    message: string
    confirmButton: string
    cancelButton: string
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
   * Convert image (CONTEXT.md, ADR 0010/0011): the file input in the New Project form, the framing step that takes the
   * canvas panel over, and Image colors in the Colors group.
   *
   * Every string here holding `{formats}`, `{maxSizeMb}` or `{maxMegapixels}` is filled in by formatImageLimits (see
   * domain/imageConversion.ts) from the very constants the validation enforces, so the limits the UI advertises and the
   * limits it applies cannot drift apart. Never write the numbers out here.
   */
  convertImage: {
    /** While a chosen picture is read (Loading card). */
    readingPicture: string
    /** The file input's own label in the New Project form. */
    fileLabel: string
    fileName: string
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
    imageColorsShort: string
    /** Why Image colors is off: the Project wasn't made from a picture (ColorPickers card). */
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
  /** The Replace Bead control (CONTEXT.md, ADR 0017) next to the open Project's Bead, and its confirmation modal (ticket 48). */
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
    /** Del empties the Selection's beads (ticket 329); Escape is the one Back out action. */
    emptySelection: string
    backOut: string
    /** Ticket 95: Space+drag. */
    panCanvas: string
    /** The Canvas group (v16): its title and the zoom shortcut. */
    canvasGroup: string
    zoomCanvas: string
    /** Ticket 88's whole Colors group, summarized as one row rather than one per swatch. */
    paletteColors: string
  }
  /** Tooltip bodies and the reasons a control is disabled (ticket 334, ADR 0035); names are the controls' own. One imperative sentence ending in a full stop; keys never appear (they are the key chip). */
  tooltips: {
    paint: string
    fill: string
    select: string
    erase: string
    hand: string
    setFrame: string
    removeFrame: string
    noFrameToRemove: string
    /** The one reason shared by every control Row progress locks, each naming what it would change. */
    rowProgressLockedFrame: string
    rowProgressLockedRotate: string
    rowProgressLockedRemoveLine: string
    removeLine: string
    removeLineDisabled: string
    clear: string
    customColor: string
    customColorFull: string
    imageColorsDisabled: string
    nothingToUndo: string
    nothingToRedo: string
    copyDisabled: string
    pasteDisabled: string
    rotate: string
    setFrameFirst: string
    fitToDrawing: string
    noBeadsToFit: string
    zoomFit: string
    canvasColor: string
    colors: string
    newProject: string
    importFile: string
    importQr: string
    saveProject: string
    changeName: string
    convertImage: string
    frameChip: string
    /** "A, B, C." from the item names. */
    list: (names: readonly string[]) => string
  }
}

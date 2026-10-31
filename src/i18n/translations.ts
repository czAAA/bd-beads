import type { FrameShapeId, FrameSettingName, FringeStyle } from '../domain/frameShape'
import type { Locale } from '../domain/locale'
import type { BandFit, StarterCategoryId, StarterSizeName } from '../domain/starters'
import type { ConvertStep, CropHandle } from '../domain/convertSize'
import type { PluralForms } from './plural'

export type { Locale }

/** One Homepage feature; `tabName` and `tabLine` are shorter wordings for the carousel tab where the full ones don't
 * fit. */
interface FeatureCopy {
  name: string
  text: string
  tabName?: string
  tabLine?: string
}

/** One Homepage plan tile's words (ticket 220): its name, its price, its one line and its button. */
interface PlanCopy {
  name: string
  price: string
  text: string
  button: string
}

/** The Homepage's free list, a row each (ticket 0742; `writing.md`, the free list). The blanks are the app's own counts
 * and names, never typed in: `{names}` the Techniques', `{brands}` and `{codes}` the Color catalogs', `{categories}` the
 * Starters'. */
interface FreeRows {
  browser: string
  canvas: string
  techniques: PluralForms
  projects: string
  picture: string
  frame: string
  schemas: string
  rowProgress: string
  editor: string
  pdf: string
  png: string
  beadsNeeded: string
  colors: string
  file: string
  wordChart: string
  mirror: string
  starters: PluralForms
}

/** A Technique setting's words (tickets 0624, 0626): its name, its two buttons, its number's name for screen readers,
 * its hover text where it has one, why it is locked while rows are done and what is read out once it changed. */
export interface SettingWords {
  label: string
  less: string
  more: string
  value: string
  body?: string
  locked: string
  /** `{count}` is the new value. */
  changed: string
  /** The value in a word or two where room is short, the margin's title block (ticket 0698): `{count}` is the value. */
  short: string
}

export interface Translations {
  app: {
    title: string
  }
  form: {
    nameLabel: string
    beadLabel: string
    /** The Bead picker (ticket 535): `hint` is its one line while collapsed; Brand, Form factor and Bead size are its steps. */
    beadPicker: {
      hint: string
      change: string
      close: string
      brand: string
      formFactor: string
      size: string
      choose: string
    }
    techniqueLabel: string
    widthLabel: string
    heightLabel: string
    /** Stepper buttons beside Width and Height (ticket 181), each named for screen readers like Stepper's own. */
    decreaseWidthButton: string
    increaseWidthButton: string
    decreaseHeightButton: string
    increaseHeightButton: string
    unitLabel: string
    /** The unit a Project's size can be stated in when it is a count of beads (ADR 0026) — the default. */
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
    /** Between Create Project and Convert image. */
    or: string
    /** New Project's heading and what an open canvas is for (ticket 568). */
    openCanvasTitle: string
    openCanvasSubtitle: string
    /** The button that unfolds the Starter gallery. */
    pickStarter: string
    /** The Estimated size when the unit is mm: the same size as a count of beads, "≈ 40×30 beads" (ticket 342). */
    estimateBeads: string
  }
  /** Screen-reader words (ticket 159; `accessibility.md`, ScreenReaders card). */
  a11y: {
    toolsLandmark: string
    /** The Project's accessible name: "{name}, {columns} by {rows} beads, {colors}" plus, with Row progress on, the
     * progress. */
    projectLabel: string
    /** The Project's name for a screen reader while it has no Frame: a Canvas, with no size to state. */
    canvasLabel: string
    colorsCount: PluralForms
    progressDone: string
    /** A message's close ×. */
    closeMessage: string
    /** An expandable panel's expand button (BeadsNeeded, SavedProjects cards). */
    expandPanel: string
    collapsePanel: string
  }
  /** The Tool pill and its colour popover (ticket 439). */
  toolPill: {
    /** The grip button's name: it moves the pill with the arrow keys. */
    move: string
    /** The Menu panel's setting and its group name. */
    position: string
    left: string
    top: string
    right: string
    bottom: string
    /** The colour control's name; {name} is the chosen colour's name. */
    color: string
    popover: string
    /** The popover's section of recent colours. */
    recent: string
    palette: string
    /** The Recent colors mode's tile that opens the popover. */
    close: string
    /** A recent colour's name. */
    useColor: string
  }
  /** Mirror (ADR 0082, spec 0702, ticket 0703; MirrorPopover card): the tile's name, the popover's rows and their
   * controls. Radial, the Fold and the Area come with tickets 0705 and 0710. */
  mirror: {
    /** The tile's and the popover's name. */
    title: string
    mode: string
    off: string
    mirror: string
    repeat: string
    axes: string
    leftRight: string
    topBottom: string
    /** The Axis count Steppers' labels and buttons. */
    leftRightAxes: string
    topBottomAxes: string
    fewerAxes: string
    moreAxes: string
    /** The Note while the mode is on and no Axis is. */
    turnAxisOn: string
    close: string
    /** The open Canvas's details (ticket 0704): the handle on the canvas is the setting; Repeat needs an Area. */
    dragHandle: string
    repeatNeedsArea: string
    /** The Selection bar's Mirror (ticket 0707): its Tooltip body, what it announces, and the Message counting the
     * counterparts that had nowhere to land (off the layer, on a Seam or Off-shape, in a finished row). */
    copyToCounterparts: string
    announceSelectionMirrored: string
    droppedMessage: PluralForms
    /** Radial and its Fold (ticket 0705): the chip, the Stepper's label and buttons, and the Note saying the rule in
     * force: by index at Fold 2 and 4, else geometric, the turn between images in `{angle}` degrees. */
    radial: string
    fold: string
    fewerFolds: string
    moreFolds: string
    foldExact: string
    foldNearest: string
    /** The Area row (ticket 0710): its label, the Select area button in its states, Whole Frame, Clear the area, the
     * Notes, the Canvas hint's parts while picking, and the toasts. */
    area: string
    selectArea: string
    pickingArea: string
    wholeFrame: string
    clearArea: string
    areaSize: string
    areaNoneFrame: string
    areaNoneCanvas: string
    areaSet: string
    pickDrag: string
    pickMargin: string
    pickDragCanvas: string
    pickCancel: string
    areaSetMessage: string
    wholeFrameMessage: string
    /** A Custom frame (ticket 0706): the Note with the side count in place of the Fold Stepper on a round shape, the
     * Note while Repeat has a straight Axis on a shape, and why a chip the shape's symmetry does not offer is off. */
    sidesFromShape: PluralForms
    repeatNeedsRadial: string
    noLeftRight: string
    noTopBottom: string
    noRadial: string
  }
  /** The Palette's color names (`writing.md`, Color names). */
  colorNames: Record<string, string>
  /** The Menu and Project panels (spec 0440, ticket 443). */
  panels: {
    /** The Back arrow of a Subpanel (spec 0478). */
    back: string
    menu: {
      projects: string
      preferences: string
      input: string
      writingHand: string
      right: string
      left: string
      pen: string
      mouse: string
      help: string
      about: string
      version: string
      deleteAll: string
      coffee: string
      themeLight: string
      themeDark: string
      tooltipDeleteAll: string
      deleteAllTitle: string
      deleteAllMessage: string
      deleteAllConfirm: string
      /** The Help row and the Language row's link that open the Feedback sheet (ticket 0700). */
      sendFeedback: string
      reportTranslation: string
    }
    project: {
      rename: string
      renameAction: string
      clear: string
      tooltipClear: string
      nameRequired: string
      notSaved: string
      saveRefused: string
      bead: string
      canvas: string
      whiteInContrast: string
      exportHeading: string
      exportPng: string
      exportPdf: string
      exportFile: string
      duplicate: string
      duplicateTitle: string
      duplicateNote: string
      nameField: string
      duplicateHint: string
      deleteThis: string
      deleteTitle: string
      deleteMessage: string
      deleteConfirm: string
      cancel: string
      save: string
      tooltipRename: string
      tooltipDuplicate: string
      tooltipDelete: string
      titleLabel: string
      nameLabel: string
      makerLabel: string
      savedLocal: string
      notSavedYet: string
      addMaker: string
      changeMaker: string
      thisProject: string
      beadBrand: string
      beadType: string
      beadSize: string
    }
  }
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
  }
  /** The Techniques' names, by each Technique's name key (ADR 0078): open, so a new Technique is its entry and its strings;
   * `registryNames.test.ts` checks every key is in every language. */
  techniques: Readonly<Record<string, string>>
  /** A Technique setting's words, by its label key (ADR 0078, ticket 0624): open like `techniques`, so a new setting is
   * its entry and its strings; `registryNames.test.ts` checks every key is in every language. */
  weaveSettings: Readonly<Record<string, SettingWords>>
  projects: {
    heading: string
    newProjectButton: string
    removeButton: string
    unknownBeadLabel: string
    /** The library's empty state: a title over a line saying where projects are kept. */
    emptyTitle: string
    emptyBody: string
    /** "3 pieces": a project's Pieces count, in the library row's Tooltip. */
    pieces: PluralForms
    /** "1 unnamed": the Pieces with no name, after the named ones. */
    unnamedPieces: string
    /** "Frame 24 × 30 beads", with {width} and {height}. */
    frameSize: string
    /** A row's Piece count over the size gate, never counted (ticket 0716). */
    tooBigToCount: string
    /** The Tooltip of a row's count still being worked out in idle time (ticket 0716). */
    countingPieces: string
    /** "31 771 024 beads": a sealed Project's bead count, in its row (ticket 0716). */
    beads: PluralForms
    /** A sealed Project's row: "made {created} · saved {saved}", dates in the app's language (ticket 0716). */
    sealedDates: string
  }
  /** The Starter gallery and its setup (tickets 0596, 0597; StarterGallery card). */
  starters: {
    /** Step 1's title, "Starter"; lowercased, the crumb of the levels under it. */
    title: string
    /** Step 1's lead line, over the categories. */
    lead: string
    /** A category: its name, its step 2 lead line, and its card's count of options ("5 shapes"). */
    categories: Record<StarterCategoryId, { name: string; lead: string; count: PluralForms }>
    /** An option card's and the Estimated size's bead count, "165 beads". */
    beads: PluralForms
    /** The setup's Design choice: Use design or Start empty. */
    designLabel: string
    useDesign: string
    startEmpty: string
    /** Under Design once a size has turned the design off, with {size} the design's ("10 rounds"). */
    designOffNote: string
    /** Under Design on Start empty at the design's own size. */
    emptyNote: string
    /** The dot on the chip of the design's own size, for screen readers. */
    designSize: string
    /** The chips' group, "Usual sizes". */
    presetsLabel: string
    /** The setup picture's name, with {option} the Starter's ("Star, with design"). */
    pictureWithDesign: string
    pictureEmpty: string
    /** A size as a caption or the note names it, by the setting it is in ("10 rounds", "part size 5", "EU 54"). */
    sizes: Record<StarterSizeName, PluralForms>
    /** Beside a Custom frame's first size label: what it counts ("from the centre", "rounds a triangle"). */
    hints: Record<FrameShapeId, string>
    /** Beside the other size labels (ticket 0597): what each counts ("one bead fewer each", "cm, measured snug"), a
     * Ring size's in each Size system. */
    sizeHints: Record<'topRows' | 'fringeLength' | 'width' | 'ringSize' | 'ringSizeUs' | 'wrist', string>
    /** A Ring's or Band's sizes in the setup (ticket 0597): each stepper's label and its buttons' names. */
    setupSizes: Record<'width' | 'ringSize' | 'wrist', { label: string; less: string; more: string }>
    /** The setup's choices (ticket 0597): a Fringe earring's style and a Band's Fit, each a label and its options. */
    picks: { fringeStyle: { label: string; options: Record<FringeStyle, string> }; fit: { label: string; options: Record<BandFit, string> } }
    /** The Earrings', Rings' and Bands' names by Starter id (tickets 0597, 0633): a plain key per Starter, checked in
     * every language by a test (ADR 0078); a Shape is named by its Frame shape. */
    options: Record<string, string>
    /** A Ring size's Size system, a view of the one size: EU (the inside round in mm) or US. */
    sizeSystem: { label: string; eu: string; us: string }
    /** Under Design once a choice has turned the design off ("The design is made for V fringe."). */
    designOffChoiceNote: string
    /** A Fringe earring's counts: one earring's beads and the pair's. */
    beadsEach: PluralForms
    forPair: PluralForms
    /** A Ring's Estimated size, with {inside} and {width} in mm, and its rows round the band. */
    ringEstimate: string
    rowsRound: PluralForms
    /** A Band's rows, and the room left for its clasp, with {clasp} as "1.5 cm". */
    bandRows: PluralForms
    claspLeft: string
  }
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
      names: Record<'studio' | 'linen' | 'stone' | 'fog' | 'pebble' | 'night' | 'ink' | 'midnight' | 'ash' | 'slate', string>
    }
    /** The hint in the drawing area's bottom-left corner (CanvasHint card), in pieces around its key chips. */
    hint: {
      scrollOr: string
      spaceKey: string
      dragToMove: string
      scrollToZoom: string
      hand: string
      rulers: string
    }
    /** The captions over an empty Project, one beside each control (FirstRunHints card, ticket 0738), the welcome's
     * steps line and its storage line, which the Project file's path follows. A line break is `\n`. */
    firstRun: {
      select: string
      frame: string
      export: string
      menu: string
      project: string
      mirror: string
      color: string
      steps: string
      storage: string
    }
  }
  shell: {
    /** Under 'No Project open yet': what to do (EmptyCanvas card). */
    canvasPlaceholderHint: string
    canvasPlaceholder: string
    /** The toast once a newer version of the app is waiting (ticket 69), and its button, which reloads onto it. */
    updateReady: string
    updateReload: string
  }
  /** Storage's own voice in the UI: what it says when a write to this device didn't get through (ticket 55). */
  storage: {
    saveFailedMessage: string
    /** The note before the browser's storage prompt, shown once at a device's first save (ticket 399). */
    keepNote: { title: string; message: string; confirmButton: string; cancelButton: string }
  }
  /** The header's own addition at the iPad mini tier (ticket 168): the More button (OverflowMenu card). */
  header: {
    menuButton: string
    homepageItem: string
    /** The HeaderMenu's link to the repository (ADR 0031, ticket 269): the AGPL-3.0 network clause requires a hosted
     * copy to offer one. */
    sourceItem: string
    /** The Dock's sixth button and the sheet it opens (ticket 79; Dock/ToolSheet cards): Save/Export, the Bead pill,
     * Beads needed, Saved Projects, New Project, Import. */
    projectPanelLabel: string
  }
  /** The ContextBar (ticket 168; ContextBar card): what a Selection can do, floating above the Progress bar. */
  homepage: {
    pageTitle: string
    tagline: string
    makeFirstProject: string
    openEditor: string
    whatsInside: string
    /** The carousel's ‹ › buttons. */
    previousFeature: string
    nextFeature: string
    /** The Homepage's Progress bar (ticket 0739): the track's name, Back and Next, and why each is disabled at its end; each step's name for screen readers (ticket 0744). */
    sections: { label: string; back: string; next: string; firstBody: string; lastBody: string; goTo: string }
    /** The hand-written notes of the hero (Homepage card); decorative, hidden from screen readers. */
    notes: { onUs: string }
    /** The coffee tile (ticket 219; Homepage card). */
    coffee: { title: string; text: string; button: string }
    /** The plan tiles (ticket 220; Homepage card). */
    plans: {
      heading: string
      why: string
      youAreHere: string
      /** No account, then Free account and Pro, switched off (ticket 0742): those two list nothing, their line saying only
       * what they build on. */
      tiles: [PlanCopy & { meta: string }, PlanCopy, PlanCopy]
      /** The stamp on Free account and Pro, written in capitals on it, and its image's name. */
      comingSoon: string
      /** No account's list (ticket 0742): the app's real features, in the order `homepage/freeList.ts` gives them. */
      free: { heading: string; rows: FreeRows; more: string }
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
    /** The words inside the carousel's examples (ticket 218; Homepage card): decorative, so hidden from screen
     * readers with them. */
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
  /** The Name Piece dialog (ticket 406). */
  pieceName: {
    title: string
    label: string
    hint: string
    save: string
    cancel: string
  }
  contextBar: {
    label: string
    clearButton: string
    /** The "…" overflow of the Selection bar when its controls do not fit (ticket 415). */
    moreLabel: string
  }
  palette: {
    pickerLabel: string
    colorLabel: string
    undoButton: string
    redoButton: string
    rotateButton: string
    /** CONTEXT.md's Custom color glossary entry: the button at the end of the Colors group that opens the color
     * picker. */
    customColorLabel: string
    /** The picker's wheel (ticket 449): its name, and its value as heard, `{hue}` in degrees and `{saturation}` in
     * percent. */
    wheelLabel: string
    wheelValue: string
    brightnessLabel: string
    hexLabel: string
    /** The short note under the hex field while what is typed is not a color. */
    hexInvalid: string
    /** The preview swatch's name: the color the picker would take. */
    previewLabel: string
    /** The + on the Custom color picker's preview (ticket 0690): adds the color and keeps the picker open. */
    addToPalette: string
    pickFromCanvasLabel: string
    /** The toast after an added swatch is removed (ticket 228); its Undo is `undoButton`. */
    removed: string
    /** A removal button's accessible name; `{hex}` is the swatch's color. */
    removeSwatch: string
    /** The colour popover's pencil (ticket 531): enters Edit palette, and ends it (its name while on). */
    editPalette: string
    doneEditingPalette: string
    /** The Tooltip of a built-in swatch in Edit palette. */
    defaultColorLocked: string
    /** The confirmation before an added swatch is removed (ticket 304); `{hex}` in the message is the swatch's
     * color. */
    removeConfirmTitle: string
    removeConfirmMessage: string
    removeConfirmButton: string
    removeCancelButton: string
    /** Remove all custom colors (ticket 0532): the bin's name and Tooltip, the toast, and the confirmation; `{count}` in
     * the message is how many colors leave. */
    removeAllColors: string
    removedAll: string
    removeAllConfirmTitle: string
    removeAllConfirmMessage: PluralForms
    removeAllConfirmButton: string
    /** The Bead's Color catalog, to add a maker's color to the Palette (ticket 0537): `{code}` is the maker's code,
     * `{count}` a count of rows or of a filter value `{name}`. Its filters and empty state (ticket 0713): `{query}` the
     * search text, `{filters}` the on values' names (Finishes, then families), `{sizes}` a code's sizes, `{size}` the Bead's. */
    beadColors: {
      /** The entry button, `{bead}` the Bead's label (ticket 0746). */
      open: string
      /** The Info button after it, which holds the approximate and taken notes. */
      info: string
      /** The count line: `{count}` codes matched, and how many are shown past the cap. */
      codeCount: string
      firstShown: string
      /** The narrow layout's disclosure, and its name while `{count}` values are on. */
      filters: string
      filtersOn: string
      label: string
      search: string
      approximate: string
      inPalette: string
      takenNote: string
      discontinued: string
      add: string
      takenLabel: string
      noMatch: string
      noMatchFiltered: string
      noneFiltered: string
      otherSizes: string
      colorFilter: string
      finishFilter: string
      clearFilters: string
      /** The foot row that opens a bead-color Report (ticket 0700). */
      reportColor: string
      valueCount: string
      loading: string
      failed: string
      /** The Finish list shared by every Brand (ADR 0072). */
      finishes: Record<'transparent' | 'opaque' | 'ceylon' | 'silver-lined' | 'luster' | 'matte' | 'rainbow' | 'metallic' | 'plated', string>
    }
  }
  tools: {
    paintLabel: string
    fillLabel: string
    selectLabel: string
    /** The 4th Tool group member (ticket 89): flood-erases a clicked region's connected same-color cells. */
    eraseLabel: string
    /** The Hand tool (v16): moves the Canvas by dragging and never changes a bead. */
    handLabel: string
    /** The Piece tool and the Select all tile (ticket 414). */
    pieceLabel: string
    selectAllLabel: string
    copyButton: string
    pasteClippedMessage: PluralForms
    /** A Paste or Rotate on a Custom frame: beads that landed on a Seam or Off-shape (ticket 0594). */
    droppedOnShapeMessage: PluralForms
    cutButton: string
    /** Ctrl/Cmd+V (ticket 92) has no Toolbox button of its own — only the shortcuts help overlay (ticket 96) names
     * it. */
    pasteLabel: string
    /** The Tools-group button next to Eraser (ticket 123): removes the selected whole row/column, enabled only while
     * the Selection is exactly one. */
    removeLineButton: string
    /** Its link text under the tool tabs (ToolTabs card); the full name stays its tooltip. */
    removeLineShort: string
    /** The selection bar's Name button (ticket 406): gives the selected Piece a name, which makes it a Schema. */
    namePieceButton: string
    /** A Fill tool press refused by Fill reach (ticket 0715): open space nothing encloses, or more than the Fill cap. */
    fillOpenMessage: string
    fillTooBigMessage: string
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
    stepHinge: string
    stepClose: string
    ofSteps: string
    stepOfSteps: string
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
    showAll: string
    showFewer: string
    /** The Estimated weight Note (tickets 155, 328); `{grams}` is the Bead's average weight of one bead. */
    weightInfo: string
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
    /** The Specification page after the chart pages (ticket 0581). */
    specification: string
    columnLetter: string
    columnColor: string
    columnCode: string
    columnBeads: string
    columnGrams: string
    columnToBuy: string
    /** "2 × 5 g": the tubes to buy. */
    tubes: string
    schemaFacts: string
    factBeads: string
    chartStyleFact: string
    pagesFact: string
    wherePartsAre: string
    partsNote: string
    rowByRowOn: string
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
    madeBy: string
    technique: string
    bead: string
    size: string
    estimatedSize: string
    /** On the PNG: "by Maria". */
    byMaker: string
    page: string
    /** A part's label above its board (ticket 578): "Part B · columns 101–130 · rows 1–100". */
    partArea: string
    continuesBoth: string
    continuesRight: string
    continuesBelow: string
    /** A sheet whose parts continue on the next sheet, not to the right or below. */
    continuesOn: string
    lastPart: string
    /** The chart style on a chart page's header: color alone, or with each bead's letter. */
    chartStyleColor: string
    chartStyleLetters: string
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
    }
  }
  /** The save box (ticket 148; SaveBox and SaveStates cards). */
  saveBox: {
    exportButton: string
    /** The label row: the library's save state on this device. */
    failedState: string
    menuPng: string
    menuPdf: string
    formatsHint: string
    /** While an export is drawn (Loading card): what is happening, to which Project. */
    makingPng: string
    makingPdf: string
    /** The toast once a PNG or PDF is made where sharing needs a fresh tap (iPhone, iPad; ticket 306), and its
     * action. */
    readyPng: string
    readyPdf: string
    readyFile: string
    readySave: string
    /** The way out when a save fails: the Project as a file. */
    exportProjectFile: string
    /** The Export menu's last row and its modal (NameOnExports card). */
    nameOnExports: string
    changeName: string
    addName: string
    yourName: string
    nameHint: string
    saveName: string
    cancelName: string
  }
  transfer: {
    exportProjectButton: string
    exportLibraryButton: string
    importLabel: string
    importedLabel: string
    importErrorLabel: string
  }
  /** Titles of the Toolbox's five Tool groups (CONTEXT.md), shown in each group's top-left corner (ticket 40). */
  toolbox: {
    groups: {
      tools: string
      colors: string
      edit: string
      rowProgress: string
    }
  }
  /** The Frame (CONTEXT.md, ADR 0026) and what needs one. The action is "Set Frame"; "Frame" alone names the thing.
   * Russian unreviewed. */
  frame: {
    title: string
    titleLabel: string
    nameEmpty: string
    nameEdit: string
    nameTooltip: string
    fromStarter: string
    fitAFrame: string
    fitNothing: string
    noFrameLine: string
    /** The Frame panel's Select a frame row, the hint shown once it is on, and the line under the off exports (ticket 568). */
    selectAFrame: string
    selectFrameHint: string
    exportNeedsFrame: string
    sizeHeading: string
    exportPicture: string
    exportChart: string
    exportQuality: string
    qualityLow: string
    qualityMedium: string
    qualityHigh: string
    qualitySizeAbout: string
    qualitySizeMb: string
    qualitySizeUnder: string
    exportSizeValue: string
    exportFiles: PluralForms
    exportPages: PluralForms
    qualityDpi: string
    qualityPdfCapped: string
    /** The Letters switch in the Frame panel (ticket 0573), its explanation and the name of the info button that holds it (ticket 0651). */
    lettersLabel: string
    lettersLine: string
    lettersInfoLabel: string
    /** The Frame panel's margin section and the margin color picker (ticket 0656, MarginSheet card): its heading, the
     * picker's name, the Auto swatch's name and accessible name, the name of the swatch that is the Canvas color, and the
     * line under the picker. */
    /** The Frame's Background picker's radio group name (tickets 0666, 0670). */
    background: { label: string }
    /** The margin sheet (tickets 0656, 0657; MarginSheet card): the Frame panel's section, its color, the title block's
     * Switch and the title block's Technique pencil. */
    margin: { heading: string; colorLabel: string; auto: string; autoLabel: string; canvasColorLabel: string; line: string; titleBlock: string; changeTechnique: string; changeSetting: string; foldTitleBlock: string; showTitleBlock: string; showTitleBlockOf: string; frameTools: string }
    qualityHintLabel: string
    qualityHint: string
    estimateInfo: string
    sizeLockedLine: string
    /** Under the size fields of a Frame lying turned (ticket 0667), which cannot be resized until upright. */
    sizeTurnedLine: string
    editFrame: string
    moveHandle: string
    /** The Frame panel's stepper names, by the edge they move (tickets 417, 473): a bead out, a bead in. */
    edgeOut: Record<'top' | 'bottom' | 'left' | 'right', string>
    edgeIn: Record<'top' | 'bottom' | 'left' | 'right', string>
    /** The Frame panel's edge cells' labels (ticket 473). */
    edgeName: Record<'top' | 'bottom' | 'left' | 'right', string>
    /** The Frame panel's size: a width and a height field (each shows the current number as a placeholder), then the unit "beads" in a quieter colour. */
    sizeUnit: string
    widthLabel: string
    heightLabel: string
    fitToDrawing: string
    removeFrame: string
    /** The question before Remove frame throws away finished rows (ticket 426). */
    removeConfirmTitle: string
    removeConfirmMessage: string
    removeConfirmButton: string
    removeConfirmCancel: string
    addFromStarter: string
    addFrameButton: string
    replaceFrame: string
    replaceConfirmTitle: string
    replaceConfirmMessage: string
    /** The one line under a Frame control that says what the Frame is. */
    /** The size tooltip at the Frame's bottom-right corner while it is being set: "13×13 ≈ 2.1 × 2.1 cm". */
    sizeTooltip: string
    announceSet: string
    announceRemoved: string
    announceMoved: string
    /** Fit to drawing with nothing drawn: there is nothing to wrap. */
    announceNothingToFit: string
    /** A Frame that would cut through a named Piece is refused (ticket 407); `{name}` is the Schema's name. */
    refusedCutsSchema: string
    /** The Frame shapes' names (tickets 0592, 0596): the Shapes' names in the Starter gallery and what is announced. */
    shapes: Record<FrameShapeId, string>
    /** A Custom frame's size setting in the Frame panel, one entry per setting (tickets 0592, 0593): its stepper, the
     * Size line's summary and what is announced. A smaller size folds what it leaves out, so nothing is asked (0640). */
    sizeSettings: Record<FrameSettingName, { label: string; less: string; more: string; summary: PluralForms; announce: string }>
    /** A Fringe earring's Fringe style in the Frame panel (ticket 0597), its options the setup's: its label and what is
     * announced. */
    fringeStyle: { label: string; announce: string }
    /** `{shape}` is the Frame shape's name, `{size}` its size setting's summary. */
    announceCustom: string
    /** Frame from a Selection or a Piece grew past what was picked (ticket 570): rows added on top, and why. */
    snapAddedTop: PluralForms
    /** The same for columns on the left (ticket 0734), where a Technique staggers its columns. */
    snapAddedLeft: PluralForms
    /** `{technique}` is the new Technique's name. */
    announceTechnique: string
    /** Announced after Rotate turned the Selection and covered no bead. */
    announceSelectionRotated: string
    rotateFrameLabel: string
    announceFrameRotated: string
    /** Export without a Frame opens a dialog with this title. */
    countNeedsFrame: string
    /** The Progress bar's hint with no Frame: [Select icon] {progressSelectToSet} [Frame icon] {progressFrameWord}.
     * Two pieces so each language can order and inflect them: the second ends the sentence (a noun in the
     * accusative where the language has one). */
    progressSelectToSet: string
    progressFrameWord: string
    /** The Message after Rotate turned the Selection onto beads (ADR 0052). */
    rotateCoveredMessage: string
  }
  size: {
    /** Names the Estimated size readout for assistive technology. */
    estimateLabel: string
    /** The info icon's accessible name; its tooltip is `estimateWarning`. */
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
  // Convert image (CONTEXT.md, ADR 0010). Strings holding `{formats}`, `{maxSizeMb}` or `{maxMegapixels}` are
  // filled by formatImageLimits (domain/imageConversion.ts) from the validation constants, so never write the numbers
  // here.
  convertImage: {
    /** While a chosen picture is read (Loading card). */
    readingPicture: string
    /** The New Project form's button that opens the wizard. */
    fileLabel: string
    /** The limits, shown as helper text under the file input and repeated as its `title`. */
    limitsHint: string
    /** Heads-up once the grid passes isSlowFramingSize (ticket 61): informational, never blocks. `{technique}` is
     * its localized name. */
    slowFramingWarning: string
    /** How to move the picture under the frame. */
    panHint: string
    createButton: string
    cancelButton: string
    /** The adjustable ceiling on how many colors the conversion may keep. */
    maxColorsLabel: string
    decreaseColorsButton: string
    increaseColorsButton: string
    /** The Convert image wizard (spec 0645; ConvertImage, PixelToBeadRatio, FoundColorRow cards; writing.md). */
    wizard: {
      title: string
      /** The five sections' titles, and their short labels on the step rail. */
      sections: Record<ConvertStep, string>
      rail: Record<ConvertStep, string>
      /** The step rail's accessible name. */
      railLabel: string
      /** A disabled section's summary until a picture is set. */
      addPictureFirst: string
      chooseFile: string
      paste: string
      takePhoto: string
      turn: string
      flip: string
      replace: string
      /** The Picture section's Note until the first picture: every way in and the limits (formatImageLimits). */
      pictureNote: string
      pictureNoteTouch: string
      /** Under the file name: "256×192 px · png". */
      pictureSize: string
      /** Paste found no picture on the clipboard, or the browser would not read it. */
      nothingToPaste: string
      dropHere: string
      dropOrPaste: string
      dropOrChoose: string
      dropToUse: string
      dropToConvert: string
      dropLimits: string
      byRatio: string
      bySize: string
      /** The Pixel to bead ratio's label, and each chip's name: "2:1, picture pixels : beads". */
      ratioLabel: string
      ratioChip: string
      custom: string
      customRatio: string
      pixelsPerBead: string
      beadsPerPixel: string
      /** The Custom ratio Stepper's buttons. */
      fewerPixels: string
      morePixels: string
      /** The explainer sentence and the drawing's captions. */
      everyBlock: string
      everyPixel: string
      everyPixelBeads: string
      blockPx: string
      onePx: string
      oneBead: string
      blockBeads: string
      /** The crop handles' names, each edge and corner. */
      crop: Record<CropHandle, string>
      cropHint: string
      keepProportions: string
      pictureZoom: string
      /** The Large Schema Note; `{beads}` is the threshold. */
      largeSchema: string
      /** The result box: its label, then the grid size, and the ratio exact, approximate or one pixel as beads. */
      result: string
      resultGrid: string
      resultExact: string
      resultApprox: string
      resultPerPixel: string
      /** The footer's color count after the size. */
      colorsCount: PluralForms
      noPicture: string
      /** The preview's accessible name. */
      previewName: string
      previewEmpty: string
      zoomLevel: string
      /** The Colors section's source control and what each source does. */
      matchTo: string
      beadColors: string
      defaultPalette: string
      exact: string
      defaultNote: string
      exactNote: string
      codesInSize: string
      colorsFound: string
      treatAsEmpty: string
      treatAsEmptyBanner: string
      /** A found color's actions and states (FoundColorRow card). */
      keepExact: string
      remap: string
      empty: string
      noBead: string
      keptExact: string
      remapped: string
      pictureColor: string
      newPalette: string
      /** A found color's row, as a screen reader names it. */
      rowName: PluralForms
      /** The Review summary's rows. */
      summarySize: string
      summaryColors: string
      summaryBeadsNeeded: string
      summaryWeight: string
      summaryToBuy: string
      showDetails: string
      hideDetails: string
    }
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
  /** The Replace Bead control (CONTEXT.md, ADR 0007) in each layer's panel (ticket 0687), and its confirmation modal
   * (ticket 48). */
  replaceBead: {
    selectLabel: string
    confirmTitle: string
    // The Canvas's Bead (ticket 0687): `{old}`/`{new}` its Bead's size in mm before and after. Says it looks different in
    // proportion, the design and bead count stay, and it can be undone.
    canvasMessage: string
    // The Frame's Bead (ticket 0687): `{old}`/`{new}` as for the Canvas, then `{newSize}`/`{oldSize}` the Frame's
    // Estimated size in mm with the new Bead and the old.
    frameMessage: string
    confirmButton: string
    /** After the Project's own Bead when the catalog's Bead of the same id has changed (ticket 534). */
    outdatedPostfix: string
    cancelButton: string
  }
  /** The `?` shortcuts help overlay (ticket 96): every keyboard shortcut, grouped by Tool group. Key labels
   * themselves (digits, letters, "Ctrl/Cmd+C") are locale-neutral and built inline in ShortcutsHelp.vue rather than
   * translated here — only the description of what each one does needs a translation. */
  shortcutsHelp: {
    title: string
    /** Del empties the Selection's beads (ticket 329); Escape is the one Back out action. */
    backOut: string
    /** Ticket 95: Space+drag. */
    panCanvas: string
    /** The Canvas group (v16): its title and the zoom shortcut. */
    canvasGroup: string
    zoomCanvas: string
    /** Ticket 88's whole Colors group, summarized as one row rather than one per swatch. */
    paletteColors: string
    /** The switch at the top of Keyboard shortcuts (ticket 438) and its two choices. */
    keyHints: string
    keyHintsOn: string
    keyHintsOff: string
  }
  /** Tooltip bodies and the reasons a control is disabled (ticket 334, ADR 0035); names are the controls' own. One
   * imperative sentence ending in a full stop; keys never appear (they are the key chip). */
  tooltips: {
    select: string
    erase: string
    piece: string
    selectAll: string
    hand: string
    editFrame: string
    framePanel: string
    /** The margin steppers' Tooltips (ticket 417), and why Shrink is off at one bead. */
    frameEdgeOut: string
    frameEdgeIn: string
    frameEdgeInDisabled: string
    removeFrame: string
    noFrameToRemove: string
    frameFromStarter: string
    replaceFrame: string
    rowProgressLockedFrameFromStarter: string
    resetProgress: string
    noProgressToReset: string
    moveFrame: string
    /** The one reason shared by every control Row progress locks, each naming what it would change. */
    rowProgressLockedFrame: string
    frameSizeLocked: string
    /** Why a turned Frame's size fields are off (ticket 0667). */
    frameSizeTurned: string
    fillNeedsColor: string
    rowProgressLockedTechnique: string
    changeTechnique: string
    /** Rotate held back (ticket 0647): the Selection holds a bead of a finished pass. */
    rotateInFinishedRows: string
    removeLine: string
    removeLineDisabled: string
    namePiece: string
    namePieceDisabled: string
    clear: string
    customColor: string
    pickFromCanvas: string
    nothingToUndo: string
    zoomOutLimit: string
    zoomInLimit: string
    nothingToRedo: string
    copyDisabled: string
    copyNoBeads: string
    cutNoBeads: string
    fillSelection: string
    frameFromSelection: string
    pasteDisabled: string
    pasteTool: string
    /** The Mirror tile's line (ticket 0703). */
    mirror: string
    rotate: string
    rotateCanvas: string
    rotateFrame: string
    noBeadsToRotate: string
    setFrameFirst: string
    fitToDrawing: string
    noBeadsToFit: string
    zoomFit: string
    colors: string
    newProject: string
    importFile: string
    changeName: string
    convertImage: string
    treatAsEmpty: string
    customRatio: string
    remapColor: string
    emptyColor: string
    /** "A, B, C." from the item names. */
    list: (names: readonly string[]) => string
  }
  /** A layer's Layer settings (ADR 0079, ticket 0670): the Frame panel's section heading, and the Background row's label
   * in every layer's. */
  layerSettings: {
    frameHeading: string
    background: string
  }
  /** An unframed Schema's name as a tag, opening into a paper tag (SchemaTag card, ticket 0721; `writing.md`,
   * Schema tag copy). */
  schemaTag: {
    /** The tags' one Tab stop. */
    group: string
    /** A tag's accessible name. */
    label: string
    /** The Tooltip's body on a tag whose name is cut short by an ellipsis. */
    tooltipBody: string
    /** The paper tag's label over the name, lowercased by style. */
    heading: string
    /** The Schema's rectangle in beads; its Estimated size follows after " · ≈ ". */
    sizeBeads: string
    beads: PluralForms
    colors: PluralForms
  }
  /** The Feedback sheet (ADR 0081, spec 0698, ticket 0700): its three Report kinds' titles and fields, the Also sent
   * block's rows, and why a Report was not sent. */
  feedback: {
    titleGeneral: string
    titleTranslation: string
    titleBeadColor: string
    introGeneral: string
    introTranslation: string
    introBeadColor: string
    message: string
    language: string
    shown: string
    shouldSay: string
    note: string
    problem: string
    wrongColor: string
    missingColor: string
    brandCatalog: string
    code: string
    looksLike: string
    looksLikeHint: string
    email: string
    emailHint: string
    messageRequired: string
    shownRequired: string
    emailInvalid: string
    alsoSent: string
    alsoSentNote: string
    ctxAppVersion: string
    ctxUiLanguage: string
    ctxBrowser: string
    ctxOs: string
    ctxViewport: string
    ctxLanguage: string
    ctxBrand: string
    ctxCatalog: string
    ctxCode: string
    ctxHex: string
    ctxSwatchLetter: string
    send: string
    sending: string
    cancel: string
    copyReport: string
    copied: string
    copyFailed: string
    off: string
    offline: string
    rateLimited: string
    failed: string
    sent: string
  }
  /** Safe start and the size gate (ticket 0716): the notice of a Project that didn't open last time, and the question
   * before a Project over the gate opens. */
  opening: {
    /** The notice row, with {name}. */
    didNotOpen: string
    removeButton: string
    exportButton: string
    /** "Open “Scarf”?", with {name}. */
    largeTitle: string
    /** "31 million beads. Opening may be slow or fail.", {count} in millions. */
    largeMessage: string
    openAnyway: string
    cancelButton: string
  }
}

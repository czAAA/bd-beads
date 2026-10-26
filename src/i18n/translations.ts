import type { FormFactorNames } from '../domain/beads'
import type { Locale } from '../domain/locale'
import type { PluralForms } from './plural'

export type { Locale }

/** One Overview feature; `tabName` and `tabLine` are shorter wordings for the carousel tab where the full ones don't
 * fit. */
interface FeatureCopy {
  name: string
  text: string
  tabName?: string
  tabLine?: string
}

/** A gallery card's name and its one-line description. */
interface StarterCopy {
  name: string
  description: string
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
    beadShapeLabel: string
    beadShapeSymmetric: string
    beadShapeReal: string
    beadShapeSymmetricTip: string
    beadShapeRealTip: string
    techniqueLabel: string
    techniqueLoom: string
    techniquePeyote: string
    techniqueBrick: string
    techniqueRightAngle: string
    techniqueNetting: string
    netSizeLabel: string
    netSizeLess: string
    netSizeMore: string
    netSizeValue: string
    brickBlockLabel: string
    brickBlockLess: string
    brickBlockMore: string
    brickBlockValue: string
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
    unitUnits: string
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
    estimateUnits: string
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
  /** The Form factors' names, the middle word of a Bead's label (ticket 533); a maker's product name stays as it is. */
  formFactors: FormFactorNames
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
  }
  /** The Starter gallery and setup in New Project (ticket 493; StarterGallery card). `specLine` is "24 × 80 · Loom". */
  starters: {
    galleryLabel: string
    presetsLabel: string
    /** Under a side the Starter keeps fixed (earrings keep their width). */
    fixedNote: string
    /** Under the sample picture in a Starter's setup: it decorates, the Frame is empty (ticket 494). */
    sampleNote: string
    specLine: string
    gerdan: StarterCopy
    bracelet: StarterCopy
    earrings: StarterCopy
    bag: StarterCopy
    custom: StarterCopy
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
    overviewItem: string
    /** The HeaderMenu's link to the repository (ADR 0031, ticket 269): the AGPL-3.0 network clause requires a hosted
     * copy to offer one. */
    sourceItem: string
    /** The Dock's sixth button and the sheet it opens (ticket 79; Dock/ToolSheet cards): Save/Export, the Bead pill,
     * Beads needed, Saved Projects, New Project, Import. */
    projectPanelLabel: string
  }
  /** The ContextBar (ticket 168; ContextBar card): what a Selection can do, floating above the Progress bar. */
  overview: {
    pageTitle: string
    tagline: string
    makeFirstProject: string
    openEditor: string
    projectsSaved: string
    whatsInside: string
    /** The carousel's ‹ › buttons. */
    previousFeature: string
    nextFeature: string
    /** The hand-written notes of the hero (Overview card); decorative, hidden from screen readers. */
    notes: { onUs: string }
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
    /** The words inside the carousel's examples (ticket 218; Overview card): decorative, so hidden from screen
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
    /** The Bead's Color catalog, to add a maker's color to the Palette (ticket 0537): `{code}` in a label is the maker's
     * code, `{count}` in `showingFirst` the number of rows shown. */
    beadColors: {
      open: string
      label: string
      search: string
      approximate: string
      inPalette: string
      takenNote: string
      discontinued: string
      add: string
      takenLabel: string
      showingFirst: string
      noMatch: string
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
    showAll: string
    showFewer: string
    /** The Estimated weight Note (tickets 155, 328); `{grams}` is the Bead's average weight of one bead. */
    weightInfo: string
  }
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
    qualityPngSize: string
    qualitySizeMb: string
    qualityReduced: string
    qualityReducedLabel: string
    /** The Letters switch in the Frame panel (ticket 0573) and its one-line explanation. */
    lettersLabel: string
    lettersLine: string
    exportCoffee: string
    exportCoffeeLink: string
    estimateInfo: string
    sizeLockedLine: string
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
    sizeUnitUnits: string
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
    /** Frame from a Selection or a Piece grew past what was picked (ticket 570): rows or columns added on each edge, and why. */
    snapAddedTop: PluralForms
    snapAddedBottom: PluralForms
    snapAddedLeft: PluralForms
    snapAddedRight: PluralForms
    /** `{technique}` is the new Technique's name. */
    announceTechnique: string
    /** Changing a layer's Technique (ticket 507): `{technique}` is the new one, `{count}` the beads with no place in it. */
    switchConfirmTitle: string
    switchConfirmMessage: string
    /** Asked of a layer with no beads when Netting needs its Net size. */
    switchSettingsMessage: string
    switchNetSizeTitle: string
    switchNetSizeMessage: string
    switchNetSizeButton: string
    switchConfirmButton: string
    announceBrickBlock: string
    announceNetSize: string
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
  // Convert image (CONTEXT.md, ADR 0010/0011). Strings holding `{formats}`, `{maxSizeMb}` or `{maxMegapixels}` are
  // filled by formatImageLimits (domain/imageConversion.ts) from the validation constants, so never write the numbers
  // here.
  convertImage: {
    /** The size step Convert image asks for before framing a picture (ADR 0026; ticket 342). */
    sizeTitle: string
    sizeMessage: string
    sizeContinue: string
    /** While a chosen picture is read (Loading card). */
    readingPicture: string
    /** The file input's own label in the New Project form. */
    fileLabel: string
    fileName: string
    /** The limits, shown as helper text under the file input and repeated as its `title`. */
    limitsHint: string
    /** Heads-up once the grid passes isSlowFramingSize (ticket 61): informational, never blocks. `{technique}` is
     * its localized name. */
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
  /** The Replace Bead control (CONTEXT.md, ADR 0007) next to the open Project's Bead, and its confirmation modal
   * (ticket 48). */
  replaceBead: {
    selectLabel: string
    confirmTitle: string
    // `{bead}` is the new Bead, `{new}`/`{old}` the Estimated size with it and the current one. Says the size changes,
    // the design and bead count don't, and rows/columns can be adjusted afterwards.
    confirmMessage: string
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
    fillNeedsColor: string
    rowProgressLockedTechnique: string
    changeTechnique: string
    brickBlock: string
    rowProgressLockedBrickBlock: string
    rowProgressLockedRotate: string
    rowProgressLockedRemoveLine: string
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
    /** "A, B, C." from the item names. */
    list: (names: readonly string[]) => string
  }
}

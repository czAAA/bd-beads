import type { FrameShapeId, FrameSettingName, FringeStyle } from '../domain/frameShape'
import type { Locale } from '../domain/locale'
import type { BandFit, StarterCategoryId, StarterSizeName } from '../domain/starters'
import type { CropHandle } from '../domain/convertSize'
import type { PluralForms } from './plural'

export type { Locale }

/** A row of What's inside (ticket 0797) or a promise of the coffee screen (ticket 0823): its name and its line. */
interface InsideCopy {
  name: string
  text: string
}

/** What's inside's 13 rows, in the order the tour plays them (homepage/inside/insideCopy.ts). */
export type InsideRowId =
  | 'canvas'
  | 'techniques'
  | 'editing'
  | 'mirror'
  | 'starters'
  | 'reference'
  | 'convert'
  | 'colors'
  | 'letters'
  | 'rowProgress'
  | 'beadsNeeded'
  | 'exports'
  | 'savedProjects'

/** What's inside's four chapters, each a run of the tour's rows (ticket 0830; homepage/inside/insideCopy.ts). */
export type InsideChapterId = 'draw' | 'startFrom' | 'beadColors' | 'weaveKeep'

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
  /** The Info button's name beside the label, where `body` is its help (ticket 0844): "What Drop does". */
  infoLabel?: string
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
    /** What a new Project left unnamed is called, and the Name's placeholder (ticket 0866): "Project 1", then the next
     * free number. It ends in its number, as Duplicate's suggestions do. */
    unnamedProject: string
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
  /** Mirror (ADR 0082, ticket 0750; ContextBar card's Mirror bar): the tile's name, the Mirror bar's controls, the
   * Selection bar's Mirror and the margin's Mirror the whole Frame. */
  mirror: {
    /** The tile's name, and the Mirror bar's (a toolbar, ContextBar card). */
    title: string
    /** The Mirror bar's Mode switch: its name and its two segments. */
    mode: string
    mirror: string
    repeat: string
    /** The Axis chips, and on a chip that is on its Stepper's value name and buttons: an Axis count, or Radial's Fold. */
    leftRight: string
    topBottom: string
    radial: string
    leftRightAxes: string
    topBottomAxes: string
    fewerAxes: string
    moreAxes: string
    fold: string
    fewerFolds: string
    moreFolds: string
    /** Why a direction's chip is off: the Area is one bead across it. */
    oneBeadWide: string
    oneBeadTall: string
    quarterNeedsSquare: string
    shiftWide: string
    shiftTall: string
    shiftRadial: string
    quarterNeedsStraight: string
    /** A Custom frame's fixed Axes, noted in place of the chips (ADR 0082): Radial with the side count `{count}`, or
     * the shape's one straight line `{axis}`, which in Repeat maps nothing. */
    radialFromShape: string
    lineFromShape: string
    repeatNeedsRadial: string
    closeMirror: string
    /** The Selection bar's Mirror: its Tooltip body, and why it is off on a Frame Selection. */
    insideArea: string
    /** The Mirror bar's move grip (ticket 0808): its name and its Tooltip. */
    moveArea: string
    moveAreaBody: string
    frameMirrorsWhole: string
    /** The margin's Mirror the whole Frame (MarginSheet card): its name while off, and while on. */
    wholeFrame: string
    mirrorOff: string
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
      /** The row that shows whether the browser keeps the Projects and asks it again (ticket 0839), and its value. */
      keepProjects: string
      keepProjectsOn: string
      keepProjectsOff: string
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
      /** Save and Save as (ADR 0090, ticket 0796): the Project panel rows and the actions' names. */
      saveFile: string
      saveFileAs: string
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
      /** After Duplicate (ticket 0860): `{copy}` is the Project now open, `{original}` the one it was copied from. */
      duplicatedToast: string
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
    /** A Kaleidocycle's Frame is one face of its piece (ticket 0876): "one face of 4: 6 of 24 triangles", its count "810
     * beads a face", the whole piece's "3 240 for the whole piece", and the Info button saying what the counts cover. */
    faceOfPiece: string
    beadsFace: PluralForms
    forPiece: PluralForms
    /** The whole piece's 15/0s, their own bead size (ticket 0877). */
    smallForPiece: string
    faceInfoLabel: string
    faceInfo: string
    /** A Star's count is the whole star, its back beaded as the face's mirror (ticket 0875): "245 beads, front and back". */
    beadsFrontBack: PluralForms
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
      /** On touch (ticket 0846): the line in finger words, with no key chips. */
      twoFingersToMove: string
      pinchToZoom: string
    }
    /** The welcome over an empty Project (FirstRunHints card, tickets 0795 and 0798): its lead line and its storage line,
     * which the Project file's path follows. */
    firstRun: {
      storageLead: string
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
    /** The hint's second sentence, how to move the Canvas: its own key so a touch device can say its own (ticket 0840). */
    canvasPlaceholderPan: string
    /** The empty Canvas after a delete left no Project open (ticket 0840): “{name}” was deleted, and what to do next. */
    canvasDeleted: string
    canvasDeletedHint: string
    /** The pan sentence on touch (ticket 0846): fingers, no mouse button or key. */
    canvasPlaceholderPanTouch: string
  }
  /** Storage's own voice in the UI: what it says when a write to this device didn't get through (ticket 55). */
  storage: {
    saveFailedMessage: string
    /** The note before the browser's storage prompt, shown once at a device's first Project file or export (ticket 0839). */
    keepNote: { title: string; message: string; confirmButton: string; cancelButton: string }
    /** The notice row's line while the open Project is open in another tab first (ticket 0834). */
    openElsewhere: string
    /** The browser's answer to Keep Projects, said back (ticket 0839): the toast on yes, the Message on no. */
    keptToast: string
    notKeptMessage: string
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
    /** The strip's Project button, named with the open Project's name it shows (ticket 0858). */
    projectButtonNamed: string
  }
  /** The ContextBar (ticket 168; ContextBar card): what a Selection can do, floating above the Progress bar. */
  homepage: {
    pageTitle: string
    makeFirstProject: string
    openEditor: string
    whatsInside: string
    /** The Welcome section (ticket 0830; Homepage card): its heading and line, See how it works, the counts line's two
     * counted parts ({codes} and {brands} from the app), the piece's caption and its name as an image. */
    welcome: {
      heading: string
      line: string
      seeHow: string
      colors: PluralForms
      starters: PluralForms
      caption: string
      piece: string
    }
    /** What's inside (ticket 0797; Homepage card): the 13 rows the tour plays, the editor's region, and the demo's
     * Projects. The colors row's {brands} and Convert image's {max} come from the app. */
    inside: {
      rows: Record<InsideRowId, InsideCopy>
      editor: string
      demo: { ring: string; heart: string; bracelet: string }
      /** The playing row's place in the caption, "4 / 13" (ticket 0825). */
      place: string
      /** The four chapters, the tour's Pause and Play, Open editor from here (ticket 0879), and the demo's Expand and
       * Collapse (ticket 0830). */
      chapters: Record<InsideChapterId, string>
      pause: string
      play: string
      openFromHere: string
      expand: string
      collapse: string
      /** The demo's tag in its Canvas strip (ticket 0841). */
      demoTag: string
    }
    /** The Homepage's Progress bar (ticket 0739): the track's name, Back and Next, and why each is disabled at its end; each
     * step's name for screen readers (ticket 0744); the Welcome section's step, its heading being a sentence (ticket 0830). */
    sections: { label: string; welcome: string; back: string; next: string; firstBody: string; lastBody: string; goTo: string; moreBelow: string }
    /** The coffee tile (ticket 219; Homepage card). */
    coffee: { title: string; text: string; button: string; source: string }
    /** The coffee screen's promises (ticket 0823; Homepage card), in the order shown; the shortcuts one's {menu}, {help}
     * and {shortcuts} come from the app. */
    promises: Record<'device' | 'offline' | 'noAds' | 'pencil' | 'free' | 'shortcuts', InsideCopy>
    /** The coffee screen's Open source tile (ticket 0823); its View the source and star line are `coffee`'s. */
    openSource: { name: string; text: string }
    /** The coffee screen's Say hello tile (ticket 0823): {menu} and {feedback}, and its button, are the Menu's own labels. */
    sayHello: { name: string; text: string }
    /** The coffee screen's What's new tile (ticket 0824): its name and Every change, the link to the source's history. */
    whatsNew: { name: string; history: string }
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
      /** No account's list (ticket 0742): the app's real features, in the order `homepage/freeList.ts` gives them; a
       * phone's Show all opens the rows past its first (ticket 0827). */
      free: { heading: string; rows: FreeRows; more: string; showAll: string }
      /** A new visitor's plans (ticket 0871): No account alone, its heading and the one line in place of the reason. */
      alone: { heading: string; why: string }
    }
    /** The phone strip's library button's name (ticket 0827): {library} is the Menu row's, "Projects library, 28". */
    library: string
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
    /** The Selection bar's move grip (ticket 0808): its name and its Tooltip. */
    moveSelection: string
    moveSelectionBody: string
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
    /** A catalog color's name from its Color catalog entry (ticket 0760): `{finish}` and `{family}` in the language's order. */
    catalogColorName: string
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
    /** On touch, the toast that says what an armed mode waits for (ticket 0845): Mirror mode with no Area, paste mode,
     * Pick color from canvas. */
    mirrorArmedHint: string
    pasteArmedHint: string
    pickArmedHint: string
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
    /** A Kaleidocycle's joins (ticket 0877): a triangle's Strip and Tetra, a Mirror pair, two pairs joined into the ring. */
    stepTetra: string
    stepPair: string
    stepRing: string
    stepClose: string
    ofSteps: string
    stepOfSteps: string
    /** The toast when rows marked done take a drawing back (ticket 0848), naming Row not done, or Column not done. */
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
    columnToBuy: string
    /** "2 × 5 g": the tubes to buy. */
    tubes: string
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
    /** The one toast once any file reached the device, a Project file, PNG or PDF, by download or into a picked file
     * (ticket 0859), with {file}. */
    savedFile: string
    /** The action of a file whose share needs a fresh tap (iPhone, iPad; ticket 306). */
    readySave: string
    /** The Export menu's last row and its modal (NameOnExports card). */
    nameOnExports: string
    changeName: string
    addName: string
    yourName: string
    nameHint: string
    saveName: string
    cancelName: string
    /** The toast of a file whose share needs a fresh tap, with {file}, before its Save action (ticket 0859). */
    readyToSave: string
  }
  /** The save ring (SaveReminder card, ticket 0796): its label and Tooltip, and what a screen reader hears. */
  saveReminder: {
    label: string
    body: string
    count: string
    lastFile: string
    noFile: string
    announce: string
    /** The label's count beside "Save Project file" (ticket 0858): "89 beads since the last file". */
    since: PluralForms
  }
  /** Open Project file and Save all Projects to a Project file, in the Projects library (ticket 0859: the file's one name). */
  transfer: {
    exportLibraryButton: string
    importLabel: string
    importedLabel: string
    /** Why a picked file didn't open (ticket 0859): not a Project file, a picture, a damaged Project file. */
    notProjectFile: string
    pictureFile: string
    damagedFile: string
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
    /** The Printable chart's two switches (ticket 0916, ExportPanel card): each name, its Info button's name and what it does. */
    largeBeadsLabel: string
    largeBeadsInfoLabel: string
    largeBeadsLine: string
    rowByRowLabel: string
    rowByRowInfoLabel: string
    rowByRowLine: string
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
    /** Why a Fringe earring's Width moved when its top was switched to peyote (ticket 0814); {count} is the new Width. */
    oddWidthNote: string
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
    /** The Progress bar's button with no Frame (ticket 0847): fits a Frame and opens Export on Picture. */
    fitAndExport: string
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
  /** Importing while a Project is open: what came in is in the library, and the question is whether to open it
   * (tickets 154, 0860). `{imported}` is the Project that would open. */
  importSwitch: {
    title: string
    /** `{current}` and `{imported}` are Project names. */
    messageOne: string
    /** `{count}` Projects came in; `{current}` is the open Project. */
    messageMany: string
    /** The open Project's last save didn't get through. */
    unsavedMessage: string
    switchButton: string
    switchAnywayButton: string
    keepButton: string
    saveButton: string
    /** One Project whose name `{taken}` the library already had, so it came in as `{imported}` (ticket 0860). */
    messageTaken: string
    /** `{count}` Projects came in, and some names were taken. */
    messageManyTaken: string
  }
  /** A pick in the Projects library asks only when the last save failed (ticket 0860); its message is
   * importSwitch.unsavedMessage. */
  switchProject: {
    title: string
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
    createButton: string
    /** The last button when opened from the reference image's All settings (ticket 0883). */
    addToCanvas: string
    /** The converter's leave confirmation (ADR 0086): asked once a picture is set. */
    leave: {
      title: string
      message: string
      confirmButton: string
      cancelButton: string
    }
    /** The Convert image wizard (spec 0645; ConvertImage, ValueSlider, FoundColorRow cards; writing.md). */
    wizard: {
      title: string
      /** Why Width, Colors, their buttons and Create Project are off until a picture is set. */
      addPictureFirst: string
      chooseFile: string
      paste: string
      takePhoto: string
      turn: string
      /** The menu beside the picture's file name: Choose file and Paste. */
      replace: string
      /** The Picture section's Note until the first picture: every way in and the limits (formatImageLimits); the
       * keyboard one names the device's paste key, `{pasteKey}` (ticket 0846), as does `dropOrPaste`. */
      pictureNote: string
      pictureNoteTouch: string
      /** Under the file name: "256×192 px". */
      pictureSize: string
      dropHere: string
      dropOrPaste: string
      dropToUse: string
      dropToConvert: string
      dropLimits: string
      /** Keep the picture's shape (ticket 0780): the switch between Width and Height and its Info in each state. */
      keepShape: string
      keepShapeOn: string
      keepShapeOff: string
      /** The preview's floating bar (ticket 0780; Select is the editor's tool name): its tools. */
      makeEmpty: string
      compare: string
      /** The Background step (ticket 0780): the switch and its Info (ticket 0894), the stage in hand as a numbered line
       * (ticket 0863), what was found, Tolerance and its ends, and what was removed (`{count}` beads). */
      removeBackground: string
      removeBackgroundOff: string
      stageFind: string
      stageRemove: string
      foundLine: string
      tolerance: string
      toleranceMin: string
      toleranceMax: string
      /** Tolerance's info button (ticket 0817): its accessible name and the Tooltip saying what it changes. */
      toleranceInfoLabel: string
      toleranceInfo: string
      removeFound: string
      removed: string
      removedLine: PluralForms
      showFound: string
      /** The Background tool (ticket 0787): its name on the floating bar, and Start over for its steps. */
      backgroundTool: string
      startOver: string
      /** No picture yet (the column and its foot), and the lines on what the preview shows now (ticket 0896): Make empty's
       * and Compare's chips, and the Background popover's tool line. */
      bandEmpty: string
      bandMakeEmpty: string
      bandBackground: string
      bandCompare: string
      /** The result's line after a kept part's size: the whole grid it was kept from. */
      resultKeptFrom: string
      /** Size (ticket 0747): the unit row's label ("units", ticket 0863), a slider's value in each unit, its max end
       * ("max {value}"), and what Width does, behind its Info. */
      units: string
      widthBeads: string
      widthMm: string
      maxLabel: string
      widthHint: string
      /** The Colors slider's hint, `{n}` every color the picture has; the Color by color row and its empty count. */
      colorsHint: string
      /** The hint while the picture has more colors than the slider offers (MAX_IMAGE_COLORS). */
      colorsHintCapped: string
      colorByColor: string
      emptyCount: string
      /** The part's handles' names, each edge and corner. */
      crop: Record<CropHandle, string>
      /** The Large Schema Note; `{beads}` is the threshold. */
      largeSchema: string
      /** The result: the grid size, and the ratio exact, approximate or one pixel as beads. */
      resultGrid: string
      resultExact: string
      resultApprox: string
      resultPerPixel: string
      /** The footer's color count after the size. */
      colorsCount: PluralForms
      /** The preview's accessible name. */
      previewName: string
      previewEmpty: string
      zoomLevel: string
      /** The Colors section's source control and what each source does. */
      matchTo: string
      beadColors: string
      /** Match to's first option: the Bead's palette, `{bead}` its maker, name and shape; and the Note under it. */
      beadPalette: string
      beadPaletteNote: string
      defaultPalette: string
      exact: string
      codesInSize: string
      /** The found-colors table's headings (Empty and Change are the buttons' names). */
      fromPicture: string
      becomes: string
      beadsColumn: string
      /** A found color's actions and states (FoundColorRow card). */
      keepExact: string
      change: string
      empty: string
      noBead: string
      keptExact: string
      remapped: string
      pictureColor: string
      newPalette: string
      /** A found color's row, as a screen reader names it. */
      rowName: PluralForms
      /** The empty preview on touch (ticket 0846): where the picture goes and the ways in, nothing to drop. */
      emptyTouchTitle: string
      emptyTouchLine: string
      /** What match to's Default Palette and Exact do (ticket 0863), as beadPaletteNote is the Bead palette's. */
      defaultPaletteNote: string
      exactNote: string
      /** The Colors slider's hints under Exact (ticket 0863): its colors are not beads to buy. */
      colorsHintExact: string
      colorsHintExactCapped: string
      /** The Info buttons' names (ticket 0894): Width's, one setting's (`{name}`: Colors, Keep the picture's shape,
       * Remove background) and match to's. */
      whatSizeDoes: string
      whatDoes: string
      whereColorsFrom: string
      /** The quiet converter's column (ticket 0896, DS-1): its labels, the "More for …" buttons beside Width and Colors,
       * the line under Colors for each source (`{bead}` the Bead in lower case), the Size popover's title, Colors' name,
       * the drop zone's Info, the file being read (`{file}`, `{mb}`) and the column's line meanwhile, and the ··· menu's Flip. */
      pictureLabel: string
      beadAndTechnique: string
      moreForSize: string
      moreForColors: string
      matchedBead: string
      matchedDefault: string
      matchedExact: string
      sizeTitle: string
      colorsLabel: string
      whatPictures: string
      readingDetail: string
      readingLine: string
      flipLeftRight: string
      /** My beads (ticket 0902): the source's name and its note in Where colors come from (`{size}` the Bead's size), the
       * line under Colors, the foot's colors line when the list is shorter than asked (`{codes}` its codes), the count
       * line, the match to menu's last item, and the My beads view's head, empty state, switch, count and rows. */
      myBeads: {
        name: string
        note: string
        matched: PluralForms
        fewerColors: PluralForms
        codesInList: string
        edit: string
        choose: string
        codes: PluralForms
        noCodes: string
        back: string
        whatIs: string
        whatIsBody: string
        catalog: string
        empty: string
        allCodes: string
        shown: string
        rowOwned: string
      }
      footProject: string
      footAddsTo: string
      resultBeadsNeeded: string
      resultBeadsNeededCount: string
      resultGoesWhere: string
      /** The crop on the picture (ticket 0898): the kept chip ("keeping 34×38", Keep all) and the size chip's measure. */
      keeping: string
      keepAll: string
      cropMeasure: string
      /** Clean up (ticket 0906, DS-3): the popover's title, the button's name (`{line}` its first line), Info, switch,
       * steps and their off reason, the counts, the pixel-art lines, and Small colors join with its Info, stepper names
       * and result (`colorsJoined` then `joinedBeads`, joined by " · "). */
      cleanUp: {
        title: string
        buttonName: string
        whatDoes: string
        whatDoesBody: string
        strayBeads: string
        strength: string
        light: string
        medium: string
        strong: string
        turnOnFirst: string
        cleaned: PluralForms
        none: string
        smallJoined: PluralForms
        off: string
        left: PluralForms
        offForPixelArt: string
        everyPixel: string
        pixelArtLine: string
        singleKept: PluralForms
        smallColors: string
        smallColorsWhat: string
        smallColorsBody: string
        under: string
        leastBeads: string
        fewer: string
        more: string
        stepOff: string
        colorsJoined: PluralForms
        joinedBeads: PluralForms
        everyColorStays: string
      }
      /** Compare (ticket 0909): the chips over its halves, the narrow bar's Beads | Picture ("Show"), the preview's names. */
      compareChipPicture: string
      compareChipBeads: string
      compareShow: string
      compareBeads: string
      comparePicture: string
      compareSideBySideName: string
      comparePictureName: string
      /** Auto-fix lighting (ticket 0907, DS-3): the picture section's row and its switch, spec 0761's name. */
      autoFixLighting: string
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
    /** Convert image's floating bar (ticket 0780): Turn 90°, Flip, Select (keeping a part of the beads, or cropping the
     * picture), Make empty and Compare. */
    makeEmpty: string
    backgroundTool: string
    compare: string
    remapColor: string
    emptyColor: string
    /** "A, B, C." from the item names. */
    list: (names: readonly string[]) => string
    /** The second Tooltip lines of the Paint and Fill tiles, Rulers, Turn row direction and Row highlight (ticket 0844). */
    paint: string
    fill: string
    rulers: string
    rowDirection: string
    rowHighlight: string
    /** The Progress bar's Fit a Frame and export a picture (ticket 0847). */
    fitAndExport: string
    /** The Paste tile's line on touch, which has no hover or click (ticket 0845). */
    pasteToolTouch: string
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
    /** "Open “Scarf”?", with {name}. */
    largeTitle: string
    /** "31 million beads. Opening may be slow or fail.", {count} in millions. */
    largeMessage: string
    openAnyway: string
    cancelButton: string
  }
  /** The reference image (ReferenceImage card, ticket 0790): the strip button, the Project panel's section, Adjust. */
  referenceImage: {
    /** The strip button's name. */
    name: string
    /** The strip button's Tooltip body with no picture yet, and while it is shown or hidden. */
    addTooltip: string
    showTooltip: string
    hideTooltip: string
    /** The Project panel section's label, also the Adjust bar's. */
    section: string
    /** The folded section's summary: "50% · shown", with {opacity} and {state}. */
    summary: string
    shown: string
    hidden: string
    /** The Info Tooltip, with {maxSizeMb}. */
    info: string
    add: string
    /** The stored picture's facts: "2048 × 1536 · 412 KB", with {width}, {height} and {size}. */
    facts: string
    /** A stored size in kilobytes, with {count}. */
    kilobytes: string
    opacity: string
    /** One opacity choice, "50%", with {count}. */
    percent: string
    adjust: string
    adjustValue: string
    replace: string
    remove: string
    removeTitle: string
    removeMessage: string
    removeButton: string
    cancelButton: string
    /** A refused file, with {reason}, one of `reasons`. */
    refused: string
    /** Why a file is refused, one per ImageRejection, each to follow `refused`'s colon. */
    reasons: {
      heic: string
      svg: string
      unsupportedFormat: string
      tooLarge: string
      tooManyPixels: string
      decodeFailed: string
    }
    preparing: string
    fit: string
    /** Fit on a phone. */
    fitShort: string
    done: string
    /** The picture's name in Adjust for a screen reader, with {opacity} and {angle}. */
    groupName: string
    corners: {
      'top-left': string
      'top-right': string
      'bottom-right': string
      'bottom-left': string
    }
    turn: string
    /** Announced after a turn, with {angle}. */
    turned: string
    moved: string
    resized: string
    /** The Project panel's save icon while the picture is not kept on this device. */
    notSaved: string
    /** The picture bar (ticket 0883): the Move grip's name and Tooltip, ··· and its pressed face, the opened part's short
     * Replace and Remove, and the size chip while a corner is dragged ({size} a Grid size, {measure} its measure). */
    bar: {
      move: string
      moveBody: string
      more: string
      close: string
      replace: string
      remove: string
      sizeBeads: string
      sizeMeasure: string
    }
    /** Set Frame around the picture (ticket 0883): its name, Tooltip with and without a Frame, and the preview's tag. */
    frameAround: {
      name: string
      body: string
      bodyNew: string
      tag: string
    }
    /** Convert to beads (ticket 0883): the button, the popover, the preview's pill, the toast and why it is off. */
    convert: {
      name: string
      body: string
      size: string
      sizeInfoName: string
      sizeInfo: string
      /** The size's measure, with {measure}. */
      measure: string
      /** The colors' count, with {count} and {max}. */
      colorsCount: string
      colorsLess: string
      colorsMore: string
      hideAfter: string
      allSettings: string
      button: PluralForms
      replaces: PluralForms
      preview: string
      /** The toast, with {n} and {colors}, its form chosen by {colors}. */
      made: PluralForms
      hidden: string
      tooSmall: string
      tooBig: string
    }
  }
  /** What an empty field says goes in it (ticket 0854, TextField card): a placeholder, never a value. */
  fields: {
    projectName: string
    frameName: string
    pieceName: string
    feedbackMessage: string
    feedbackShown: string
    feedbackShouldSay: string
    feedbackCode: string
    feedbackLooksLike: string
    feedbackNote: string
    feedbackEmail: string
    /** Under a name edited in place that is longer than the limit, with {max}. */
    tooLong: string
  }
}

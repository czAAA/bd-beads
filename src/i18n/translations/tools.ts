import type { PluralForms } from '../plural'

/** The Tool pill, Mirror, the tools, the Toolbox, the ContextBar, the input mode, Keyboard shortcuts and the Tooltips. */
export interface ToolsTranslations {
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
    /** The toast of a tile's first tap on touch (ticket 0927): its Tooltip's `{name}` and `{line}`. */
    tileNamed: string
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
    /** Why Radial's + is off on a Technique with a half-bead shift, at any size (ticket 1094): `{count}` the most Fold,
     * `{mode}` the Mode's name, `{technique}` the Technique's. Says the Fold, not parts: in Mirror mode Fold 2 is four. */
    foldMostOnTechnique: string
    /** Why an Axis count's + is off on a Canvas Area where no size fits more Axes (ticket 1027): the half-bead shift in
     * Mirror mode. */
    moreAxesShift: string
    /** The Message once a bar setting grew the Canvas Area to fit (ticket 1027): `{size}` as the readout writes it, the
     * Mode `{mode}` and `{axes}`, the counts it grew for (one, or both joined by `bothAxes`); for Radial its Fold. */
    grownForAxes: string
    grownForFold: PluralForms
    leftRightAxesCount: PluralForms
    topBottomAxesCount: PluralForms
    bothAxes: string
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
  contextBar: {
    label: string
    clearButton: string
    /** The "…" overflow of the Selection bar when its controls do not fit (ticket 415). */
    moreLabel: string
    /** The Selection bar's move grip (ticket 0808): its name and its Tooltip. */
    moveSelection: string
    moveSelectionBody: string
    /** The same grip on a Piece's shape (ticket 1013): its name and what it does. */
    movePiece: string
    movePieceBody: string
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
    /** Pick color's touch hint while the reference image is shown (ticket 1119). */
    pickArmedPictureHint: string
  }
  /** The input mode toggle (ticket 325; CONTEXT.md: Pen mode, Mouse mode). */
  inputMode: {
    penLabel: string
    mouseLabel: string
    penHint: string
    mouseHint: string
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
  /** The `?` shortcuts help overlay (ticket 96): every keyboard shortcut, grouped by Tool group. Key labels
   * themselves (digits, letters, "⌘C" or "Ctrl+C") are locale-neutral and built inline in ShortcutsHelp.vue rather than
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
    /** The Radial toolbox's row (ticket 1064): a right click on the Canvas, not a key. */
    toolsAtPointer: string
    /** Ticket 88's whole Colors group, summarized as one row rather than one per swatch. */
    paletteColors: string
    /** The switch at the top of Keyboard shortcuts (ticket 438) and its two choices. */
    keyHints: string
    keyHintsOn: string
    keyHintsOff: string
    /** The two Pastes named apart in the list (ticket 0993): the pill's tool and the clipboard's key. */
    pasteTool: string
    pasteClipboard: string
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
     * picture), Leave a color out and Compare. */
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
    /** Why the Rulers toggle is held while the Canvas is empty (ticket 0921). */
    noBeadsToNumber: string
    /** The Frame button's Tooltip with Beads needed's total, while there is one (ticket 0932). */
    framePanelBeads: string
  }
}

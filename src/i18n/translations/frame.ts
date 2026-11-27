import type { FrameShapeId, FrameSettingName } from '../../domain/frameShape'
import type { PluralForms } from '../plural'

/** The Frame, its panel and its export section. */
export interface FrameTranslations {
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
    selectAPieceFrame: string
    selectPieceFrameHint: string
    selectPieceFrameTouchHint: string
    selectFrameHint: string
    exportNeedsFrame: string
    sizeHeading: string
    exportPicture: string
    exportChart: string
    /** The export rows' third button (ticket 1121): the Project's .openbeads file, by the Save Project file action. */
    exportProjectFile: string
    exportProjectFileBody: string
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
    qualityPdfCapped: string
    /** The Letters switch in the Frame panel (ticket 0573), its explanation and the name of the info button that holds it (ticket 0651). */
    lettersLabel: string
    lettersLine: string
    lettersInfoLabel: string
    /** The Printable chart's switches (tickets 0916, 1096, ExportPanel card): each name, its Info button's name and what it does. */
    coverPageLabel: string
    coverPageInfoLabel: string
    coverPageLine: string
    blackAndWhiteLabel: string
    blackAndWhiteInfoLabel: string
    blackAndWhiteLine: string
    /** Empty grid and Chart border (ticket 1127, ExportPanel card): the empty positions' outline and cross, and the chart's rim. */
    emptyGridLabel: string
    emptyGridInfoLabel: string
    emptyGridLine: string
    chartBorderLabel: string
    chartBorderInfoLabel: string
    chartBorderLine: string
    largeBeadsLabel: string
    largeBeadsInfoLabel: string
    largeBeadsLine: string
    rowByRowLabel: string
    rowByRowInfoLabel: string
    rowByRowLine: string
    rowByRowWayLabel: string
    rowByRowWayProgress: string
    rowByRowWayLine: string
    /** The line under the print switches (ticket 1096, ExportPanel card), before the PDF's file name; the word each switch adds
     * to that name, after an underscore; and the pencil that renames the file for this export, its name and Tooltip. */
    savesAs: string
    /** The fold that holds the Export panel's quality and switches (ticket 1210). */
    exportSettings: string
    /** The maker's name row of the Export panel, the Project's own (ticket 1210; NameOnExports card). */
    nameOnExports: string
    /** The Export panel's first line over a Selection: its size in beads. */
    exportingSelection: string
    /** A Selection export's file name in the Frame's place when no named Piece gives one. */
    partFileName: string
    fileWordCover: string
    fileWordBlackAndWhite: string
    fileWordEmptyGrid: string
    fileWordChartBorder: string
    fileWordLargeBeads: string
    fileWordRowByRow: string
    fileNameEdit: string
    fileNameTooltip: string
    /** The Frame panel's margin section and the margin color picker (ticket 0656, MarginSheet card): its heading, the
     * picker's name, the Auto swatch's name and accessible name, the name of the swatch that is the Canvas color, and the
     * line under the picker. */
    /** The Frame's Background picker's radio group name (tickets 0666, 0670). */
    background: { label: string }
    /** The margin sheet (tickets 0656, 0657; MarginSheet card): the Frame panel's section, its color, the title block's
     * Switch and the title block's Technique pencil. */
    margin: { heading: string; colorLabel: string; auto: string; autoLabel: string; canvasColorLabel: string; line: string; titleBlock: string; changeTechnique: string; changeSetting: string; foldTitleBlock: string; showTitleBlock: string; showTitleBlockOf: string; frameTools: string }
    qualityHintLabel: string
    /** The Export quality Info note: each stop's DPI, {low}, {medium} and {high} (ticket 0957). */
    qualityHint: string
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
    fitToDrawing: string
    removeFrame: string
    /** The question before Remove frame (tickets 426, 1215): the message names Row progress once a pass is done. */
    removeConfirmTitle: string
    removeConfirmMessage: string
    removeConfirmMessageDone: string
    removeConfirmButton: string
    removeAndCopyButton: string
    removeConfirmCancel: string
    addFromStarter: string
    addFrameButton: string
    /** A new Frame's name (spec 1214, ticket 1222): "Frame {n}", n the lowest number no Frame uses. */
    defaultName: string
    /** The refusal naming the Frame in the way: `{name}`. */
    meetsFrame: string
    /** The Project panel's Frames: the "frames" section's heading (ticket 1250), the add ways' heading, why they are off
     * at the most Frames (counted, the most Frames), and the names of a Frame row's three buttons. */
    framesHeading: string
    addFrameHeading: string
    framesFull: PluralForms
    showFrame: string
    exportThisFrame: string
    removeThisFrame: string
    /** What Rotate Frame and a Frame Technique change ask once a pass is done (ticket 1184; ConfirmDialogs card); Cancel
     * is removeConfirmCancel. Columns where the way runs across as seen; `{way}` is the way's name, lowercased. */
    wovenAsk: {
      rotateTitle: string
      techniqueTitle: string
      rowsDone: PluralForms
      columnsDone: PluralForms
      rotateReset: string
      rotateKeep: string
      startOverTechnique: string
      keepRows: PluralForms
      keepColumns: PluralForms
    }
    /** The one line under a Frame control that says what the Frame is. */
    /** The size tooltip at the Frame's bottom-right corner while it is being set: "13×13 ≈ 2.1 × 2.1 cm". */
    sizeTooltip: string
    announceSet: string
    announceRemoved: string
    announceMoved: string
    /** Fit to drawing with nothing drawn: there is nothing to wrap. */
    announceNothingToFit: string
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
    /** Expand the Frame (MarginSheet card, ticket 1169): the margin sheet's first button, its name while expanded, and
     * the announcement of a press that expands it (the one back says the button's own name). */
    expandFrame: string
    backToCanvas: string
    announceFrameExpanded: string
    /** Export without a Frame opens a dialog with this title. */
    countNeedsFrame: string
    /** The Message after Rotate turned the Selection onto beads (ADR 0052). */
    rotateCoveredMessage: string
    /** Each Export quality stop's caption in a crafter's words (ticket 0957); the DPI is in `qualityHint`. */
    qualityLowCaption: string
    qualityMediumCaption: string
    qualityHighCaption: string
    /** The Drag a Frame notice on touch (ticket 0954): a finger has no Escape key, and picking a tool cancels. */
    selectFrameTouchHint: string
    /** The size fields' range line (ticket 0978), shown when a key is refused or a typed side is brought into range; {min} and {max} are numbers of beads. */
    widthRange: string
    heightRange: string
  }
}

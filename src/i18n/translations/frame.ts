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
    largeBeadsLabel: string
    largeBeadsInfoLabel: string
    largeBeadsLine: string
    rowByRowLabel: string
    rowByRowInfoLabel: string
    rowByRowLine: string
    /** The line under the print switches (ticket 1096, ExportPanel card), before the PDF's file name; the word each switch adds
     * to that name, after an underscore; and the pencil that renames the file for this export, its name and Tooltip. */
    savesAs: string
    fileWordCover: string
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
    /** The Message after Rotate turned the Selection onto beads (ADR 0052). */
    rotateCoveredMessage: string
    /** The Progress bar's button with no Frame (ticket 0847): fits a Frame and opens Export on Picture. */
    fitAndExport: string
    /** Each Export quality stop's caption in a crafter's words (ticket 0957); the DPI is in `qualityHint`. */
    qualityLowCaption: string
    qualityMediumCaption: string
    qualityHighCaption: string
    /** The Progress bar's line with no Frame, after its Select and Frame chips: what a Frame gives, then how to set one
     * (ticket 0944). The line is a button that picks the Select tool. */
    progressMarkPiece: string
    /** The Drag a Frame notice on touch (ticket 0954): a finger has no Escape key, and picking a tool cancels. */
    selectFrameTouchHint: string
    /** The size fields' range line (ticket 0978), shown when a key is refused or a typed side is brought into range; {min} and {max} are numbers of beads. */
    widthRange: string
    heightRange: string
  }
}

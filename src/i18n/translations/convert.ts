import type { CropHandle } from '../../domain/convertSize'
import type { PluralForms } from '../plural'

/** Convert image. */
export interface ConvertTranslations {
  // Convert image (CONTEXT.md, ADR 0010). Strings holding `{formats}` or `{maxSizeMb}` are
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
    /** The Convert image wizard (spec 0645; ConvertImage, ValueSlider, FoundColorRow cards; `copy/convert.md`). */
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
      /** No picture yet (the column and its foot), and the lines on what the preview shows now (ticket 0896): Leave a color out's
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
      /** Match to's first option: the Bead's palette, `{bead}` its maker, name and shape; and the Note under it. */
      beadPalette: string
      beadPaletteNote: string
      /** The Bead palette's note for a catalog with measured colors (ticket 0886), as beadPaletteNote. */
      beadPaletteNotePhotos: string
      /** The same for a catalog whose colors were read from TOHO's sample cards (ticket 1068). */
      beadPaletteNoteCards: string
      defaultPalette: string
      exact: string
      codesInSize: PluralForms
      /** The count line's measured part (ticket 0905): the codes left in the Finishes whose color was read. */
      measuredIn: string
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
      /** The Colors list's back arrow in a docked layout's sheet (ticket 0919). */
      backToColorsCount: string
      /** The dock's Picture and Bead settings, at most 9 letters (ConvertImage card DS-4, ticket 0911). */
      dockPicture: string
      dockBead: string
      sheetBeadAndTechnique: string
      /** The dock's row of five settings, as a group's name. */
      settingsLabel: string
      /** A dock sheet's Close button. */
      sheetClose: string
      /** A dock setting's accessible name: "Width: 60 beads". */
      settingName: string
      matchedBead: string
      matchedDefault: string
      matchedExact: string
      sizeTitle: string
      colorsLabel: string
      whatPictures: string
      readingDetail: string
      readingLine: string
      flipLeftRight: string
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
       * steps and their off reason, the counts, the pixel-art lines, and Drop colors used by few beads with its Info, stepper names
       * and result (`colorsJoined` then `joinedBeads`, joined by " · "). */
      cleanUp: {
        title: string
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
        /** The Clean up button's first line with its name before it (ticket 0966): "Clean up · off for pixel art". */
        named: string
      }
      /** Compare (ticket 0909): the chips over its halves, the narrow bar's Beads | Picture ("Show"), the preview's names. */
      compareChipPicture: string
      compareChipBeads: string
      compareShow: string
      compareBeads: string
      comparePicture: string
      compareSideBySideName: string
      comparePictureName: string
      /** The match kept to chosen Finishes (ticket 0901, DS-2): the line under Colors with Finishes on (`{finishes}` their
       * names in lower case, or `{count}` of them from 4), the Finish button's name with its count, why it is off, the
       * too-few line and the foot's colors line (`{colors}` the colors, `{codes}` codesLeft), and Finish's note. */
      finish: {
        matched: string
        matchedMany: PluralForms
        /** What joins the Finish names in `matched`: a short list, not a sentence, so no "and" (", ", Chinese "、"). */
        separator: string
        buttonOn: string
        offDefault: string
        offExact: string
        tooFew: PluralForms
        colorsShort: string
        codesLeft: PluralForms
        note: string
      }
      /** Auto-fix lighting (ticket 0907, DS-3): the picture section's row and its switch, spec 0761's name. */
      autoFixLighting: string
      /** One color fewer and one more (ticket 0904, DS-2): the card's and its field's name, the field's label and range
       * (`{max}` the most colors), the ends in place of a neighbour, the slider's right end past its last value
       * (`{value}`), and why a neighbour that gives the beads shown is off. */
      neighbours: {
        name: string
        typeNumber: string
        range: string
        noFewer: string
        noMore: string
        pastEnd: string
        same: string
      }
      /** Brightness, Contrast and Saturation behind Auto-fix lighting (ticket 0908, DS-3): the sun button, the Lighting
       * popover, each slider's name, ends (less, more) and reset, and the column's line naming the moved ones. */
      lighting: {
        more: string
        title: string
        whatDoes: string
        whatDoesBody: string
        brightness: string
        contrast: string
        saturation: string
        ends: Record<'brightness' | 'contrast' | 'saturation', readonly [string, string]>
        reset: string
        atZero: string
        moved: string
      }
      /** Fewer colors found than asked (ticket 0928): the Colors slider's value with both numbers, and the result's
       * colors where the picture has no more to give in the colors matched to. */
      fewerFound: {
        asked: string
        allGiven: string
      }
      /** The chip over the beads while the background is found and the Background popover is closed (ticket 0930): what
       * was found, then Remove what was found and Turn off. */
      backgroundChip: string
      backgroundTurnOff: string
      /** `exact`'s short name, where a segmented control has no room for it: Convert to beads on the Canvas (ticket 0966). */
      exactShort: string
      /** The foot's name as a screen reader lists the converter's regions (ticket 0995): what the picture makes. */
      resultLabel: string
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
    /** Create Project's toast (ticket 0968, Message card): the Project it made, `{name}`, and where it is kept. */
    createdToast: string
  }
}

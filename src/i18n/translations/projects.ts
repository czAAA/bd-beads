import type { FrameShapeId, FringeStyle } from '../../domain/frameShape'
import type { BandFit, StarterCategoryId, StarterSizeName } from '../../domain/starters'
import type { PluralForms } from '../plural'

/** The Projects library, the Starters, saving, the Save reminder, Project files, switching and deleting Projects. */
export interface ProjectsTranslations {
  projects: {
    heading: string
    /** The Saved Projects list while the library hasn't arrived (spec 1018). */
    loading: string
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
    /** "24 × 30 beads": a framed Project's size, on its library row (ticket 0982), with {width} and {height}. */
    rowSize: string
    /** A row's Piece count over the size gate, never counted (ticket 0716). */
    tooBigToCount: string
    /** The Tooltip of a row's count still being worked out in idle time (ticket 0716). */
    countingPieces: string
    /** "31 771 024 beads": a sealed Project's bead count, in its row (ticket 0716). */
    beads: PluralForms
    /** A sealed Project's row: "made {created} · saved {saved}", dates in the app's language (ticket 0716). */
    sealedDates: string
    /** "saved Nov 12": a library row's last save, the date short in the app's language (ticket 0982). */
    savedOn: string
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
    /** The folded row over Name and the Layer settings in a Starter's setup (ticket 0952), its values beside it. */
    beadsAndTechnique: string
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
    /** In place of the count while the Project has never had a file (ticket 0987): why to save. */
    noFileWhy: string
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
}

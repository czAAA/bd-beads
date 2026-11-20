import type { PluralForms } from '../plural'

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

/** The Menu and Project panels, the Techniques and their settings, Layer settings, the Schema tag and a Piece's name. */
export interface PanelsTranslations {
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
      /** Delete all Projects? with the count (ticket 0984). */
      deleteAllTitle: PluralForms
      deleteAllMessage: string
      deleteAllConfirm: string
      /** The Help row and the Language row's link that open the Feedback sheet (ticket 0700). */
      sendFeedback: string
      reportTranslation: string
      /** The row that shows whether the browser keeps the Projects (tickets 0839, 0936), its value, and its Info
       * button's name and Tooltip, which say why. */
      keepProjects: string
      keepProjectsOn: string
      keepProjectsOff: string
      keepProjectsInfoLabel: string
      keepProjectsInfo: string
      /** Help's row that shows every strip and pill button's name at once (ticket 0927). */
      buttonNames: string
      /** Preferences' Lifted pieces switch (ticket 1042), with what it does behind its Info button. */
      liftedPieces: string
      liftedPiecesInfoLabel: string
      liftedPiecesInfo: string
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
      /** Said under 1024px, where the strip shows no name, when a Project opens from the library (ticket 0986). */
      openedToast: string
      /** After Delete of the open Project (ticket 0983): `{name}` is the deleted one, `{open}` the one open now. */
      deletedToast: string
    }
  }
  /** The Techniques' names, by each Technique's name key (ADR 0078): open, so a new Technique is its entry and its strings;
   * `registryNames.test.ts` checks every key is in every language. */
  techniques: Readonly<Record<string, string>>
  /** A Technique setting's words, by its label key (ADR 0078, ticket 0624): open like `techniques`, so a new setting is
   * its entry and its strings; `registryNames.test.ts` checks every key is in every language. */
  weaveSettings: Readonly<Record<string, SettingWords>>
  /** The Name Piece dialog (ticket 406). */
  pieceName: {
    title: string
    label: string
    hint: string
    save: string
    cancel: string
  }
  /** A layer's Layer settings (ADR 0079, ticket 0670): the Frame panel's section heading, and the Background row's label
   * in every layer's. */
  layerSettings: {
    frameHeading: string
    background: string
    /** The Project panel's Canvas section header while a Frame is on the Canvas (ticket 0935), as label style writes it. */
    canvasOutsideFrame: string
    /** The toast after a change of the Canvas's Technique or Bead leaves the Frame on another (ticket 0935); its two
     * text actions, the Frame panel's own change and the Frame panel on its settings. */
    frameStays: string
    changeFrameToo: string
    openFrame: string
  }
  /** An unframed Schema's name as a tag, opening into a paper tag (SchemaTag card, ticket 0721; `copy/panels.md`,
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
}

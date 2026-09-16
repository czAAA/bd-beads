export type Locale = 'en' | 'ru'

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
    unitLabel: string
    unitMm: string
    unitCm: string
    submit: string
  }
  languageSwitcher: {
    ariaLabel: string
  }
  patterns: {
    heading: string
    newPatternButton: string
    removeButton: string
    currentLabel: string
  }
  canvas: {
    zoomInLabel: string
    zoomOutLabel: string
    zoomResetLabel: string
  }
  shell: {
    mainPanelPlaceholder: string
    canvasPlaceholder: string
  }
  palette: {
    heading: string
    pickerLabel: string
    colorLabel: string
    undoButton: string
    rotateButton: string
  }
  tools: {
    heading: string
    paintLabel: string
    fillLabel: string
  }
  rowProgress: {
    heading: string
    enabledLabel: string
    positionLabel: string
    previousButton: string
    nextButton: string
  }
  quantities: {
    heading: string
    noPatternMessage: string
    colorHeading: string
    countHeading: string
    resolvedBeadHeading: string
    defaultBeadHeading: string
    patternBeadHeading: string
    unmappedOption: string
    useDefaultOption: string
    unknownColorLabel: string
  }
  transfer: {
    heading: string
    exportPatternButton: string
    exportLibraryButton: string
    importLabel: string
    importedLabel: string
    importErrorLabel: string
  }
  mirror: {
    heading: string
    horizontalLabel: string
    verticalLabel: string
    mirrorCurrentHorizontalButton: string
    mirrorCurrentVerticalButton: string
  }
  catalog: {
    heading: string
    brandLabel: string
    nameLabel: string
    sizeLabel: string
    formFactorLabel: string
    formFactorCube: string
    formFactorRound: string
    formFactorCylinder: string
    colorLabel: string
    widthLabel: string
    heightLabel: string
    addButton: string
    editButton: string
    removeButton: string
    saveButton: string
    cancelButton: string
  }
}

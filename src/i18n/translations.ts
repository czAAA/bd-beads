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
  }
  tools: {
    heading: string
    paintLabel: string
    fillLabel: string
  }
  mirror: {
    heading: string
    enabledLabel: string
    horizontalLabel: string
    verticalLabel: string
    applyButton: string
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

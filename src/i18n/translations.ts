export type Locale = 'en' | 'ru'

export interface Translations {
  app: {
    title: string
  }
  form: {
    beadLabel: string
    techniqueLabel: string
    techniqueLoom: string
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
}

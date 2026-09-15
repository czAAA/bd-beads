import type { Translations } from './translations'

// Terms marked with a glossary entry in CONTEXT.md (Pattern, Bead, Technique) reuse that
// exact wording rather than retranslating.
export const ru: Translations = {
  app: {
    title: 'bd-beads',
  },
  form: {
    nameLabel: 'Название',
    beadLabel: 'Бисеринка',
    techniqueLabel: 'Техника плетения',
    techniqueLoom: 'Ткачество',
    widthLabel: 'Ширина',
    heightLabel: 'Высота',
    unitLabel: 'Единица измерения',
    unitMm: 'мм',
    unitCm: 'см',
    submit: 'Создать схему',
  },
  languageSwitcher: {
    ariaLabel: 'Язык интерфейса',
  },
  patterns: {
    heading: 'Сохранённые схемы',
    newPatternButton: 'Новая схема',
    removeButton: 'Удалить',
    currentLabel: 'Сейчас редактируется',
  },
  canvas: {
    zoomInLabel: 'Увеличить',
    zoomOutLabel: 'Уменьшить',
    zoomResetLabel: 'Сбросить масштаб по размеру схемы',
  },
  shell: {
    mainPanelPlaceholder: 'Инструменты — скоро',
  },
}

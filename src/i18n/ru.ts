import type { Translations } from './translations'

// Terms marked with a glossary entry in CONTEXT.md (Pattern, Bead, Technique, Palette, Form factor) reuse
// that exact wording rather than retranslating.
export const ru: Translations = {
  app: {
    title: 'bd-beads',
  },
  form: {
    nameLabel: 'Название',
    beadLabel: 'Бисеринка',
    techniqueLabel: 'Техника плетения',
    techniqueLoom: 'Ткачество',
    techniquePeyote: 'Мозаичное плетение',
    techniqueBrick: 'Кирпичное плетение',
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
    canvasPlaceholder: 'Схема пока не открыта',
  },
  palette: {
    heading: 'Палитра',
    pickerLabel: 'Цвета палитры',
    colorLabel: 'Цвет',
    undoButton: 'Отменить',
  },
  tools: {
    heading: 'Инструмент',
    paintLabel: 'Кисть',
    fillLabel: 'Заливка',
  },
  mirror: {
    heading: 'Отражение',
    enabledLabel: 'Отражение включено',
    horizontalLabel: 'Горизонталь',
    verticalLabel: 'Вертикаль',
    applyButton: 'Применить отражение',
  },
  catalog: {
    heading: 'Каталог бисера',
    brandLabel: 'Бренд',
    nameLabel: 'Название',
    sizeLabel: 'Размер',
    formFactorLabel: 'Форм-фактор',
    formFactorCube: 'Куб',
    formFactorRound: 'Круглый',
    formFactorCylinder: 'Цилиндр',
    colorLabel: 'Цвет',
    widthLabel: 'Ширина (мм)',
    heightLabel: 'Высота (мм)',
    addButton: 'Добавить бисеринку',
    editButton: 'Редактировать',
    removeButton: 'Удалить',
    saveButton: 'Сохранить',
    cancelButton: 'Отмена',
  },
}

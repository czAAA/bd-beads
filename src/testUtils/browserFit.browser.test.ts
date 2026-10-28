import { defineComponent, h } from 'vue'
import { expect, it } from 'vitest'
import { be } from '../i18n/be'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { pl } from '../i18n/pl'
import { ru } from '../i18n/ru'
import { uk } from '../i18n/uk'
import { zh } from '../i18n/zh'
import { misfitsNow, mountAt, waysIn } from './browserFit'
import { showLongestText, showRussian } from './longestText'
import MenuPanel from '../components/shell/MenuPanel.vue'

// The measurement has to see what it is for: a one-line button too narrow for its words is a misfit, a roomy one is not.
const button = (width: number) => defineComponent({ render: () => h('button', { style: { width: `${width}px`, overflow: 'hidden', whiteSpace: 'nowrap' } }, 'Right-angle weave and more') })

it('reports a button whose text is wider than the button', async () => {
  const mounted = await mountAt(button(40), {}, { locale: 'en', width: 1024 })
  expect((await misfitsNow()).length).toBeGreaterThan(0)
  mounted.unmount()
})

it('reports nothing for a button with room', async () => {
  const mounted = await mountAt(button(400), {}, { locale: 'en', width: 1024 })
  expect(await misfitsNow()).toEqual([])
  mounted.unmount()
})

it('renders in the language it is asked for, every time', async () => {
  const texts: string[] = []
  for (const locale of ['en', 'ru', 'en', 'zh', 'longest', 'ru'] as const) {
    const mounted = await mountAt(MenuPanel, { projects: [], penSeen: true }, { locale, width: 1024 })
    texts.push(mounted.root.textContent ?? '')
    mounted.unmount()
  }
  expect(texts[1]).not.toBe(texts[0])
  expect(texts[2]).toBe(texts[0])
  expect(texts[3]).not.toBe(texts[0])
  expect(texts[4]).not.toBe(texts[1])
  expect(texts[5]).toBe(texts[1])
})

it('shows, in the longest text, each string as its widest translation and each count in its widest words', async () => {
  const russian = { makerName: ru.form.makerNameLabel, rightAngle: ru.techniques.rightAngle, pieces: ru.projects.pieces.few }
  const languages = [en, ru, uk, be, zh, es, pl]
  const piecesWords = languages.map(({ projects: { pieces } }) => pieces.few ?? pieces.other)
  const tabLines = languages.map(({ overview: { features: { projectEditing } } }) => projectEditing.tabLine ?? projectEditing.text)
  const names = ['Moth', 'Fern', 'Sky']
  const lists = languages.map((language) => language.tooltips.list(names))
  await showLongestText()
  try {
    // Spanish and English are the widest here, by 70 and 63 px at the UI's size.
    expect(ru.form.makerNameLabel).toBe(es.form.makerNameLabel)
    expect(ru.techniques.rightAngle).toBe(en.techniques.rightAngle)
    // A language with no "few" lends its "other": a Russian "few" count takes whichever language's words are widest.
    expect(piecesWords).toContain(ru.projects.pieces.few)
    // A tab shows a feature's shorter wording where its language has one, and its full one where not (Russian).
    expect(tabLines).toContain(ru.overview.features.projectEditing.tabLine)
    expect(lists).toContain(ru.tooltips.list(names))
  } finally {
    showRussian()
  }
  expect({ makerName: ru.form.makerNameLabel, rightAngle: ru.techniques.rightAngle, pieces: ru.projects.pieces.few }).toEqual(russian)
})

it('opens a Tooltip all three ways in English and by hover alone in the longest text', () => {
  expect(waysIn('en')).toEqual(['hover', 'focus', 'long press'])
  expect(waysIn('longest')).toEqual(['hover'])
})

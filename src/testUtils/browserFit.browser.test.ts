import { defineComponent, h } from 'vue'
import { expect, it } from 'vitest'
import { misfitsNow, mountAt } from './browserFit'
import LanguageSwitcher from '../components/shell/LanguageSwitcher.vue'

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
  for (const locale of ['en', 'ru', 'en', 'zh'] as const) {
    const mounted = await mountAt(LanguageSwitcher, {}, { locale, width: 1024 })
    texts.push(mounted.root.textContent ?? '')
    mounted.unmount()
  }
  expect(texts[1]).not.toBe(texts[0])
  expect(texts[2]).toBe(texts[0])
  expect(texts[3]).not.toBe(texts[0])
})

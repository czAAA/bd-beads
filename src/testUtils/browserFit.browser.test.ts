import { defineComponent, h } from 'vue'
import { expect, it } from 'vitest'
import { misfitsNow, mountAt } from './browserFit'

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

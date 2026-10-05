import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { provideI18n, type I18n } from './useI18n'

beforeEach(() => {
  localStorage.clear()
})

describe('provideI18n', () => {
  it('keeps lang on <html> in step with the app language', async () => {
    let i18n: I18n | undefined
    mount(
      defineComponent({
        setup() {
          i18n = provideI18n()
          return () => null
        },
      }),
    )
    expect(document.documentElement.lang).toBe('en')

    i18n!.setLocale('ru')
    await nextTick()
    expect(document.documentElement.lang).toBe('ru')
  })
})

describe('copy rules (writing.md)', () => {
  it('has no em dash in any string, in either language', async () => {
    const { en } = await import('./en')
    const { ru } = await import('./ru')
    expect(JSON.stringify(en)).not.toContain('—')
    expect(JSON.stringify(ru)).not.toContain('—')
  })
})

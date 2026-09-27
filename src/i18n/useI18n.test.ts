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
    expect(document.documentElement.lang).toBe('ru')

    i18n!.setLocale('en')
    await nextTick()
    expect(document.documentElement.lang).toBe('en')
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Locale } from '../domain/locale'
import { followAddressLocale, pagesBase } from './addressLocale'

/** A page at `path` under the test's base path (`/`), whose address changes as the app's would. */
function pageAt(path: string) {
  const url = new URL(path, 'https://openbeads.com/')
  const page = {
    location: { pathname: url.pathname, search: url.search, hash: url.hash },
    history: {
      state: { kept: true },
      replaceState(state: unknown, _unused: string, address: string) {
        const next = new URL(address, 'https://openbeads.com/')
        page.location = { pathname: next.pathname, search: next.search, hash: next.hash }
        page.replaced.push({ state, address })
      },
    },
    replaced: [] as { state: unknown; address: string }[],
  }
  return page
}

let undo = () => {}
afterEach(() => undo())

describe('a language code in the address (ticket 1053)', () => {
  it.each([
    ['/ru/', 'ru'],
    ['/zh/app/', 'zh'],
    ['/pl/app/?project=p1', 'pl'],
    ['/', undefined],
    ['/app/', undefined],
    ['/de/', undefined],
    ['/app/ru/', undefined],
  ] as const)('reads %s as naming %s: its first folder, when that is one of the app’s languages', (path, named) => {
    const chosen = ref<Locale>('uk')
    undo = followAddressLocale(chosen, pageAt(path))
    expect(chosen.value).toBe(named ?? 'uk')
    expect(pagesBase()).toBe(named ? `/${named}/` : '/')
  })

  it('makes the address’s language the device’s, and keeps the code on the language shown, the rest of the address kept', async () => {
    const page = pageAt('/ru/app/?project=p1#here')
    const chosen = ref<Locale>('en')
    undo = followAddressLocale(chosen, page)
    expect(chosen.value).toBe('ru')
    expect(pagesBase()).toBe('/ru/')

    chosen.value = 'pl'
    await nextTick()
    expect(page.replaced).toEqual([{ state: { kept: true }, address: '/pl/app/?project=p1#here' }])
    expect(pagesBase()).toBe('/pl/')
  })

  it('leaves an address with no code as it is, on the device’s language', async () => {
    const page = pageAt('/app/')
    const chosen = ref<Locale>('uk')
    undo = followAddressLocale(chosen, page)
    expect(chosen.value).toBe('uk')
    expect(pagesBase()).toBe('/')

    chosen.value = 'zh'
    await nextTick()
    expect(page.replaced).toEqual([])
    expect(pagesBase()).toBe('/')
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useDocumentTitle } from './useDocumentTitle'

describe('useDocumentTitle', () => {
  afterEach(() => {
    document.title = ''
  })

  it("names the open Project before the app's name, follows a switch, and says the app's name alone with none", async () => {
    const name = ref<string | undefined>('Loom cuff')
    const scope = effectScope()
    scope.run(() => useDocumentTitle({ projectName: () => name.value, appTitle: () => 'openbeads' }))
    expect(document.title).toBe('Loom cuff · openbeads')
    name.value = 'Summer bracelet'
    await nextTick()
    expect(document.title).toBe('Summer bracelet · openbeads')
    name.value = undefined
    await nextTick()
    expect(document.title).toBe('openbeads')
    scope.stop()
  })
})

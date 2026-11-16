import { describe, expect, it } from 'vitest'
import { MIRROR_OFF, type MirrorSetting } from '../../domain/mirror'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { mirrorGrownMessage } from './mirrorGrownMessage'

const repeat: MirrorSetting = { ...MIRROR_OFF, mode: 'repeat' }
const grown = (grewFor: { leftRight?: number; topBottom?: number; fold?: number }) => ({ area: { row: 0, column: 0, rows: 24, columns: 27 }, grewFor })

describe('mirrorGrownMessage (ticket 1027)', () => {
  it('names the new size, the Mode and only what the Area grew for', () => {
    expect(mirrorGrownMessage(en, 'en', repeat, grown({ leftRight: 2 }))).toBe('Mirror area grown to 27×24 so Repeat with 2 Left–right axes lines up.')
    expect(mirrorGrownMessage(en, 'en', repeat, grown({ leftRight: 2, topBottom: 1 }))).toBe('Mirror area grown to 27×24 so Repeat with 2 Left–right axes and 1 Top–bottom axis lines up.')
    expect(mirrorGrownMessage(en, 'en', repeat, grown({ fold: 4 }))).toBe('Mirror area grown to 27×24 so Radial with Fold 4 lines up.')
  })

  it('counts in the language\'s own plural forms', () => {
    expect(mirrorGrownMessage(ru, 'ru', repeat, grown({ leftRight: 2 }))).toBe('Область отражения увеличена до 27×24, и «Повтор» с 2 осями слева направо ложится ровно.')
    expect(mirrorGrownMessage(ru, 'ru', { ...MIRROR_OFF }, grown({ topBottom: 1 }))).toBe('Область отражения увеличена до 27×24, и «Отражение» с 1 осью сверху вниз ложится ровно.')
    expect(mirrorGrownMessage(ru, 'ru', repeat, grown({ fold: 4 }))).toBe('Область отражения увеличена до 27×24, и «По кругу» на 4 части ложится ровно.')
  })
})

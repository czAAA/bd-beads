import { describe, expect, it } from 'vitest'
import { ru } from './ru'
import { uk } from './uk'
import { zh } from './zh'

// One word per glossary noun per language (`writing.md`, Glossary; tickets 0864, 0994): a reader who meets a second
// word wonders whether it is a second thing.
function stringsOf(node: unknown, path = '', out: [string, string][] = []): [string, string][] {
  if (typeof node === 'string') out.push([path, node])
  else if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) stringsOf(value, path ? `${path}.${key}` : key, out)
  return out
}

describe('one word per thing', () => {
  it.each([
    ['Russian', 'a bead is бисеринка, never бусина or бисерина', ru, /бусин|бисерин(?!к|ок)/i],
    ['Ukrainian', 'a bead is бісерина, never намистина or бісеринка', uk, /намистин|бісеринк|бісеринок|бісеринці/i],
    ['Chinese', 'the Frame is 边框, never 画框', zh, /画框/],
  ] as const)('in %s %s', (_language, _rule, strings, other) => {
    expect(stringsOf(strings).filter(([, text]) => other.test(text)).map(([path]) => path)).toEqual([])
  })
})

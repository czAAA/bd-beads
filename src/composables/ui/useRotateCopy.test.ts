import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROTATE_COPY } from './useRotateCopy'

const css = readFileSync(resolve(__dirname, '../../styles/design-values.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const ms = (name: string) => parseFloat(new RegExp(`${name}:\\s*([^;]+);`).exec(css)![1]!)

describe('the Rotate copy (ticket 1016)', () => {
  it('keeps how it leaves equal to its CSS twins', () => {
    expect(ROTATE_COPY).toEqual({ wait: ms('--rotate-copy-wait'), fade: ms('--rotate-copy-fade'), tapHold: ms('--rotate-copy-tap-hold') })
  })
})

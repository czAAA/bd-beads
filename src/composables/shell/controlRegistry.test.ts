import { describe, expect, it } from 'vitest'
import { be } from '../../i18n/be'
import { en } from '../../i18n/en'
import { es } from '../../i18n/es'
import { pl } from '../../i18n/pl'
import { ru } from '../../i18n/ru'
import { uk } from '../../i18n/uk'
import { zh } from '../../i18n/zh'
import type { Translations } from '../../i18n/translations'
import { actionKey } from '../../components/ui/controlAction'
import type { Chord } from '../../domain/chord'
import type { Locale } from '../../domain/locale'
import { CONVERT_STEPS, CROP_HANDLES } from '../../domain/convertSize'
import { CONTROLS, chordMatches, controlAction } from './controlRegistry'
import { bareProject } from '../../testUtils/layerFields'

const LANGUAGES: Record<Locale, Translations> = { en, ru, uk, be, zh, es, pl }

interface Press {
  key?: string
  code?: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}

/** A key press as the shortcut table reads it: only these fields. */
function press(fields: Press): KeyboardEvent {
  return { key: '', code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...fields } as KeyboardEvent
}

/** Every distinct key press a chord is written to answer: each modifier, Shift state and key it lists. */
function pressesOf(chord: Chord): KeyboardEvent[] {
  const modifiers: Press[] = chord.mod ? [{ ctrlKey: true }, { metaKey: true }] : chord.ctrl ? [{ ctrlKey: true }] : [{}]
  const shifts = chord.shift === 'any' ? [false, true] : [!!chord.shift]
  const keys: Press[] = chord.code !== undefined ? [{ code: chord.code }] : (typeof chord.key === 'string' ? [chord.key] : (chord.key ?? [])).map((key) => ({ key }))
  return modifiers.flatMap((modifier) => shifts.flatMap((shiftKey) => keys.map((key) => press({ ...modifier, shiftKey, ...key }))))
}

/** The actions the shortcut table would run for a press. */
function answering(event: KeyboardEvent): string[] {
  return CONTROLS.filter((control) => control.chords.some((chord) => chordMatches(chord, event))).map((control) => control.id)
}

describe('the control registry', () => {
  it('has Rotate canvas and Rotate Frame, both without a key (ticket 471)', () => {
    for (const id of ['rotate-canvas', 'rotate-frame']) {
      expect(CONTROLS.filter((control) => control.id === id)).toHaveLength(1)
      expect(controlAction(id).chords).toEqual([])
    }
    expect(answering(press({ key: 'R', shiftKey: true }))).toEqual(['rotate'])
  })

  it('has no two actions that answer the same key or combination', () => {
    const clashes: string[] = []
    for (const control of CONTROLS) {
      for (const event of control.chords.flatMap(pressesOf)) {
        const ids = answering(event)
        if (ids.length > 1) clashes.push(`${JSON.stringify(event)}: ${ids.join(' and ')}`)
      }
    }
    expect(clashes).toEqual([])
  })

  it('counts a modifier-sensitive key shifted or not, and Ctrl or Cmd, as one action\'s', () => {
    // Zoom takes Ctrl/Cmd+= with or without Shift: a second action on Ctrl+Shift+= would clash.
    expect(answering(press({ key: '=', ctrlKey: true, shiftKey: true }))).toEqual(['zoom-in'])
    expect(answering(press({ key: '=', metaKey: true }))).toEqual(['zoom-in'])
  })

  it('defines each action once, with a name in every language', () => {
    expect(new Set(CONTROLS.map((control) => control.id)).size).toBe(CONTROLS.length)
    for (const control of CONTROLS) {
      for (const [locale, t] of Object.entries(LANGUAGES)) expect(control.name(t).trim(), `${control.id} in ${locale}`).not.toBe('')
    }
  })

  it('has the Convert image wizard\'s controls, none with a key of its own (ticket 0650)', () => {
    const ids = [
      'treat-as-empty',
      'size-linked',
      'size-unlinked',
      'remap-color',
      'empty-color',
      'auto-fix-lighting',
      'subject-outline',
      'convert-compare',
      ...CONVERT_STEPS.map((step) => `convert-step-${step}`),
      ...CROP_HANDLES.map((handle) => `crop-${handle}`),
    ]
    for (const id of ids) expect(controlAction(id).chords, id).toEqual([])
    expect(controlAction('convert-step-size').name(en)).toBe('size')
    expect(controlAction('crop-topLeft').name(en)).toBe('Crop: top-left corner')
  })

  it('gives Clear no key, and Del, Shift+Del and Shift+R each their own action, Backspace standing in for Del', () => {
    const idsFor = (key: string, shift: boolean) =>
      CONTROLS.filter((c) => c.chords.some((chord) => [chord.key].flat().includes(key) && !!chord.shift === shift && !chord.mod)).map((c) => c.id)
    expect(idsFor('Delete', false)).toEqual(['empty-selection'])
    expect(idsFor('Backspace', false)).toEqual(['empty-selection'])
    expect(idsFor('Delete', true)).toEqual(['remove-line'])
    expect(idsFor('Backspace', true)).toEqual(['remove-line'])
    expect(idsFor('r', true)).toEqual(['rotate'])
    expect(CONTROLS.find((control) => control.id === 'clear')?.chords).toEqual([])
  })

  it('has no Row progress switch or P key, and Remove frame is allowed with a Frame whatever the progress (ticket 426)', () => {
    expect(CONTROLS.find((control) => control.id === 'row-progress')).toBeUndefined()
    expect(CONTROLS.some((control) => control.chords.some((chord) => chord.key === 'p'))).toBe(false)

    const remove = CONTROLS.find((control) => control.id === 'remove-frame')!
    const project = (framed: boolean, currentRow: number) =>
      bareProject({ ...(framed ? { frame: { technique: 'loom', row: 0, column: 0, rows: 4, columns: 4, beads: {} } } : {}), rowProgress: { direction: 'rows', currentRow, currentColumn: 0 } })
    const deps = (activeProject: unknown) => ({ activeProject: () => activeProject }) as never
    expect(remove.enabled?.(deps(project(true, 0)))).toBe(true)
    expect(remove.enabled?.(deps(project(true, 2)))).toBe(true)
    expect(remove.enabled?.(deps(project(false, 0)))).toBe(false)
    expect(remove.disabledBody?.(en, deps(project(false, 0)))).toBe(en.tooltips.noFrameToRemove)
    // A bin, as every other remove (ticket 475).
    expect(remove.icon).toBe('delete')
  })

  it('gives every action that can be disabled a reason, in every language', () => {
    for (const control of CONTROLS.filter((c) => c.enabled)) {
      const project = bareProject({})
      const deps = { activeProject: () => project, hasSelection: () => true } as never
      for (const t of Object.values(LANGUAGES)) expect(control.disabledBody?.(t, deps).trim(), control.id).toBeTruthy()
    }
  })

  it('writes every body as one sentence ending in a full stop, without "Click to"', () => {
    for (const control of CONTROLS) {
      for (const [locale, t] of Object.entries(LANGUAGES)) {
        const bodies = [control.body?.(t)].filter((body): body is string => body !== undefined)
        for (const body of bodies) {
          expect(body, `${control.id} in ${locale}`).toMatch(/[.。]$/)
          expect(body, control.id).not.toMatch(/click to/i)
        }
      }
    }
  })

  it('writes the zoom chords without a separator before the sign: Ctrl/Cmd+ and Ctrl/Cmd−', () => {
    expect(actionKey(controlAction('zoom-in'))).toBe('Ctrl/Cmd+')
    expect(actionKey(controlAction('zoom-out'))).toBe('Ctrl/Cmd−')
    expect(actionKey(controlAction('zoom-fit'))).toBe('Ctrl/Cmd+0')
  })
})

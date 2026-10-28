import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { actionKey } from '../../components/ui/controlAction'
import type { Chord } from '../../domain/chord'
import { CONTROLS, chordMatches, controlAction } from './controlRegistry'

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

  it('defines each action once, with a name in English and Russian', () => {
    expect(new Set(CONTROLS.map((control) => control.id)).size).toBe(CONTROLS.length)
    for (const control of CONTROLS) {
      expect(control.name(en).trim(), control.id).not.toBe('')
      expect(control.name(ru).trim(), control.id).not.toBe('')
    }
  })

  it('gives Clear no key, and Del, Shift+Del and Shift+R each their own action', () => {
    const idsFor = (key: string, shift: boolean) =>
      CONTROLS.filter((c) => c.chords.some((chord) => chord.key === key && !!chord.shift === shift && !chord.mod)).map((c) => c.id)
    expect(idsFor('Delete', false)).toEqual(['empty-selection'])
    expect(idsFor('Delete', true)).toEqual(['remove-line'])
    expect(idsFor('r', true)).toEqual(['rotate'])
    expect(CONTROLS.find((control) => control.id === 'clear')?.chords).toEqual([])
  })

  it('has no Row progress switch or P key, and Remove frame is allowed with a Frame whatever the progress (ticket 426)', () => {
    expect(CONTROLS.find((control) => control.id === 'row-progress')).toBeUndefined()
    expect(CONTROLS.some((control) => control.chords.some((chord) => chord.key === 'p'))).toBe(false)

    const remove = CONTROLS.find((control) => control.id === 'remove-frame')!
    const project = (framed: boolean, currentRow: number) =>
      ({ frame: framed ? { row: 0, column: 0, rows: 4, columns: 4 } : undefined, rowProgress: { currentRow, currentColumn: 0 } }) as never
    const deps = (activeProject: unknown) => ({ activeProject: () => activeProject }) as never
    expect(remove.enabled?.(deps(project(true, 0)))).toBe(true)
    expect(remove.enabled?.(deps(project(true, 2)))).toBe(true)
    expect(remove.enabled?.(deps(project(false, 0)))).toBe(false)
    expect(remove.disabledBody?.(en, deps(project(false, 0)))).toBe(en.tooltips.noFrameToRemove)
    // A bin, as every other remove (ticket 475).
    expect(remove.icon).toBe('delete')
  })

  it('gives every action that can be disabled a reason, in both languages', () => {
    for (const control of CONTROLS.filter((c) => c.enabled)) {
      const project = { beads: {}, rowProgress: { currentRow: 0, currentColumn: 0 } } as never
      const deps = { activeProject: () => project, hasSelection: () => true } as never
      for (const t of [en, ru]) expect(control.disabledBody?.(t, deps).trim(), control.id).toBeTruthy()
    }
  })

  it('writes every body as one sentence ending in a full stop, without "Click to"', () => {
    for (const control of CONTROLS) {
      for (const t of [en, ru]) {
        const bodies = [control.body?.(t)].filter((body): body is string => body !== undefined)
        for (const body of bodies) {
          expect(body, control.id).toMatch(/[.]$/)
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

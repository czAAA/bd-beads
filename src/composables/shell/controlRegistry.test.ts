import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { actionKey } from '../../components/ui/controlAction'
import { CONTROLS, chordSlots, controlAction } from './controlRegistry'

describe('the control registry', () => {
  it('has Rotate canvas and Rotate Frame, both without a key (ticket 471)', () => {
    for (const id of ['rotate-canvas', 'rotate-frame']) {
      expect(CONTROLS.filter((control) => control.id === id)).toHaveLength(1)
      expect(controlAction(id).chords).toEqual([])
    }
    expect(controlAction('rotate').chords.flatMap(chordSlots)).toContain('+shift+r')
  })

  it('has no two actions that declare the same key or combination', () => {
    const owner = new Map<string, string>()
    const clashes: string[] = []
    for (const control of CONTROLS) {
      for (const slot of control.chords.flatMap(chordSlots)) {
        const other = owner.get(slot)
        if (other !== undefined && other !== control.id) clashes.push(`${slot}: ${other} and ${control.id}`)
        owner.set(slot, control.id)
      }
    }
    expect(clashes).toEqual([])
  })

  it('catches a clash, shifted or not, between modifier-sensitive keys', () => {
    // Zoom takes Ctrl/Cmd+= with or without Shift: a second action on Ctrl+Shift+= would clash.
    const zoomIn = CONTROLS.find((control) => control.id === 'zoom-in')!
    const slots = zoomIn.chords.flatMap(chordSlots)
    expect(slots).toContain('ctrl+shift+=')
    expect(slots).toContain('meta++=')
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
  })

  it('gives every action that can be disabled a reason, in both languages', () => {
    for (const control of CONTROLS.filter((c) => c.enabled)) {
      const project = { beads: {}, rowProgress: { currentRow: 0, currentColumn: 0 } } as never
      const deps = { activeProject: () => project, addedColorCount: () => 0 } as never
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

import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { actionKey } from '../../components/ui/controlAction'
import { CONTROLS, chordSlots, controlAction } from './controlRegistry'

describe('the control registry', () => {
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

  it('gives every action that can be disabled a reason, in both languages', () => {
    for (const control of CONTROLS.filter((c) => c.enabled)) {
      const project = { rowProgress: { enabled: false }, beads: {} } as never
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

  it('shows Back out\'s Esc on Done, Cancel and Clear selection without claiming the key twice', () => {
    for (const id of ['done-frame', 'cancel-paste', 'clear-selection']) {
      expect(actionKey(controlAction(id))).toBe('Esc')
      expect(controlAction(id).chords).toEqual([])
    }
  })
})

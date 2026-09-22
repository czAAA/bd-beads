import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SizeControls from './SizeControls.vue'
import { findBead } from '../domain/beads'
import { createPattern, moveToRow, setRowProgressEnabled, toggleRotated, type Pattern, type Technique } from '../domain/pattern'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

function pattern(
  columns: number,
  rows: number,
  { bead = 'toho-cube-1.5mm', technique = 'loom' }: { bead?: string; technique?: Technique } = {},
): Pattern {
  return createPattern({ technique, beadId: bead, size: { width: columns, height: rows, unit: 'beads' } })
}

function mountControls(target: Pattern) {
  return mount(SizeControls, { props: { pattern: target } })
}

const estimate = (wrapper: ReturnType<typeof mountControls>) => wrapper.find('[data-testid="size-estimate"]').text()
const columnsValue = (wrapper: ReturnType<typeof mountControls>) => wrapper.find('[data-testid="size-columns-value"]').text()
const rowsValue = (wrapper: ReturnType<typeof mountControls>) => wrapper.find('[data-testid="size-rows-value"]').text()
const columnsDecrease = (wrapper: ReturnType<typeof mountControls>) =>
  wrapper.find<HTMLButtonElement>('[data-testid="size-columns-decrease"]')
const columnsIncrease = (wrapper: ReturnType<typeof mountControls>) =>
  wrapper.find<HTMLButtonElement>('[data-testid="size-columns-increase"]')
const rowsDecrease = (wrapper: ReturnType<typeof mountControls>) =>
  wrapper.find<HTMLButtonElement>('[data-testid="size-rows-decrease"]')
const rowsIncrease = (wrapper: ReturnType<typeof mountControls>) =>
  wrapper.find<HTMLButtonElement>('[data-testid="size-rows-increase"]')

describe('SizeControls Estimated size (ticket 98)', () => {
  it('shows the estimate for TOHO Cube 1.5mm: columns x 1.5mm, rows x 1.5mm', () => {
    expect(estimate(mountControls(pattern(10, 20)))).toBe('≈ 1.5 × 3.0 cm')
  })

  it("shows the estimate for TOHO Round 11/0 with its 0.15mm width correction in every column", () => {
    // 9 columns x 1.65mm = 14.85mm, 14 rows x 2.2mm = 30.8mm. Without the correction it would read 1.4 (13.5mm).
    expect(estimate(mountControls(pattern(9, 14, { bead: 'toho-round-11-0' })))).toBe('≈ 1.5 × 3.1 cm')
  })

  it('shows the estimate for Miyuki Delica 11/0: wider than tall', () => {
    expect(estimate(mountControls(pattern(20, 10, { bead: 'miyuki-delica-11-0' })))).toBe('≈ 3.2 × 1.3 cm')
  })

  it('is not technique-aware: peyote and brick stitch read the same as loom (ADR 0017)', () => {
    const loom = estimate(mountControls(pattern(10, 20)))

    expect(estimate(mountControls(pattern(10, 20, { technique: 'peyote' })))).toBe(loom)
    expect(estimate(mountControls(pattern(10, 20, { technique: 'brick' })))).toBe(loom)
  })

  it('switches to mm as soon as either side is under 10mm', () => {
    expect(estimate(mountControls(pattern(6, 20)))).toBe('≈ 9 × 30 mm')
    expect(estimate(mountControls(pattern(20, 6)))).toBe('≈ 30 × 9 mm')
  })

  it('stays in cm at exactly 10mm, and a side just under it goes to mm', () => {
    // 20 Delica columns is 32mm; 10 rows at 1.3mm is 13mm; 7 rows is 9.1mm.
    expect(estimate(mountControls(pattern(20, 10, { bead: 'miyuki-delica-11-0' })))).toContain('cm')
    expect(estimate(mountControls(pattern(20, 7, { bead: 'miyuki-delica-11-0' })))).toBe('≈ 32 × 9.1 mm')
    // 10 cube rows is exactly 15mm; 7 columns is 10.5mm.
    expect(estimate(mountControls(pattern(7, 7)))).toBe('≈ 1.1 × 1.1 cm')
  })

  it('follows the rotated view: rotating swaps width and height', () => {
    const upright = pattern(10, 20)

    expect(estimate(mountControls(upright))).toBe('≈ 1.5 × 3.0 cm')
    expect(estimate(mountControls(toggleRotated(upright)))).toBe('≈ 3.0 × 1.5 cm')
  })

  it('follows the app language for the unit label', () => {
    localStorage.setItem('bd-beads:locale', 'ru')

    expect(estimate(mountControls(pattern(10, 20)))).toBe('≈ 1.5 × 3.0 см')
    expect(estimate(mountControls(pattern(6, 20)))).toBe('≈ 9 × 30 мм')
  })

  it('updates when the Pattern’s Bead changes', async () => {
    const wrapper = mountControls(pattern(10, 20))
    expect(estimate(wrapper)).toBe('≈ 1.5 × 3.0 cm')

    await wrapper.setProps({ pattern: { ...pattern(10, 20), beadId: 'toho-round-11-0' } })

    expect(estimate(wrapper)).toBe('≈ 1.7 × 4.4 cm')
  })

  it('shows no estimate for a Bead the catalog does not have, rather than guessing', () => {
    const wrapper = mountControls({ ...pattern(10, 20), beadId: 'from-another-device' })

    expect(wrapper.find('[data-testid="size-estimate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="size-estimate-info"]').exists()).toBe(false)
  })
})

describe('SizeControls warning tooltip (ticket 98)', () => {
  const info = (wrapper: ReturnType<typeof mountControls>) => wrapper.find('[data-testid="size-estimate-info"]')
  const tooltip = (wrapper: ReturnType<typeof mountControls>) => wrapper.find('[data-testid="size-estimate-tooltip"]')
  // Read off v-show's own inline style: the wrapper's isVisible() goes through jsdom's computed-style cache, which goes stale here.
  const open = (wrapper: ReturnType<typeof mountControls>) => !tooltip(wrapper).attributes('style')?.includes('display: none')

  it('is closed until asked for', () => {
    expect(open(mountControls(pattern(10, 20)))).toBe(false)
  })

  it('opens on hover and closes when the pointer leaves', async () => {
    const wrapper = mountControls(pattern(10, 20))

    await info(wrapper).trigger('mouseenter')
    expect(open(wrapper)).toBe(true)

    await info(wrapper).trigger('mouseleave')
    expect(open(wrapper)).toBe(false)
  })

  it('also opens on keyboard focus, not on hover only, and closes on blur', async () => {
    const wrapper = mountControls(pattern(10, 20))

    await info(wrapper).trigger('focus')
    expect(open(wrapper)).toBe(true)

    await info(wrapper).trigger('blur')
    expect(open(wrapper)).toBe(false)
  })

  it('closes on Escape while it has focus', async () => {
    const wrapper = mountControls(pattern(10, 20))
    await info(wrapper).trigger('focus')

    await info(wrapper).trigger('keydown', { key: 'Escape' })

    expect(open(wrapper)).toBe(false)
  })

  it('is described to assistive technology by the icon it belongs to', () => {
    const wrapper = mountControls(pattern(10, 20))

    expect(info(wrapper).attributes('aria-describedby')).toBe(tooltip(wrapper).attributes('id'))
    expect(tooltip(wrapper).attributes('role')).toBe('tooltip')
    expect(info(wrapper).attributes('aria-label')).toBe(en.size.estimateInfoButton)
    expect(info(wrapper).element.tagName).toBe('BUTTON')
  })

  it('says it is an estimate, in both languages', () => {
    const wrapper = mountControls(pattern(10, 20))
    expect(tooltip(wrapper).text()).toBe(en.size.estimateWarning)
    expect(en.size.estimateWarning).toContain('These sizes are an estimate.')

    localStorage.setItem('bd-beads:locale', 'ru')
    expect(tooltip(mountControls(pattern(10, 20))).text()).toBe(ru.size.estimateWarning)
  })
})

describe('SizeControls counters (ticket 123)', () => {
  it('shows the Pattern’s current columns and rows as a read-only count, not a typeable input', () => {
    const wrapper = mountControls(pattern(10, 20))

    expect(columnsValue(wrapper)).toContain('10')
    expect(rowsValue(wrapper)).toContain('20')
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('emits one resize in grid space when the + button is clicked', async () => {
    const wrapper = mountControls(pattern(10, 20))

    await columnsIncrease(wrapper).trigger('click')

    expect(wrapper.emitted('resize')).toEqual([[{ columns: 11, rows: 20, columnsFrom: 'end', rowsFrom: 'end' }]])
  })

  it('emits one resize in grid space when the − button is clicked', async () => {
    const wrapper = mountControls(pattern(10, 20))

    await rowsDecrease(wrapper).trigger('click')

    expect(wrapper.emitted('resize')).toEqual([[{ columns: 10, rows: 19, columnsFrom: 'end', rowsFrom: 'end' }]])
  })

  it('disables the − button once the count would go below 1', () => {
    const wrapper = mountControls(pattern(1, 5))

    expect(columnsDecrease(wrapper).element.disabled).toBe(true)
    expect(rowsDecrease(wrapper).element.disabled).toBe(false)
  })

  it('never disables the + button for size (ADR 0019): there is no ceiling', () => {
    const wrapper = mountControls(pattern(500, 500))

    expect(columnsIncrease(wrapper).element.disabled).toBe(false)
    expect(rowsIncrease(wrapper).element.disabled).toBe(false)
  })

  it('follows the Pattern when it changes underneath it', async () => {
    const wrapper = mountControls(pattern(10, 20))

    await wrapper.setProps({ pattern: { ...pattern(10, 20), columns: 8 } })

    expect(columnsValue(wrapper)).toContain('8')
  })
})

describe('SizeControls with no limit on size (ADR 0019)', () => {
  it('lets a Pattern grow past 10,000 cells, which used to be the most, and says nothing against it', async () => {
    const wrapper = mountControls(pattern(100, 100))

    await rowsIncrease(wrapper).trigger('click')

    expect(wrapper.emitted('resize')).toEqual([[{ columns: 100, rows: 101, columnsFrom: 'end', rowsFrom: 'end' }]])
    expect(wrapper.find('[data-testid="size-message"]').exists()).toBe(false)
  })

  it('always lets a big Pattern shrink', async () => {
    const wrapper = mountControls(pattern(200, 200))

    await rowsDecrease(wrapper).trigger('click')

    expect(wrapper.emitted('resize')).toEqual([[{ columns: 200, rows: 199, columnsFrom: 'end', rowsFrom: 'end' }]])
  })
})

describe('SizeControls Row progress lock (ticket 101)', () => {
  function woven() {
    return setRowProgressEnabled(moveToRow(pattern(10, 20), 3), true)
  }

  it('disables every counter and “change from” button while Row progress is on', () => {
    const wrapper = mountControls(woven())

    for (const button of [columnsDecrease(wrapper), columnsIncrease(wrapper), rowsDecrease(wrapper), rowsIncrease(wrapper)]) {
      expect(button.element.disabled).toBe(true)
    }
    for (const testId of ['columns-from-end', 'columns-from-start', 'rows-from-end', 'rows-from-start']) {
      expect(wrapper.find<HTMLButtonElement>(`[data-testid="size-${testId}"]`).element.disabled).toBe(true)
    }
  })

  it('explains why on hover', () => {
    const wrapper = mountControls(woven())

    expect(wrapper.find('[data-testid="size-inputs"]').attributes('title')).toBe('Turn off Row progress to change the size')
  })

  it('has no reason to give, and nothing disabled, while it is off', () => {
    const wrapper = mountControls(pattern(10, 20))

    expect(wrapper.find('[data-testid="size-inputs"]').attributes('title')).toBeUndefined()
    expect(columnsIncrease(wrapper).element.disabled).toBe(false)
  })

  it('re-enables when Row progress is turned off', async () => {
    const wrapper = mountControls(woven())

    await wrapper.setProps({ pattern: setRowProgressEnabled(woven(), false) })

    expect(columnsIncrease(wrapper).element.disabled).toBe(false)
    expect(rowsIncrease(wrapper).element.disabled).toBe(false)
  })

  it('still shows the estimate while locked', () => {
    expect(estimate(mountControls(woven()))).toBe('≈ 1.5 × 3.0 cm')
  })
})

describe('SizeControls rotation (ticket 101)', () => {
  it('drives the grid’s columns from the first counter and its rows from the second when upright', async () => {
    const wrapper = mountControls(pattern(10, 20))

    await columnsIncrease(wrapper).trigger('click')

    expect(wrapper.emitted('resize')![0]![0]).toMatchObject({ columns: 11, rows: 20 })
  })

  it('swaps the two counters when the Pattern is rotated, the way Mirror’s counts do', async () => {
    const wrapper = mountControls(toggleRotated(pattern(10, 20)))

    expect(columnsValue(wrapper)).toContain('20')
    expect(rowsValue(wrapper)).toContain('10')

    await columnsIncrease(wrapper).trigger('click')

    // On screen the first counter is the horizontal one, which is now the grid's rows.
    expect(wrapper.emitted('resize')![0]![0]).toMatchObject({ columns: 10, rows: 21 })
  })

  it('carries each direction’s “change from” choice with the screen direction, not the grid axis', async () => {
    const upright = pattern(10, 20)
    const wrapper = mountControls(upright)
    await wrapper.find('[data-testid="size-columns-from-start"]').trigger('click')
    await wrapper.setProps({ pattern: toggleRotated(upright) })

    await columnsIncrease(wrapper).trigger('click')

    // The horizontal direction was set to start; horizontally it now drives the grid's rows.
    expect(wrapper.emitted('resize')![0]![0]).toEqual({ columns: 10, rows: 21, columnsFrom: 'end', rowsFrom: 'start' })
  })
})

describe('SizeControls change from (ticket 102)', () => {
  const pressed = (wrapper: ReturnType<typeof mountControls>, testId: string) =>
    wrapper.find(`[data-testid="${testId}"]`).attributes('aria-pressed')

  it('defaults both directions to the end', () => {
    const wrapper = mountControls(pattern(10, 20))

    expect(pressed(wrapper, 'size-columns-from-end')).toBe('true')
    expect(pressed(wrapper, 'size-columns-from-start')).toBe('false')
    expect(pressed(wrapper, 'size-rows-from-end')).toBe('true')
  })

  it('has its own toggle per direction', async () => {
    const wrapper = mountControls(pattern(10, 20))

    await wrapper.find('[data-testid="size-rows-from-start"]').trigger('click')

    expect(pressed(wrapper, 'size-rows-from-start')).toBe('true')
    expect(pressed(wrapper, 'size-columns-from-start')).toBe('false')
  })

  it('sends the chosen end with the resize', async () => {
    const wrapper = mountControls(pattern(10, 20))
    await wrapper.find('[data-testid="size-columns-from-start"]').trigger('click')

    await columnsIncrease(wrapper).trigger('click')

    expect(wrapper.emitted('resize')![0]![0]).toEqual({ columns: 11, rows: 20, columnsFrom: 'start', rowsFrom: 'end' })
  })

  it('is forgotten when another Pattern is opened, being an editing-session setting', async () => {
    const wrapper = mountControls(pattern(10, 20))
    await wrapper.find('[data-testid="size-columns-from-start"]').trigger('click')

    await wrapper.setProps({ pattern: pattern(10, 20) })

    expect(pressed(wrapper, 'size-columns-from-end')).toBe('true')
  })

  describe.each<Technique>(['peyote', 'brick'])('on %s', (technique) => {
    const target = () => pattern(6, 8, { technique })

    it('steps rows by 2 from the start, and states why beside the counter', async () => {
      const wrapper = mountControls(target())
      expect(wrapper.find('[data-testid="size-pairs-hint"]').exists()).toBe(false)

      await wrapper.find('[data-testid="size-rows-from-start"]').trigger('click')
      expect(wrapper.find('[data-testid="size-pairs-hint"]').text()).toBe(en.size.pairsHint)

      await rowsIncrease(wrapper).trigger('click')
      expect(wrapper.emitted('resize')![0]![0]).toMatchObject({ rows: 10, rowsFrom: 'start' })
    })

    it('disables the − button once removing one more step would drop below 1, honouring the pairs rule', async () => {
      const wrapper = mountControls(pattern(6, 2, { technique }))
      await wrapper.find('[data-testid="size-rows-from-start"]').trigger('click')

      // 2 rows, stepping by 2: one more decrease would reach 0, so it's disabled rather than landing on an odd count.
      expect(rowsDecrease(wrapper).element.disabled).toBe(true)
    })

    it('leaves columns, and every change from the end, unrestricted', async () => {
      const wrapper = mountControls(target())
      await wrapper.find('[data-testid="size-columns-from-start"]').trigger('click')

      await columnsIncrease(wrapper).trigger('click')
      expect(wrapper.emitted('resize')![0]![0]).toMatchObject({ columns: 7, columnsFrom: 'start' })

      await rowsIncrease(wrapper).trigger('click') // rows from the end
      expect(wrapper.emitted('resize')![1]![0]).toMatchObject({ rows: 9, rowsFrom: 'end' })
    })

    it('applies the pairs rule to whichever counter drives the grid’s rows when rotated', async () => {
      const wrapper = mountControls(toggleRotated(target()))

      await wrapper.find('[data-testid="size-columns-from-start"]').trigger('click') // horizontal, so the grid's rows

      await columnsIncrease(wrapper).trigger('click')
      expect(wrapper.emitted('resize')![0]![0]).toMatchObject({ rows: 10 }) // stepped by 2, not 1
    })
  })

  it('never restricts loom rows', async () => {
    const wrapper = mountControls(pattern(6, 8))

    await wrapper.find('[data-testid="size-rows-from-start"]').trigger('click')

    expect(wrapper.find('[data-testid="size-pairs-hint"]').exists()).toBe(false)
    await rowsIncrease(wrapper).trigger('click')
    expect(wrapper.emitted('resize')![0]![0]).toMatchObject({ rows: 9, rowsFrom: 'start' })
  })

  it('has English and Russian labels', () => {
    const wrapper = mountControls(pattern(10, 20))
    expect(wrapper.text()).toContain(en.size.fromStart)
    expect(wrapper.text()).toContain(en.size.changeFromLabel)

    localStorage.setItem('bd-beads:locale', 'ru')
    const russian = mountControls(pattern(10, 20))
    expect(russian.text()).toContain(ru.size.fromStart)
    expect(russian.text()).toContain(ru.size.columnsLabel)
  })
})

describe('the bead catalog', () => {
  it('has the three Beads the estimate tests above lean on', () => {
    for (const id of ['toho-cube-1.5mm', 'toho-round-11-0', 'miyuki-delica-11-0']) {
      expect(findBead(id)).toBeDefined()
    }
  })
})

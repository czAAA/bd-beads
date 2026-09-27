import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { pressBead } from './testUtils/beads'
import { loadPatterns } from './domain/patternStorage'
import { en } from './i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

type Wrapper = ReturnType<typeof mount>

async function create(wrapper: Wrapper, beadId: string, columns: number, rows: number) {
  await wrapper.find('[data-testid="bead-select"]').setValue(beadId)
  await wrapper.find('[data-testid="width-input"]').setValue(String(columns))
  await wrapper.find('[data-testid="height-input"]').setValue(String(rows))
  await wrapper.find('form').trigger('submit')
}

const stored = () => loadPatterns()[0]!
const openModal = (wrapper: Wrapper) => wrapper.find('[data-testid="size-change-size"]').trigger('click')
const modal = (wrapper: Wrapper) => wrapper.find('[data-testid="change-size-modal"]')
const message = (wrapper: Wrapper) => wrapper.find('[data-testid="confirm-modal-message"]').text()
const confirmButton = (wrapper: Wrapper) => wrapper.find<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')

async function type(wrapper: Wrapper, columns: string, rows: string, unit?: string) {
  if (unit) {
    await wrapper.find(`[data-testid="change-size-unit"] [data-value="${unit}"]`).trigger('click')
  }
  await wrapper.find('[data-testid="change-size-width"]').setValue(columns)
  await wrapper.find('[data-testid="change-size-height"]').setValue(rows)
}

async function paint(wrapper: Wrapper, index: number) {
  await wrapper.find('[data-color-id="red"]').trigger('click')
  await pressBead(wrapper, index)
  await wrapper.find('.app-shell').trigger('mouseup')
}

describe('App Change size (ticket 153)', () => {
  it('has a Change size button in the Size group, and no modal until it is pressed', async () => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-cube-1.5mm', 4, 3)

    expect(wrapper.find('[data-testid="tool-group-size"] [data-testid="size-change-size"]').text()).toBe(en.changeSize.button)
    expect(modal(wrapper).exists()).toBe(false)
  })

  it('starts with the current grid in beads', async () => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-cube-1.5mm', 4, 3)
    await openModal(wrapper)

    expect(wrapper.find<HTMLInputElement>('[data-testid="change-size-width"]').element.value).toBe('4')
    expect(wrapper.find<HTMLInputElement>('[data-testid="change-size-height"]').element.value).toBe('3')
    expect(wrapper.find('[data-testid="change-size-unit"] [aria-checked="true"]').attributes('data-value')).toBe('beads')
    expect(message(wrapper)).toBe('4 × 3 → 4 × 3 beads')
  })

  it('keeps the numbers as typed when only the unit is switched, and says what will happen', async () => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-round-11-0', 160, 30)
    await openModal(wrapper)

    await wrapper.find('[data-testid="change-size-unit"] [data-value="mm"]').trigger('click')

    expect(wrapper.find<HTMLInputElement>('[data-testid="change-size-width"]').element.value).toBe('160')
    // 160mm / (1.5mm + 0.15mm correction) and 30mm / 2.2mm, TOHO Round 11/0
    expect(message(wrapper)).toBe('160 × 30 beads will become 160 × 30 mm ≈ 97 × 14 beads Painted cells outside the new size will be removed.')
  })

  it.each([
    ['toho-cube-1.5mm', 'cm', '107 × 20'],
    ['toho-round-11-0', 'mm', '97 × 14'],
    ['miyuki-delica-11-0', 'mm', '100 × 23'],
  ])('converts 160 × 30 mm through %s (%s) the way the New Pattern form does', async (beadId, _unit, grid) => {
    const wrapper = mount(App)
    await create(wrapper, beadId, 200, 50)
    await openModal(wrapper)

    await type(wrapper, '160', '30', 'mm')
    expect(message(wrapper)).toContain(`≈ ${grid} beads`)
    await confirmButton(wrapper).trigger('click')

    const [columns, rows] = grid.split(' × ').map(Number)
    expect(stored()).toMatchObject({ columns, rows })
  })

  it('reads cm as ten times mm', async () => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-round-11-0', 200, 50)
    await openModal(wrapper)

    await type(wrapper, '16', '3', 'cm')

    expect(message(wrapper)).toContain('16 × 3 cm ≈ 97 × 14 beads')
  })

  it('grows with empty rows and columns, keeping the design where it is, as one undo step', async () => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-cube-1.5mm', 3, 3)
    await paint(wrapper, 0)
    await openModal(wrapper)
    await type(wrapper, '5', '4')

    expect(message(wrapper)).toBe('3 × 3 → 5 × 4 beads')
    await confirmButton(wrapper).trigger('click')

    expect(modal(wrapper).exists()).toBe(false)
    expect(stored()).toMatchObject({ columns: 5, rows: 4 })
    expect(stored().grid[0]![0]!.color).not.toBeNull()
    expect(stored().grid[3]!.every((cell) => cell.color === null)).toBe(true)

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(stored()).toMatchObject({ columns: 3, rows: 3 })
    expect(stored().grid[0]![0]!.color).not.toBeNull()
  })

  it('shrinks keeping the top-left, and warns that painted cells outside are removed', async () => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-cube-1.5mm', 4, 4)
    await paint(wrapper, 0)
    await paint(wrapper, 15)
    await openModal(wrapper)
    await type(wrapper, '2', '4')

    expect(message(wrapper)).toContain('removed')
    await confirmButton(wrapper).trigger('click')

    expect(stored()).toMatchObject({ columns: 2, rows: 4 })
    expect(stored().grid[0]![0]!.color).not.toBeNull()
    expect(stored().grid.flat().filter((cell) => cell.color !== null)).toHaveLength(1)
  })

  it('does not warn about removal when nothing shrinks', async () => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-cube-1.5mm', 4, 4)
    await openModal(wrapper)
    await type(wrapper, '6', '6')

    expect(message(wrapper)).not.toContain('removed')
  })

  it('resets Mirror axis counts, as after a Resize', async () => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-cube-1.5mm', 6, 6)
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('1')

    await openModal(wrapper)
    await type(wrapper, '8', '6')
    await confirmButton(wrapper).trigger('click')

    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('0')
  })

  it('Cancel and Escape close the modal and leave the Pattern alone', async () => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-cube-1.5mm', 4, 4)

    await openModal(wrapper)
    await type(wrapper, '9', '9')
    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')
    expect(modal(wrapper).exists()).toBe(false)

    await openModal(wrapper)
    await type(wrapper, '9', '9')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(modal(wrapper).exists()).toBe(false)

    expect(stored()).toMatchObject({ columns: 4, rows: 4 })
    expect(wrapper.find('[data-testid="undo-button"]').attributes('disabled')).toBeDefined()
  })

  it.each([
    ['', '4', 'Enter both numbers.'],
    ['0', '4', 'more than zero'],
    ['-2', '4', 'more than zero'],
    ['abc', '4', 'Enter both numbers.'],
  ])('disables Confirm and says why for %j × %j', async (columns, rows, reason) => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-cube-1.5mm', 4, 4)
    await openModal(wrapper)
    await type(wrapper, columns, rows)

    expect(confirmButton(wrapper).element.disabled).toBe(true)
    expect(message(wrapper)).toContain(reason)
    await confirmButton(wrapper).trigger('click')
    expect(stored()).toMatchObject({ columns: 4, rows: 4 })
  })

  it('refuses a fractional size in beads, but not in mm', async () => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-cube-1.5mm', 4, 4)
    await openModal(wrapper)

    await type(wrapper, '4.5', '4')
    expect(confirmButton(wrapper).element.disabled).toBe(true)
    expect(message(wrapper)).toContain('whole number')

    await type(wrapper, '4.5', '4', 'mm')
    expect(confirmButton(wrapper).element.disabled).toBe(false)
  })

  it('has no upper limit on size', async () => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-cube-1.5mm', 4, 4)
    await openModal(wrapper)
    await type(wrapper, '300', '300')

    expect(confirmButton(wrapper).element.disabled).toBe(false)
  })

  it('is locked while Row progress is on, with the reason on hover and available to keyboard focus', async () => {
    const wrapper = mount(App)
    await create(wrapper, 'toho-cube-1.5mm', 4, 4)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    const button = wrapper.find('[data-testid="size-change-size"]')
    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('title')).toBe(en.size.lockedReason)
    expect(button.attributes('aria-describedby')).toBe(wrapper.find('[data-testid="size-change-size-locked"]').attributes('id'))

    await button.trigger('click')
    expect(modal(wrapper).exists()).toBe(false)

    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    expect(wrapper.find('[data-testid="size-change-size"]').attributes('aria-disabled')).toBe('false')
    await openModal(wrapper)
    expect(modal(wrapper).exists()).toBe(true)
  })

  it('offers its copy in Russian too', async () => {
    localStorage.setItem('bd-beads:locale', 'ru')
    const wrapper = mount(App)
    await create(wrapper, 'toho-cube-1.5mm', 4, 4)
    await openModal(wrapper)

    expect(modal(wrapper).text()).toContain('Изменить размер')
    expect(message(wrapper)).toBe('4 × 4 → 4 × 4 бисеринок')
  })
})

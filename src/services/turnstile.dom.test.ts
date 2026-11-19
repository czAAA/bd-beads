import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TURNSTILE_SITE_KEY, verify } from './turnstile'

// Cloudflare's widget stood in for (ticket 0078): what `verify` renders it with, and what it passes on.

/** A stand-in for Cloudflare's script, loaded as its element is added. The loader keeps the script it loaded, so the
 * file shares one. */
const api = {
  render: vi.fn((_container: HTMLElement, _options: Record<string, (value?: unknown) => void>) => 'widget-1'),
  reset: vi.fn(),
  remove: vi.fn(),
}

beforeEach(() => {
  vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
    ;(window as unknown as { turnstile: unknown }).turnstile = api
    for (const node of nodes) (node as HTMLScriptElement).onload?.(new Event('load'))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  delete (window as unknown as { turnstile?: unknown }).turnstile
})

describe('verify', () => {
  it('renders the widget with the site key and the form’s action, and hands out the token it solves', async () => {
    const container = document.createElement('div')
    const onAsks = vi.fn()
    const check = verify(container, { action: 'sign-in', onAsks })
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1))
    const [rendered, options] = api.render.mock.calls[0]!
    expect(rendered).toBe(container)
    expect(options).toMatchObject({ sitekey: TURNSTILE_SITE_KEY, action: 'sign-in', appearance: 'interaction-only' })

    options['before-interactive-callback']!()
    options['after-interactive-callback']!()
    expect(onAsks.mock.calls).toEqual([[true], [false]])

    const token = check.token()
    options.callback!('token-1')
    expect(await token).toBe('token-1')
    check.dispose()
    expect(api.remove).toHaveBeenCalledWith('widget-1')
  })

  it('names no action for a form whose route checks none', async () => {
    verify(document.createElement('div'))
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1))
    expect(api.render.mock.calls[0]![1]).not.toHaveProperty('action')
  })
})

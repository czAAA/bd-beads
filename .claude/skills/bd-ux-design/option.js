// Runs inside every option page (bd-ux-design skill). The address's hash names what is shown
// (#state=open&theme=dark&lang=ru) and this writes it on <html> as data-state, data-theme and lang, so the option's
// CSS draws each state. The markup it reads (data-goto, data-show, data-t-ru, data-t-long) is in SKILL.md, step 4.
;(() => {
  const root = document.documentElement
  const english = new WeakMap()
  const read = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)))

  function apply() {
    const { state = 'default', theme = 'light', lang = 'en' } = read()
    root.dataset.state = state
    root.dataset.theme = theme
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
    root.lang = lang
    for (const el of document.querySelectorAll('[data-show]')) el.hidden = !el.dataset.show.split(/\s+/).includes(state)
    const cap = (text) => text[0].toUpperCase() + text.slice(1)
    const langKey = 't' + cap(lang.replace(/-(.)/g, (_, c) => c.toUpperCase()))
    for (const el of document.querySelectorAll('*')) {
      const data = el.dataset
      if (!english.has(el)) {
        if (!Object.keys(data).some((key) => /^t[A-Z]/.test(key))) continue
        // Only the element's own text is swapped, so an icon beside the label stays.
        const node = [...el.childNodes].find((child) => child.nodeType === 3 && child.textContent.trim()) ?? el.appendChild(document.createTextNode(''))
        english.set(el, { node, text: node.textContent })
      }
      const { node, text } = english.get(el)
      const short = lang === 'en' ? text : (data[langKey] ?? text)
      const long = lang === 'en' ? data.tLong : data['tLong' + langKey.slice(1)]
      node.textContent = state === 'long' ? (long ?? short) : short
    }
  }

  function setState(state) {
    const now = read()
    const hash = new URLSearchParams({ ...now, state }).toString()
    history.replaceState(null, '', '#' + hash)
    apply()
    if (parent !== window) parent.postMessage({ type: 'design:state', state }, location.origin)
  }

  addEventListener('hashchange', apply)
  addEventListener('click', (event) => {
    const el = event.target.closest?.('[data-goto]')
    if (!el) return
    event.preventDefault()
    setState(root.dataset.state === el.dataset.goto ? 'default' : el.dataset.goto)
  })
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.dataset.state !== 'default') setState('default')
  })
  window.design = { setState, apply }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', apply)
  else apply()
})()

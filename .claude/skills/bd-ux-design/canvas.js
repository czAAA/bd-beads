// The design canvas (bd-ux-design skill): reads the options listed in canvas.html's <main id="canvas"> and draws one
// artboard per option and size, with pan and zoom, a state, theme and language switcher, and numbered comment pins
// kept by serve.mjs in comments.json. A pin takes a press only in comment mode, so it never covers the design's own controls. No dependencies; colors and type come from the design system's tokens.
;(() => {
  const SIZES = { desktop: [1710, 907], ipad: [1366, 1024], 'ipad-portrait': [1024, 1366], phone: [390, 844] }
  const GAP = 160
  const LABEL = 380
  const main = document.getElementById('canvas')
  const split = (text) => (text ?? '').split(/\s+/).filter(Boolean)
  const sizeOf = (name) => SIZES[name] ?? name.split('x').map(Number)
  const themes = split(main.dataset.themes || 'light')
  const langs = split(main.dataset.langs || 'en')
  const defaultSizes = split(main.dataset.sizes || 'desktop')

  const storeKey = 'bd-design:' + location.pathname
  const saved = JSON.parse(sessionStorage.getItem(storeKey) || '{}')
  const view = { x: saved.x ?? 0, y: saved.y ?? 0, k: saved.k ?? 0 }
  let theme = themes.includes(saved.theme) ? saved.theme : themes[0]
  let lang = langs.includes(saved.lang) ? saved.lang : langs[0]
  let commenting = false
  let listOpen = saved.list ?? false
  let comments = []

  const boards = []
  for (const el of main.querySelectorAll('[data-option]')) {
    const states = split(el.dataset.states || 'default')
    for (const size of split(el.dataset.sizes).length ? split(el.dataset.sizes) : defaultSizes) {
      const [width, height] = sizeOf(size)
      const id = `${el.dataset.option}@${size}`
      const state = states.includes(saved.states?.[id]) ? saved.states[id] : states[0]
      boards.push({ id, option: el.dataset.option, size, width, height, states, state, src: el.dataset.src,
        name: el.dataset.name || el.dataset.option, idea: el.dataset.idea || '', tradeoff: el.dataset.tradeoff || '' })
    }
  }
  window.designCanvas = { boards, themes, langs }

  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag)
    for (const [key, value] of Object.entries(props)) {
      if (key === 'class') el.className = value
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value)
      else if (value !== false && value != null) el.setAttribute(key, value === true ? '' : value)
    }
    el.append(...children.filter((child) => child != null && child !== false))
    return el
  }

  // The page's parts
  const world = h('div', { class: 'dc-world' })
  const stage = h('div', { class: 'dc-stage' }, world)
  const zoomLabel = h('span', { class: 'dc-zoom' })
  const countLabel = h('span', {})
  const stateSelect = h('select', { 'aria-label': 'State of every artboard', onchange: () => setAllStates(stateSelect.value) },
    h('option', { value: '' }, 'State: each its own'),
    ...[...new Set(boards.flatMap((board) => board.states))].map((state) => h('option', { value: state }, `State: ${state}`)))
  const segment = (values, current, pick) => h('div', { class: 'dc-segment' }, ...values.map((value) =>
    h('button', { type: 'button', 'data-value': value, 'aria-pressed': String(value === current), onclick: () => pick(value) }, value)))
  const themeSegment = segment(themes, theme, setTheme)
  const langSegment = segment(langs, lang, setLang)
  const commentButton = h('button', { type: 'button', class: 'dc-button', 'aria-pressed': 'false', onclick: () => setCommenting(!commenting) }, 'Comment (C)')
  const listButton = h('button', { type: 'button', class: 'dc-button', onclick: () => setList(!listOpen) }, 'Comments ', countLabel)
  const bar = h('header', { class: 'dc-bar' },
    h('div', { class: 'dc-title' }, h('strong', {}, main.dataset.title || document.title), h('span', {}, main.dataset.question || '')),
    stateSelect, themes.length > 1 && themeSegment, langs.length > 1 && langSegment,
    h('button', { type: 'button', class: 'dc-button', onclick: () => fit() }, 'Fit (0)'),
    h('button', { type: 'button', class: 'dc-button', onclick: () => zoomTo(1) }, '100% (1)'),
    zoomLabel, commentButton, listButton)
  const list = h('aside', { class: 'dc-list', hidden: !listOpen })
  const note = h('div', { class: 'dc-note', hidden: true })
  main.hidden = true
  document.body.append(bar, stage, list, note)

  // Layout: a row per size, a column per option.
  let bounds = { width: 0, height: 0 }
  let top = LABEL
  for (const size of [...new Set(boards.map((board) => board.size))]) {
    let left = 0
    const row = boards.filter((board) => board.size === size)
    for (const board of row) {
      Object.assign(board, { left, top })
      left += board.width + GAP
      bounds.width = Math.max(bounds.width, left - GAP)
    }
    top += row[0].height + LABEL
  }
  bounds.height = top - LABEL

  const hashOf = (board) => '#' + new URLSearchParams({ state: board.state, theme, lang })
  for (const board of boards) {
    board.chips = h('div', { class: 'dc-chips' }, ...board.states.map((state) =>
      h('button', { type: 'button', 'data-value': state, onclick: () => setState(board, state) }, state)))
    board.frame = h('iframe', { src: board.src + hashOf(board), title: board.name, width: board.width, height: board.height })
    board.pins = h('div', { class: 'dc-pins' })
    board.catcher = h('div', { class: 'dc-catch', onclick: (event) => compose(board, event) })
    board.el = h('article', { class: 'dc-board', 'data-board': board.id,
      style: `left:${board.left}px;top:${board.top}px;width:${board.width}px;height:${board.height}px` },
      h('header', { class: 'dc-label' },
        h('button', { type: 'button', class: 'dc-name', onclick: () => fit(board) }, board.name),
        h('span', { class: 'dc-size' }, `${board.size} ${board.width}×${board.height}`),
        h('p', {}, board.idea, board.tradeoff && h('em', {}, ` Trade-off: ${board.tradeoff}`)),
        board.chips),
      board.frame, board.catcher, board.pins)
    board.frame.addEventListener('load', () => forward(board))
    world.append(board.el)
  }

  // View
  function remember() {
    sessionStorage.setItem(storeKey, JSON.stringify({ ...view, theme, lang, list: listOpen,
      states: Object.fromEntries(boards.map((board) => [board.id, board.state])) }))
  }
  function draw() {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`
    document.documentElement.style.setProperty('--k', view.k)
    zoomLabel.textContent = Math.round(view.k * 100) + '%'
    remember()
  }
  function fit(board) {
    const box = board
      ? { left: board.left, top: board.top - LABEL + 40, width: board.width, height: board.height + LABEL - 40 }
      : { left: 0, top: 0, width: bounds.width, height: bounds.height }
    const room = stage.getBoundingClientRect()
    view.k = Math.min(2, Math.max(0.03, Math.min((room.width - 48) / box.width, (room.height - 48) / box.height)))
    view.x = (room.width - box.width * view.k) / 2 - box.left * view.k
    view.y = (room.height - box.height * view.k) / 2 - box.top * view.k
    draw()
  }
  function zoomTo(k, cx, cy) {
    const room = stage.getBoundingClientRect()
    const px = (cx ?? room.left + room.width / 2) - room.left
    const py = (cy ?? room.top + room.height / 2) - room.top
    const next = Math.min(4, Math.max(0.03, k))
    view.x = px - (px - view.x) * (next / view.k)
    view.y = py - (py - view.y) * (next / view.k)
    view.k = next
    draw()
    hideNote()
  }
  function panBy(dx, dy) {
    view.x += dx
    view.y += dy
    draw()
    hideNote()
  }

  /** Wheel, pinch and keys from one window: the page itself, or an artboard's frame (its points are in its own px). */
  function listen(win, toPage, mayScroll) {
    let pinchFrom = 1
    win.addEventListener('wheel', (event) => {
      const zooming = event.ctrlKey || event.metaKey
      if (!zooming && mayScroll?.(event)) return
      event.preventDefault()
      const at = toPage(event)
      if (zooming) zoomTo(view.k * Math.exp(-event.deltaY * 0.01), at.x, at.y)
      else panBy(-event.deltaX, -event.deltaY)
    }, { passive: false })
    win.addEventListener('gesturestart', (event) => {
      event.preventDefault()
      pinchFrom = view.k
    })
    win.addEventListener('gesturechange', (event) => {
      event.preventDefault()
      const at = toPage(event)
      zoomTo(pinchFrom * event.scale, at.x, at.y)
    })
    win.addEventListener('keydown', (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName ?? '')) return
      if (event.key === '0') fit()
      else if (event.key === '1') zoomTo(1)
      else if (event.key === 'c') setCommenting(!commenting)
      else if (event.key === 'Escape' && win === window) setCommenting(false)
      else if (event.key === '=' || event.key === '+') zoomTo(view.k * 1.25)
      else if (event.key === '-') zoomTo(view.k / 1.25)
    })
  }
  function scrollsInside(event) {
    const vertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
    for (let el = event.target; el && el.nodeType === 1; el = el.parentElement) {
      const style = el.ownerDocument.defaultView.getComputedStyle(el)
      const isRoot = el === el.ownerDocument.documentElement
      const scrolls = (value) => value === 'auto' || value === 'scroll' || (isRoot && value !== 'hidden' && value !== 'clip')
      if (vertical ? scrolls(style.overflowY) && el.scrollHeight > el.clientHeight + 1 : scrolls(style.overflowX) && el.scrollWidth > el.clientWidth + 1) return true
    }
    return false
  }
  function forward(board) {
    const toPage = (event) => {
      const rect = board.frame.getBoundingClientRect()
      return { x: rect.left + event.clientX * view.k, y: rect.top + event.clientY * view.k }
    }
    try {
      listen(board.frame.contentWindow, toPage, scrollsInside)
    } catch {
      // A frame that left this origin can't be listened to; the page's own wheel still pans beside it.
    }
  }
  listen(window, (event) => ({ x: event.clientX, y: event.clientY }), (event) => !stage.contains(event.target))
  let drag = null
  stage.addEventListener('pointerdown', (event) => {
    if (event.target !== stage && event.target !== world) return
    drag = { x: event.clientX, y: event.clientY }
    stage.setPointerCapture(event.pointerId)
  })
  stage.addEventListener('pointermove', (event) => {
    if (!drag) return
    panBy(event.clientX - drag.x, event.clientY - drag.y)
    drag = { x: event.clientX, y: event.clientY }
  })
  stage.addEventListener('pointerup', () => (drag = null))
  stage.addEventListener('pointercancel', () => (drag = null))

  // States, theme, language
  function show(board) {
    board.frame.contentWindow?.location.replace(new URL(board.src, location.href).href.split('#')[0] + hashOf(board))
    mark(board)
  }
  function mark(board) {
    for (const chip of board.chips.children) chip.setAttribute('aria-pressed', String(chip.dataset.value === board.state))
    drawPins()
    remember()
  }
  function setState(board, state) {
    board.state = state
    stateSelect.value = ''
    show(board)
  }
  function setAllStates(state) {
    for (const board of boards.filter((b) => b.states.includes(state))) {
      board.state = state
      show(board)
    }
  }
  const press = (group, value) => [...group.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)))
  function setTheme(next) {
    theme = next
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
    press(themeSegment, theme)
    boards.forEach(show)
  }
  function setLang(next) {
    lang = next
    press(langSegment, lang)
    boards.forEach(show)
  }
  addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.data?.type !== 'design:state') return
    const board = boards.find((b) => b.frame.contentWindow === event.source)
    if (!board || !board.states.includes(event.data.state)) return
    board.state = event.data.state
    mark(board)
  })

  // Comments
  const api = (path, method = 'GET', data) =>
    fetch('/api/comments' + path, { method, headers: { 'content-type': 'application/json' }, body: data && JSON.stringify(data) }).then((r) => r.json())
  async function loadComments() {
    const list = await api('').catch(() => [])
    comments = Array.isArray(list) ? list : []
    drawPins()
  }
  function drawPins() {
    for (const board of boards) {
      board.pins.replaceChildren(...comments.filter((c) => c.board === board.id && c.state === board.state).map((c) =>
        h('button', { type: 'button', class: 'dc-pin' + (c.resolved ? ' is-resolved' : ''), style: `left:${c.x}px;top:${c.y}px`,
          'data-id': c.id, 'aria-label': `Comment ${c.id}`, onclick: (event) => openNote(c, event.currentTarget) }, String(c.id))))
    }
    const open = comments.filter((c) => !c.resolved).length
    countLabel.textContent = `${open} open / ${comments.length}`
    list.replaceChildren(h('h2', {}, 'Comments'), ...(comments.length ? comments : [null]).map((c) => c
      ? h('button', { type: 'button', class: 'dc-row' + (c.resolved ? ' is-resolved' : ''), onclick: () => goTo(c) },
          h('b', {}, `${c.id}`), h('span', { class: 'dc-where' }, `${c.board} · ${c.state}${c.resolved ? ' · resolved' : ''}`),
          h('span', {}, c.text), c.reply && h('span', { class: 'dc-reply' }, `↳ ${c.reply}`))
      : h('p', {}, 'None yet. Press C, then click an artboard.')))
  }
  function setCommenting(on) {
    commenting = on
    document.body.classList.toggle('is-commenting', on)
    commentButton.setAttribute('aria-pressed', String(on))
    if (!on) hideNote()
  }
  function setList(on) {
    listOpen = on
    list.hidden = !on
    remember()
  }
  function hideNote() {
    note.hidden = true
    note.replaceChildren()
  }
  function placeNote(x, y) {
    note.hidden = false
    const box = note.getBoundingClientRect()
    note.style.left = Math.max(8, Math.min(innerWidth - box.width - 8, x + 14)) + 'px'
    note.style.top = Math.max(8, Math.min(innerHeight - box.height - 8, y + 14)) + 'px'
  }
  function compose(board, event) {
    const rect = board.el.getBoundingClientRect()
    const at = { x: Math.round((event.clientX - rect.left) / view.k), y: Math.round((event.clientY - rect.top) / view.k) }
    let target = ''
    try {
      const el = board.frame.contentDocument.elementFromPoint(at.x, at.y)
      const text = (el?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30)
      if (el) target = el.tagName.toLowerCase() + [...el.classList].slice(0, 2).map((name) => '.' + name).join('') + (text ? ` "${text}"` : '')
    } catch {
      // The frame's page isn't readable: the comment keeps its point alone.
    }
    const field = h('textarea', { rows: 3, placeholder: 'What should change here? Enter saves, Esc cancels', 'aria-label': 'Comment' })
    const save = async () => {
      if (!field.value.trim()) return hideNote()
      await api('', 'POST', { board: board.id, state: board.state, theme, lang, ...at, target, text: field.value.trim() })
      hideNote()
      await loadComments()
    }
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        save()
      } else if (e.key === 'Escape') {
        e.stopPropagation()
        hideNote()
      }
    })
    note.replaceChildren(h('strong', {}, `${board.id} · ${board.state}`), field,
      h('div', { class: 'dc-actions' }, h('button', { type: 'button', class: 'dc-button', onclick: hideNote }, 'Cancel'),
        h('button', { type: 'button', class: 'dc-button is-primary', onclick: save }, 'Save')))
    placeNote(event.clientX, event.clientY)
    field.focus()
  }
  function openNote(c, pin) {
    const change = async (data) => {
      await api('/' + c.id, data ? 'PATCH' : 'DELETE', data)
      hideNote()
      await loadComments()
    }
    note.replaceChildren(h('strong', {}, `${c.id} · ${c.board} · ${c.state}${c.resolved ? ' · resolved' : ''}`), h('p', {}, c.text),
      c.reply && h('p', { class: 'dc-reply' }, `↳ ${c.reply}`),
      h('div', { class: 'dc-actions' }, h('button', { type: 'button', class: 'dc-button', onclick: () => change() }, 'Delete'),
        h('button', { type: 'button', class: 'dc-button', onclick: () => change({ resolved: !c.resolved }) }, c.resolved ? 'Reopen' : 'Resolve')))
    const rect = pin.getBoundingClientRect()
    placeNote(rect.right, rect.bottom)
  }
  function goTo(c) {
    const board = boards.find((b) => b.id === c.board)
    if (!board) return
    if (board.states.includes(c.state) && board.state !== c.state) setState(board, c.state)
    fit(board)
    const pin = board.pins.querySelector(`[data-id="${c.id}"]`)
    if (pin) openNote(c, pin)
  }

  // Start
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
  boards.forEach(mark)
  if (view.k) draw()
  else fit()
  loadComments()
  addEventListener('resize', () => draw())
  if (window.EventSource && !/[?&]static\b/.test(location.search)) {
    const events = new EventSource('/api/events')
    events.addEventListener('reload', () => location.reload())
    events.addEventListener('comments', loadComments)
  }
})()

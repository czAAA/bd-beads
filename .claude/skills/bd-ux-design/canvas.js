// The design page (bd-ux-design skill, SKILL.md step 3): reads canvas.html's <main id="canvas"> and draws a dark,
// scrolling page: per question a section, its options stacked as full-width rows (label, then the live mockup scaled
// to the page), comment pins kept by serve.mjs (pressable only in comment mode). No dependencies; tokens only.
;(() => {
  const SIZES = { desktop: [1710, 907], ipad: [1366, 1024], 'ipad-portrait': [1024, 1366], phone: [390, 844] }
  const main = document.getElementById('canvas')
  const split = (text) => (text ?? '').split(/\s+/).filter(Boolean)
  const sizeOf = (name) => SIZES[name] ?? name.split('x').map(Number)
  const themes = split(main.dataset.themes || 'light')
  const langs = split(main.dataset.langs || 'en')
  const defaultSizes = split(main.dataset.sizes || 'desktop')

  const storeKey = 'bd-design:' + location.pathname
  const saved = JSON.parse(sessionStorage.getItem(storeKey) || '{}')
  let theme = themes.includes(saved.theme) ? saved.theme : themes[0]
  let lang = langs.includes(saved.lang) ? saved.lang : langs[0]
  let commenting = false
  let listOpen = saved.list ?? false
  let comments = []

  // Groups: each <section data-group> is one question; options straight under <main> are one untitled group.
  const groups = [...main.querySelectorAll(':scope > [data-group]')].map((el) => ({ el, id: el.dataset.group,
    title: el.dataset.title || el.dataset.group, question: el.dataset.question || '', sections: [...el.querySelectorAll('[data-option]')] }))
  const loose = [...main.querySelectorAll(':scope > [data-option]')]
  if (loose.length) groups.unshift({ el: main, id: '', title: '', question: '', sections: loose })
  const recommendation = main.querySelector(':scope > [data-recommendation]')

  const boards = []
  const options = []
  for (const group of groups) {
    group.options = []
    for (const el of group.sections) {
      const states = split(el.dataset.states || 'default')
      const name = el.dataset.name || el.dataset.option
      const option = { id: el.dataset.option, name, short: name.split(' · ')[0], group, boards: [],
        idea: el.dataset.idea || '', tradeoff: el.dataset.tradeoff || '' }
      const sizes = split(el.dataset.sizes).length ? split(el.dataset.sizes) : split(group.el.dataset.sizes).length && group.el !== main ? split(group.el.dataset.sizes) : defaultSizes
      for (const size of sizes) {
        const [width, height] = sizeOf(size)
        const id = `${el.dataset.option}@${size}`
        const state = states.includes(saved.states?.[id]) ? saved.states[id] : states[0]
        const board = { id, option: el.dataset.option, group: group.id, size, width, height, states, state, src: el.dataset.src, name }
        boards.push(board)
        option.boards.push(board)
      }
      group.options.push(option)
      options.push(option)
    }
  }
  const allSizes = [...new Set(boards.map((board) => board.size))]
  let size = allSizes.includes(saved.size) ? saved.size : allSizes[0]
  window.designCanvas = { boards, themes, langs, groups: groups.map((g) => ({ id: g.id, title: g.title, options: g.options.map((o) => o.id) })) }

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
  const segment = (values, current, pick, label) => h('div', { class: 'dc-seg', role: 'group', 'aria-label': label }, ...values.map((value) =>
    h('button', { type: 'button', 'data-value': value, 'aria-pressed': String(value === current), onclick: () => pick(value) }, value)))
  const hashOf = (board) => '#' + new URLSearchParams({ state: board.state, theme, lang })
  const press = (group, value) => [...group.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)))

  // The bar: back home, the options (a press scrolls to one; ← → step), the view switches, comments.
  const countLabel = h('span', {})
  const stateSelect = h('select', { 'aria-label': 'State of every artboard', onchange: () => setAllStates(stateSelect.value) },
    h('option', { value: '' }, 'state: each its own'),
    ...[...new Set(boards.flatMap((board) => board.states))].map((state) => h('option', { value: state }, `state: ${state}`)))
  const sizeSegment = segment(allSizes, size, setSize, 'Size')
  const themeSegment = segment(themes, theme, setTheme, 'Theme of the mockups')
  const langSegment = segment(langs, lang, setLang, 'Language')
  const commentButton = h('button', { type: 'button', class: 'dc-btn', 'aria-pressed': 'false', onclick: () => setCommenting(!commenting) }, 'Comment (C)')
  const listButton = h('button', { type: 'button', class: 'dc-btn', onclick: () => setList(!listOpen) }, 'Comments ', countLabel)
  const nav = h('nav', { class: 'dc-nav', 'aria-label': 'Go to an option (← →)' }, ...groups.map((group) =>
    h('div', { class: 'dc-seg' }, ...group.options.map((option) => h('button', { type: 'button', 'data-value': option.id, title: option.name,
      onclick: () => goToOption(options.indexOf(option)) }, option.short)))))
  const bar = h('header', { class: 'dc-bar' },
    h('a', { class: 'dc-home', href: '/', title: 'Every design', 'aria-label': 'Every design' }, '←'),
    h('span', { class: 'dc-bar-title' }, main.dataset.title || document.title),
    options.length > 1 && nav,
    h('span', { class: 'dc-fill' }),
    allSizes.length > 1 && sizeSegment, themes.length > 1 && themeSegment, langs.length > 1 && langSegment, stateSelect,
    commentButton, listButton)

  // The page: title, the question, a section per question, the recommendation.
  const page = h('div', { class: 'dc-page' },
    h('div', { class: 'dc-top' }, h('h1', {}, main.dataset.title || document.title),
      main.dataset.question && h('p', { class: 'dc-lede' }, main.dataset.question),
      h('p', { class: 'dc-meta' }, [`${options.length} option${options.length === 1 ? '' : 's'}`, groups.length > 1 && `${groups.length} questions`,
        allSizes.map((s) => { const [w, hh] = sizeOf(s); return `${s} ${w}×${hh}` }).join(' / ')].filter(Boolean).join(' · '))))
  for (const group of groups) {
    group.section = h('section', { class: 'dc-group', 'data-group': group.id },
      h('h2', {}, group.title || (groups.length > 1 ? 'more options' : 'the options')),
      group.question && h('p', { class: 'dc-lede' }, group.question))
    for (const option of group.options) {
      option.el = h('article', { class: 'dc-option', 'data-option': option.id })
      for (const board of option.boards) {
        board.chips = segment(board.states, board.state, (state) => setState(board, state), `States of ${board.name}`)
        board.label = h('header', { class: 'dc-label' },
          h('div', { class: 'dc-label-text' },
            h('h3', {}, option.short !== option.name ? h('span', { class: 'dc-letter' }, option.short) : null, option.short !== option.name ? option.name.slice(option.short.length + 3) : option.name),
            option.idea && h('p', {}, option.idea),
            option.tradeoff && h('p', { class: 'dc-tradeoff' }, h('span', {}, 'trade-off '), option.tradeoff)),
          board.chips)
        board.frame = h('iframe', { src: board.src + hashOf(board), title: board.name, width: board.width, height: board.height })
        board.pins = h('div', { class: 'dc-pins' })
        board.catcher = h('div', { class: 'dc-catch', onclick: (event) => compose(board, event) })
        board.layer = h('div', { class: 'dc-layer', style: `width:${board.width}px;height:${board.height}px` }, board.frame, board.catcher, board.pins)
        board.el = h('div', { class: 'dc-board', 'data-board': board.id }, h('span', { class: 'dc-size' }, `${board.size} ${board.width}×${board.height}`), board.layer)
        board.wrap = h('div', { class: 'dc-row', 'data-size': board.size }, board.label, board.el)
        option.el.append(board.wrap)
      }
      group.section.append(option.el)
    }
    page.append(group.section)
  }
  if (recommendation) page.append(h('section', { class: 'dc-group' }, h('h2', {}, 'recommendation'), h('div', { class: 'dc-rec' }, ...recommendation.childNodes)))
  const list = h('aside', { class: 'dc-list', hidden: !listOpen })
  const note = h('div', { class: 'dc-note', hidden: true })
  main.hidden = true
  document.body.append(bar, page, list, note)
  new ResizeObserver(() => document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px')).observe(bar)

  /** Each artboard drawn at the page's width (never above 100%); its pins and comment points stay in its own px. */
  function layout() {
    for (const board of boards) {
      board.wrap.hidden = board.size !== size
      if (board.wrap.hidden) continue
      const room = board.el.clientWidth || page.clientWidth
      board.k = Math.min(1, room / board.width)
      board.layer.style.transform = `scale(${board.k})`
      board.layer.style.setProperty('--k', board.k)
      board.el.style.height = Math.round(board.height * board.k) + 'px'
    }
  }

  function remember() {
    sessionStorage.setItem(storeKey, JSON.stringify({ theme, lang, size, list: listOpen,
      states: Object.fromEntries(boards.map((board) => [board.id, board.state])) }))
  }

  // Options in the bar
  let current = -1
  function goToOption(index) {
    if (!options.length) return
    current = (index + options.length) % options.length
    for (const button of nav.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.value === options[current].id))
    options[current].el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName ?? '')) return
    if (event.key === 'c') setCommenting(!commenting)
    else if (event.key === 'Escape') setCommenting(false)
    else if (event.key === 'ArrowRight') goToOption(current + 1)
    else if (event.key === 'ArrowLeft') goToOption(current < 0 ? -1 : current - 1)
    else return
    event.preventDefault()
  })
  // Keys pressed while a mockup has focus reach the page too (C, Escape, the arrows), except inside its fields.
  for (const board of boards) board.frame.addEventListener('load', () => {
    try {
      board.frame.contentWindow.addEventListener('keydown', (event) => {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName ?? '') || !/^(c|ArrowLeft|ArrowRight)$/.test(event.key)) return
        dispatchEvent(new KeyboardEvent('keydown', { key: event.key }))
      })
    } catch {
      // A frame that left this origin can't be listened to.
    }
  })

  // States, size, theme, language
  function show(board) {
    board.frame.contentWindow?.location.replace(new URL(board.src, location.href).href.split('#')[0] + hashOf(board))
    mark(board)
  }
  function mark(board) {
    press(board.chips, board.state)
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
  function setSize(next) {
    size = next
    press(sizeSegment, size)
    layout()
    remember()
  }
  function setTheme(next) {
    theme = next
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
    fetch(new URL('api/comments' + path, location.href), { method, headers: { 'content-type': 'application/json' }, body: data && JSON.stringify(data) }).then((r) => r.json())
  async function loadComments() {
    const got = await api('').catch(() => [])
    comments = Array.isArray(got) ? got : []
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
    list.replaceChildren(h('h2', {}, 'comments'), ...(comments.length ? comments : [null]).map((c) => c
      ? h('button', { type: 'button', class: 'dc-item' + (c.resolved ? ' is-resolved' : ''), onclick: () => goTo(c) },
          h('b', {}, `${c.id}`), h('span', { class: 'dc-where' }, `${c.board} · ${c.state}${c.resolved ? ' · resolved' : ''}`),
          h('span', {}, c.text), c.reply && h('span', { class: 'dc-reply' }, `↳ ${c.reply}`))
      : h('p', {}, 'None yet. Press C, then click a mockup.')))
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
    const rect = board.layer.getBoundingClientRect()
    const at = { x: Math.round((event.clientX - rect.left) / board.k), y: Math.round((event.clientY - rect.top) / board.k) }
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
      e.stopPropagation()
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        save()
      } else if (e.key === 'Escape') hideNote()
    })
    note.replaceChildren(h('strong', {}, `${board.id} · ${board.state}`), field,
      h('div', { class: 'dc-actions' }, h('button', { type: 'button', class: 'dc-btn', onclick: hideNote }, 'Cancel'),
        h('button', { type: 'button', class: 'dc-btn is-primary', onclick: save }, 'Save')))
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
      h('div', { class: 'dc-actions' }, h('button', { type: 'button', class: 'dc-btn', onclick: () => change() }, 'Delete'),
        h('button', { type: 'button', class: 'dc-btn', onclick: () => change({ resolved: !c.resolved }) }, c.resolved ? 'Reopen' : 'Resolve')))
    const rect = pin.getBoundingClientRect()
    placeNote(rect.right, rect.bottom)
  }
  function goTo(c) {
    const board = boards.find((b) => b.id === c.board)
    if (!board) return
    if (board.size !== size) setSize(board.size)
    if (board.states.includes(c.state) && board.state !== c.state) setState(board, c.state)
    board.wrap.scrollIntoView({ block: 'start' })
    const pin = board.pins.querySelector(`[data-id="${c.id}"]`)
    if (pin) requestAnimationFrame(() => openNote(c, pin))
  }

  // Start
  // The page itself is always dark, as the save-reminder page was; the mockups take the theme the switch picks.
  document.documentElement.dataset.theme = 'dark'
  document.documentElement.style.colorScheme = 'dark'
  boards.forEach(mark)
  layout()
  scrollTo(0, saved.y ?? 0)
  addEventListener('scroll', () => sessionStorage.setItem(storeKey, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(storeKey) || '{}'), y: scrollY })), { passive: true })
  loadComments()
  window.designCanvas.ready = document.fonts.ready.then(() => {
    layout()
    scrollTo(0, saved.y ?? 0)
  })
  // Lay out again only when the page's width changes; the heights layout() sets would otherwise loop the observer.
  let laidWidth = 0
  new ResizeObserver(() => {
    if (page.clientWidth === laidWidth) return
    laidWidth = page.clientWidth
    requestAnimationFrame(layout)
  }).observe(page)
  /** What lies on what: a label over an artboard or over other text, or text wider than its box. */
  window.designCanvas.layoutTrouble = () => {
    const shown = boards.filter((b) => !b.wrap.hidden)
    const texts = [...shown.map((b) => ({ el: b.label, name: `label of ${b.id}` })),
      ...groups.map((g) => ({ el: g.section.querySelector('h2'), name: `header of group ${g.id || 'options'}` }))]
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
    const found = []
    texts.forEach((text, i) => {
      const box = text.el.getBoundingClientRect()
      for (const board of shown) if (hit(box, board.el.getBoundingClientRect())) found.push(`${text.name} lies over artboard ${board.id}`)
      for (const other of texts.slice(i + 1)) if (hit(box, other.el.getBoundingClientRect())) found.push(`${text.name} lies over ${other.name}`)
      for (const el of text.el.querySelectorAll('*')) if (el.scrollWidth > el.clientWidth + 1) found.push(`${text.name}: text wider than its box`)
    })
    return [...new Set(found)]
  }
  if (window.EventSource && !/[?&]static\b/.test(location.search)) {
    const events = new EventSource(new URL('api/events', location.href))
    events.addEventListener('reload', () => location.reload())
    events.addEventListener('comments', loadComments)
  }
})()

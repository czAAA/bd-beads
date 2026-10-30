import { describe, expect, it } from 'vitest'
import { parseReport, reportIssue } from './feedbackReport'

const context = { appVersion: '1.4.0', uiLanguage: 'pl', browser: 'Firefox', os: 'Android', viewport: '412 × 915' }

describe('reportIssue', () => {
  it('titles a general Report by its first words, cut at 60 characters, and labels it feedback', () => {
    const issue = reportIssue({
      kind: 'general',
      fields: { message: 'The   Row progress bar\njumps back when I rotate the Frame on my phone, every time.' },
      context,
    })
    expect(issue.title).toBe('feedback: The Row progress bar jumps back when I rotate the Frame on…')
    expect(issue.labels).toEqual(['from-app', 'feedback'])
    expect(issue.body).toBe(
      [
        '### Message',
        '',
        'The   Row progress bar\njumps back when I rotate the Frame on my phone, every time.',
        '',
        '### Context',
        '',
        '| | |',
        '|---|---|',
        '| App version | 1.4.0 |',
        '| UI language | pl |',
        '| Browser | Firefox |',
        '| OS | Android |',
        '| Viewport | 412 × 915 |',
      ].join('\n'),
    )
  })

  it('titles a translation Report by its language and the text as shown, its fields in order', () => {
    const issue = reportIssue({
      kind: 'translation',
      fields: { language: 'pl', shown: 'Zapisz koralik', shouldSay: 'Zapisz projekt', note: 'On the Save button.' },
      context: { ...context, language: 'pl' },
    })
    expect(issue.title).toBe('translation [pl]: Zapisz koralik')
    expect(issue.labels).toEqual(['from-app', 'translation'])
    const headings = issue.body.split('\n').filter((line) => line.startsWith('### '))
    expect(headings).toEqual(['### Language', '### Text as shown', '### Should say', '### Note', '### Context'])
    expect(issue.body).toContain('### Should say\n\nZapisz projekt\n')
    expect(issue.body).toContain('| Language | pl |')
  })

  it('titles a bead-color Report by its catalog, code and problem, leaving out the fields left empty', () => {
    const issue = reportIssue({
      kind: 'bead-color',
      fields: { problem: 'wrong', brand: 'Miyuki', catalog: 'miyuki-delica', code: 'DB723', looksLike: '#B01020', note: '' },
      context: { ...context, brand: 'Miyuki', catalog: 'miyuki-delica', code: 'DB723', hex: '#C8102E', swatchLetter: 'C' },
    })
    expect(issue.title).toBe('bead-color [miyuki-delica DB723]: wrong color')
    expect(issue.labels).toEqual(['from-app', 'bead-color'])
    const headings = issue.body.split('\n').filter((line) => line.startsWith('### '))
    expect(headings).toEqual(['### Problem', '### Brand and catalog', '### Code', '### Looks like', '### Context'])
    expect(issue.body).toContain('### Problem\n\nWrong color\n')
    expect(issue.body).toContain('### Brand and catalog\n\nMiyuki, miyuki-delica\n')
    expect(issue.body).toContain('| Stored hex | #C8102E |\n| Swatch letter | C |')
  })

  it('names a missing color with no code by its catalog alone', () => {
    const issue = reportIssue({
      kind: 'bead-color',
      fields: { problem: 'missing', brand: 'TOHO', catalog: 'toho', code: '', looksLike: '', note: 'Opaque lavender.' },
      context,
    })
    expect(issue.title).toBe('bead-color [toho]: missing color')
  })

  it('puts the email last, under its own heading, only when given', () => {
    const given = reportIssue({ kind: 'general', fields: { message: 'Hi' }, context, email: 'ann@example.com' })
    expect(given.body.endsWith('### Email\n\nann@example.com')).toBe(true)
    expect(reportIssue({ kind: 'general', fields: { message: 'Hi' }, context }).body).not.toContain('Email')
  })

  it('keeps a pipe, a backslash or a line break in the context from breaking the table', () => {
    const issue = reportIssue({ kind: 'general', fields: { message: 'Hi' }, context: { ...context, browser: 'A|B\\\nC' } })
    expect(issue.body).toContain('| Browser | A\\|B\\\\ C |')
  })
})

describe('parseReport', () => {
  const general = { kind: 'general', fields: { message: 'Hi' }, context }

  it('takes a Report of each kind, with optional fields left out or empty', () => {
    expect(parseReport(general)).toEqual(general)
    expect(parseReport({ kind: 'translation', fields: { language: 'pl', shown: 'Zapisz' }, context })).toEqual({
      kind: 'translation',
      fields: { language: 'pl', shown: 'Zapisz', shouldSay: '', note: '' },
      context,
    })
    expect(
      parseReport({ kind: 'bead-color', fields: { problem: 'missing', brand: 'TOHO', catalog: 'toho', code: '' }, context }),
    ).toMatchObject({ kind: 'bead-color', fields: { problem: 'missing', code: '', looksLike: '', note: '' } })
    expect(parseReport({ ...general, email: 'ann@example.com' })).toMatchObject({ email: 'ann@example.com' })
    expect(parseReport({ ...general, email: '' })).toEqual(general)
  })

  it('refuses anything not shaped as a Report', () => {
    for (const value of [
      null,
      'text',
      { ...general, kind: 'spam' },
      { ...general, kind: 'constructor' },
      { ...general, fields: { message: '' } },
      { ...general, fields: { message: 42 } },
      { ...general, fields: { message: 'Hi', title: 'Mine' } },
      { ...general, labels: ['urgent'] },
      { ...general, context: { ...context, deviceId: 'abc' } },
      { ...general, context: { ...context, appVersion: undefined } },
      { ...general, email: 'not an email' },
      { kind: 'translation', fields: { language: 'pl', shown: '' }, context },
      { kind: 'bead-color', fields: { problem: 'ugly', brand: 'TOHO', catalog: 'toho' }, context },
      { kind: 'bead-color', fields: { problem: 'toString', brand: 'TOHO', catalog: 'toho' }, context },
    ]) {
      expect(parseReport(value), JSON.stringify(value)).toBeNull()
    }
  })

  it('refuses a field past its length: 2,000 for Message and Note, 200 for the others, 320 for the email', () => {
    expect(parseReport({ ...general, fields: { message: 'x'.repeat(2000) } })).not.toBeNull()
    expect(parseReport({ ...general, fields: { message: 'x'.repeat(2001) } })).toBeNull()
    const translation = { kind: 'translation', fields: { language: 'pl', shown: 'x'.repeat(200), note: 'x'.repeat(2000) }, context }
    expect(parseReport(translation)).not.toBeNull()
    expect(parseReport({ ...translation, fields: { ...translation.fields, shown: 'x'.repeat(201) } })).toBeNull()
    expect(parseReport({ ...translation, fields: { ...translation.fields, note: 'x'.repeat(2001) } })).toBeNull()
    expect(parseReport({ ...general, context: { ...context, browser: 'x'.repeat(201) } })).toBeNull()
    const local = 'a'.repeat(308)
    expect(parseReport({ ...general, email: `${local}@example.com` })).not.toBeNull()
    expect(parseReport({ ...general, email: `${local}x@example.com` })).toBeNull()
  })
})

// A small delimited-text reader for spreadsheet imports: comma, semicolon, or tab separated,
// with quoted fields that may hold the delimiter, quotes ("" for one quote), and line breaks.
// No React, no DOM.

/** The delimiter a text most likely uses, judged from its first line outside quotes. */
export function detectDelimiter(text: string, hint = ''): ',' | ';' | '\t' {
  if (/\.tsv$/i.test(hint)) return '\t'
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const count = (d: string) => first.split(d).length - 1
  const tabs = count('\t')
  const commas = count(',')
  const semis = count(';')
  if (tabs > 0 && tabs >= commas && tabs >= semis) return '\t'
  if (semis > commas) return ';'
  return ','
}

/** Rows of fields; a trailing empty line is dropped. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.replace(/^﻿/, '')
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
      continue
    }
    if (c === '"' && field === '') quoted = true
    else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && source[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  while (rows.length && rows[rows.length - 1].every((f) => f === '')) rows.pop()
  return rows
}

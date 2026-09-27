// Export targets for a portfolio: pure functions from a portfolio and the library it reads to
// a standalone HTML page and to Markdown. The HTML renders the same `PortfolioPage` the app
// shows, with its stylesheet inlined and every figure as inline SVG or data URLs, so the file
// needs nothing else and can be dropped into any static host. A reader of the exported page
// has no Junga library, so entries link to their project's reference URL rather than a route.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Library } from '../library'
import { moduleById } from '../modules/registry'
import { previewSummary } from '../present/ProjectPreview'
import PortfolioPage, { DEFAULT_COPY, type PageCopy } from '../portfolio/PortfolioPage'
import { introParagraphs, presentableSections, type Portfolio } from '../portfolio/model'

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** A complete standalone HTML file for the portfolio. */
export function portfolioHtml(
  portfolio: Portfolio,
  library: Library,
  copy: PageCopy = DEFAULT_COPY,
  date = new Date(),
): string {
  const body = renderToStaticMarkup(
    createElement(PortfolioPage, { portfolio, library, links: 'export', copy, date, body: 'main' }),
  )
  const description = portfolio.tagline || `${portfolio.title} — a portfolio of selected work.`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escape(description)}">
<title>${escape(portfolio.title)}${portfolio.author ? ` · ${escape(portfolio.author)}` : ''}</title>
<style>html, body { margin: 0; background: #fafbf9; }</style>
</head>
<body>${body}</body>
</html>
`
}

/** The portfolio as Markdown: headings, captions, and reference links; no figures. */
export function portfolioMarkdown(portfolio: Portfolio, library: Library): string {
  const lines: string[] = [`# ${portfolio.title}`, '']
  if (portfolio.tagline) lines.push(`*${portfolio.tagline}*`, '')
  if (portfolio.author) lines.push(`**${portfolio.author}**`, '')
  for (const paragraph of introParagraphs(portfolio.intro)) lines.push(paragraph, '')
  const links = portfolio.links.filter((l) => l.url)
  if (links.length) {
    lines.push(links.map((l) => `[${l.label.trim() || l.url}](${l.url})`).join(' · '), '')
  }
  for (const { section, entries } of presentableSections(portfolio, library)) {
    if (section.title.trim()) lines.push(`## ${section.title}`, '')
    if (section.description.trim()) lines.push(section.description, '')
    for (const { project, output, title, caption, entry } of entries) {
      if (!project) continue
      const tools =
        project.projectType === 'code'
          ? 'Code project'
          : project.tools.map((t) => moduleById[t].name).join(', ')
      const facts = [entry.role.trim(), tools, previewSummary(project, output)].filter(Boolean)
      lines.push(`### ${title}`, '')
      if (facts.length) lines.push(facts.join(' · '), '')
      if (caption) lines.push(caption, '')
      if (project.referenceUrl) lines.push(`Reference: ${project.referenceUrl}`, '')
    }
  }
  return (
    lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  )
}

export const portfolioFilename = (portfolio: Portfolio, extension: string) =>
  `${
    portfolio.title
      .replace(/[^a-z0-9-_ ]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'portfolio'
  }.${extension}`

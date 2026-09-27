// The portfolio page's stylesheet as a string, so the page looks the same in the app (where
// `PortfolioPage` injects it) and in the standalone HTML export (which inlines it). Every rule
// is scoped under `.pf-page`; the accent comes from the portfolio through `--pf-accent`, and
// the preview height from the design registry through `--portfolio-figure-height`.
export const PAGE_STYLE = `
.pf-page {
  --pf-ink: #233c32;
  --pf-muted: #61705c;
  --pf-border: #e4e9e2;
  --pf-surface: #fff;
  --pf-soft: #f3f6f0;
  --pf-accent: #285f4b;
  --pf-figure-height: var(--portfolio-figure-height, 200px);
  color: var(--pf-ink);
  background: #fafbf9;
  font-family: 'DM Sans Variable', 'DM Sans', -apple-system, 'Segoe UI', sans-serif;
  font-size: 15px;
  line-height: 1.6;
  margin: 0;
  padding: 0 clamp(20px, 5vw, 72px) 60px;
}
.pf-page *, .pf-page *::before, .pf-page *::after { box-sizing: border-box; }
.pf-page a { color: var(--pf-accent); }
.pf-page h1, .pf-page h2, .pf-page h3 {
  font-family: 'Manrope Variable', 'Manrope', 'DM Sans Variable', 'Segoe UI', sans-serif;
  margin: 0;
  line-height: 1.2;
}
.pf-hero {
  max-width: 820px;
  margin: 0 auto;
  padding: clamp(40px, 7vw, 88px) 0 40px;
}
.pf-eyebrow {
  display: block;
  font-size: 11px;
  letter-spacing: 2px;
  font-weight: 650;
  color: var(--pf-accent);
  margin-bottom: 16px;
}
.pf-hero h1 {
  font-size: clamp(34px, 5.5vw, 58px);
  letter-spacing: -1.5px;
  font-weight: 750;
}
.pf-tagline {
  font-size: clamp(17px, 2vw, 21px);
  color: var(--pf-muted);
  margin: 14px 0 0;
  max-width: 640px;
}
.pf-author {
  margin: 22px 0 0;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
}
.pf-author::before {
  content: '';
  width: 26px;
  height: 2px;
  background: var(--pf-accent);
}
.pf-intro { max-width: 640px; margin-top: 26px; }
.pf-intro p { margin: 0 0 1em; color: #3f5148; }
.pf-links { display: flex; flex-wrap: wrap; gap: 10px; margin: 24px 0 0; padding: 0; list-style: none; }
.pf-links a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--pf-border);
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  background: var(--pf-surface);
}
.pf-links a:hover { border-color: var(--pf-accent); }
.pf-toc {
  max-width: 820px;
  margin: 0 auto 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 22px;
  padding: 18px 0;
  border-top: 1px solid var(--pf-border);
  border-bottom: 1px solid var(--pf-border);
  font-size: 13px;
}
.pf-toc a { text-decoration: none; font-weight: 600; color: var(--pf-muted); }
.pf-toc a:hover { color: var(--pf-accent); }
.pf-section { max-width: 1120px; margin: 0 auto; padding: 44px 0 8px; }
.pf-section-head { max-width: 820px; margin: 0 auto 26px; }
.pf-section h2 {
  font-size: clamp(22px, 2.6vw, 30px);
  letter-spacing: -0.6px;
  font-weight: 700;
}
.pf-section-head p { color: var(--pf-muted); margin: 10px 0 0; max-width: 640px; }
.pf-grid { display: grid; gap: 24px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.pf-grid.rows { grid-template-columns: 1fr; max-width: 820px; margin: 0 auto; }
.pf-entry {
  border: 1px solid var(--pf-border);
  border-radius: 12px;
  background: var(--pf-surface);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pf-grid.cards .pf-entry.wide { grid-column: span 2; }
@media (max-width: 720px) { .pf-grid.cards .pf-entry.wide { grid-column: span 1; } }
.pf-grid.rows .pf-entry { flex-direction: row; align-items: stretch; }
.pf-grid.rows .pf-entry .pf-figure { width: 40%; flex: none; height: auto; min-height: 180px; border-bottom: 0; border-right: 1px solid var(--pf-border); }
@media (max-width: 720px) {
  .pf-grid.rows .pf-entry { flex-direction: column; }
  .pf-grid.rows .pf-entry .pf-figure { width: 100%; border-right: 0; border-bottom: 1px solid var(--pf-border); }
}
.pf-figure {
  height: var(--pf-figure-height, var(--portfolio-figure-height, 200px));
  background: var(--pf-soft);
  border-bottom: 1px solid var(--pf-border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}
.pf-figure > * { max-width: 100%; max-height: 100%; }
.pf-figure svg { width: 100%; height: 100%; display: block; }
.pf-figure .pf-figure-svg { background: #fbfcfa; }
.pf-entry-body { padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.pf-entry h2, .pf-entry h3 { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
.pf-entry h2 a, .pf-entry h3 a { color: inherit; text-decoration: none; }
.pf-entry h2 a:hover, .pf-entry h3 a:hover { color: var(--pf-accent); }
.pf-role { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; font-weight: 650; color: var(--pf-accent); margin: 0; }
.pf-caption { margin: 4px 0 0; color: #3f5148; font-size: 14px; }
.pf-entry-meta {
  margin-top: auto;
  padding-top: 14px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  font-size: 12px;
  color: var(--pf-muted);
}
.pf-entry-meta .pf-tools { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.pf-entry-meta .pf-tools span {
  border: 1px solid var(--pf-border);
  border-radius: 4px;
  padding: 2px 7px;
  font-weight: 650;
  color: var(--pf-accent);
  background: #f2f6ee;
  font-size: 11px;
}
.pf-entry-meta a { font-weight: 600; text-decoration: none; margin-left: auto; }
.pf-entry-meta a:hover { text-decoration: underline; }
.pf-footer {
  max-width: 820px;
  margin: 60px auto 0;
  padding-top: 20px;
  border-top: 1px solid var(--pf-border);
  font-size: 12px;
  color: var(--pf-muted);
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.pf-empty-page { max-width: 820px; margin: 40px auto; color: var(--pf-muted); }
/* Figures */
.pf-figure .pf-sheet {
  border-collapse: collapse;
  font-size: 11px;
  background: #fff;
  align-self: flex-start;
  margin: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.pf-sheet th, .pf-sheet td { border: 1px solid #e3e8df; padding: 4px 8px; max-width: 110px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pf-sheet th { background: #f1f4ee; color: #61705c; font-weight: 600; text-align: center; }
.pf-figure .pf-doc {
  align-self: flex-start;
  width: min(86%, 420px);
  margin: 16px auto 0;
  background: #fff;
  padding: 22px 26px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  font-size: 9px;
  line-height: 1.5;
  color: #1f2a24;
  overflow: hidden;
  max-height: 100%;
}
.pf-doc h1 { font-size: 18px; margin: 0 0 6px; font-weight: 700; }
.pf-doc h2 { font-size: 13px; margin: 8px 0 4px; }
.pf-doc h3, .pf-doc h4 { font-size: 11px; margin: 6px 0 3px; }
.pf-doc p, .pf-doc li { margin: 0 0 4px; }
.pf-doc ul, .pf-doc ol { padding-left: 14px; margin: 0; }
.pf-doc blockquote { margin: 4px 0; padding-left: 8px; border-left: 2px solid #cbd5cf; color: #4a5a52; }
.pf-doc pre { background: #f3f5f2; padding: 6px; border-radius: 4px; white-space: pre-wrap; }
.pf-doc figure { margin: 4px 0; } .pf-doc img { max-width: 100%; }
.pf-doc hr { border: 0; border-top: 1px solid #cbd5cf; }
.pf-covers { display: grid; gap: 6px; padding: 12px; width: 100%; height: 100%; grid-template-columns: repeat(3, 1fr); }
.pf-covers.count-1 { grid-template-columns: 1fr; } .pf-covers.count-2 { grid-template-columns: 1fr 1fr; }
.pf-covers.count-4 { grid-template-columns: 1fr 1fr; }
.pf-covers img { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; min-height: 0; }
.pf-tiles { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px; justify-content: center; }
.pf-tiles > span { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 92px; padding: 10px 6px; border: 2px solid; border-radius: 8px; background: #fff; font-size: 11px; text-align: center; }
.pf-tile-emoji { font-size: 22px; }
.pf-art { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; width: 100%; height: 100%; }
.pf-art svg { height: 60%; width: auto; }
.pf-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; font-size: 11px; }
.pf-chips li { border: 1px solid #d3e0cb; border-radius: 4px; padding: 2px 7px; background: #fff; color: #3f5a4b; }
.pf-painting { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f3f6f0; }
.pf-painting img { max-width: 100%; max-height: 100%; object-fit: contain; }
.pf-swatches { position: absolute; left: 10px; bottom: 10px; display: flex; gap: 4px; }
.pf-swatches span { width: 16px; height: 16px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
.pf-code { margin: 0; padding: 16px 20px; font-family: 'DM Mono', Menlo, Consolas, monospace; font-size: 12px; line-height: 1.7; color: #d7e3d9; background: #1d2a25; width: 100%; height: 100%; overflow: hidden; }
.pf-code .is-entry { color: #ffd77a; }
.pf-empty { color: var(--pf-muted); font-size: 13px; padding: 16px; }
@media print {
  .pf-page { padding: 0; background: #fff; }
  .pf-entry { break-inside: avoid; }
  .pf-links a { border-color: #999; }
}
`

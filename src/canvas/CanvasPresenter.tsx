// Read-only playback of a canvas document, shaped by its mode: a deck steps through slides and
// build steps, a mockup clicks through linked screens inside a device frame, a board pans and
// zooms, and an animation plays keyframes over each scene's duration. Used by the output route
// and by the editor's Present button; it never receives a way to change the document.
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Maximize, Pause, Play, RotateCcw, X } from 'lucide-react'
import { MODE_LABELS, type CanvasDocument, type CanvasElement, type Page } from './model'
import { elementBounds, pageAt, union } from './geometry'
import { PageContent, paintValue } from './render'
import './canvas.css'

const maxStep = (page: Page) => page.elements.reduce((m, e) => Math.max(m, e.appear), 0)

export default function CanvasPresenter({
  document: doc,
  title,
  startPage = '',
  loop = false,
  onExit,
  embedded = false,
}: {
  document: CanvasDocument
  /** Named for assistive technology; the stage itself carries no visible heading. */
  title: string
  startPage?: string
  loop?: boolean
  onExit?: () => void
  embedded?: boolean
}) {
  const startIndex = Math.max(
    0,
    doc.pages.findIndex((p) => p.id === startPage),
  )
  const [index, setIndex] = useState(startIndex)
  const [step, setStep] = useState(0)
  const [history, setHistory] = useState<number[]>([])
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(doc.mode === 'animation')
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const root = useRef<HTMLDivElement>(null)
  const page = doc.pages[Math.min(index, doc.pages.length - 1)]
  const steps = maxStep(page)
  const size = doc.page

  // Fit the current board's content when it opens.
  const contentBounds = useMemo(() => {
    if (!page.elements.length) return { x: 0, y: 0, width: size.width, height: size.height }
    return union(page.elements.map((e) => elementBounds(e, page)))
  }, [page, size.width, size.height])

  function go(next: number, viaLink = false) {
    if (next < 0 || next >= doc.pages.length) {
      if (loop && doc.pages.length) next = (next + doc.pages.length) % doc.pages.length
      else return
    }
    if (viaLink) setHistory((h) => [...h, index])
    setIndex(next)
    setStep(0)
    setTime(0)
  }
  function forward() {
    if (doc.mode === 'deck' && step < steps) setStep(step + 1)
    else go(index + 1)
  }
  function back() {
    if (doc.mode === 'deck' && step > 0) setStep(step - 1)
    else if (index > 0) {
      const previous = doc.pages[index - 1]
      setIndex(index - 1)
      setStep(doc.mode === 'deck' ? maxStep(previous) : 0)
      setTime(0)
    } else if (loop) go(doc.pages.length - 1)
  }
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
        case 'Enter':
          event.preventDefault()
          forward()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault()
          back()
          break
        case 'Home':
          go(0)
          break
        case 'End':
          go(doc.pages.length - 1)
          break
        case 'Backspace':
          if (history.length) {
            setHistory(history.slice(0, -1))
            setIndex(history[history.length - 1])
          }
          break
        case 'Escape':
          if (window.document.fullscreenElement) void window.document.exitFullscreen()
          else onExit?.()
          break
      }
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  })

  // Animation clock.
  useEffect(() => {
    if (doc.mode !== 'animation' || !playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setTime((t) => {
        const next = t + dt
        return next > page.duration ? next % page.duration : next
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [doc.mode, playing, page.duration])

  useEffect(() => {
    if (doc.mode !== 'board') return
    const el = root.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pad = 40
    const zoom = Math.min(
      (rect.width - pad * 2) / Math.max(1, contentBounds.width),
      (rect.height - pad * 2) / Math.max(1, contentBounds.height),
      2,
    )
    setView({
      zoom,
      x: rect.width / 2 - (contentBounds.x + contentBounds.width / 2) * zoom,
      y: rect.height / 2 - (contentBounds.y + contentBounds.height / 2) * zoom,
    })
  }, [doc.mode, contentBounds, index])

  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  function pointerDown(event: ReactPointerEvent) {
    if (doc.mode !== 'board') return
    drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }
  function pointerMove(event: ReactPointerEvent) {
    const d = drag.current
    if (!d) return
    setView((v) => ({ ...v, x: d.vx + event.clientX - d.x, y: d.vy + event.clientY - d.y }))
  }
  function pointerUp() {
    drag.current = null
  }
  function wheel(event: React.WheelEvent) {
    if (doc.mode !== 'board') return
    const rect = root.current!.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    const factor = Math.exp(-event.deltaY * 0.0015)
    setView((v) => {
      const zoom = Math.min(8, Math.max(0.05, v.zoom * factor))
      return { zoom, x: px - ((px - v.x) * zoom) / v.zoom, y: py - ((py - v.y) * zoom) / v.zoom }
    })
  }

  const posed = doc.mode === 'animation' ? pageAt(page, time) : page
  const scope = `present-${page.id}`
  const linkable = (element: CanvasElement) => doc.mode === 'mockup' && element.link

  return (
    <div
      className={`canvas-presenter mode-${doc.mode} ${embedded ? 'embedded' : ''}`}
      ref={root}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onWheel={wheel}
      onClick={(event) => {
        if (doc.mode === 'deck' && !(event.target as HTMLElement).closest('.presenter-controls'))
          forward()
      }}
    >
      <h1 className="visually-hidden">{title}</h1>
      {doc.mode === 'board' ? (
        <svg className="presenter-board" width="100%" height="100%">
          <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
            <PageContent page={posed} size={size} scope={scope} />
          </g>
        </svg>
      ) : (
        <div className={`presenter-frame ${doc.mode === 'mockup' ? 'device' : ''}`}>
          <svg
            key={`${page.id}-${doc.mode === 'deck' ? page.transition : ''}`}
            className={`presenter-page transition-${page.transition}`}
            viewBox={`0 0 ${size.width} ${size.height}`}
            style={{ aspectRatio: `${size.width} / ${size.height}` }}
            role="img"
            aria-label={page.name}
          >
            <PageContent
              page={posed}
              size={size}
              scope={scope}
              upTo={doc.mode === 'deck' ? step : Infinity}
            >
              {doc.mode === 'mockup' &&
                page.elements
                  .filter((e) => linkable(e))
                  .map((e) => {
                    const b = elementBounds(e, page)
                    return (
                      <rect
                        key={e.id}
                        className="presenter-hotspot"
                        x={b.x}
                        y={b.y}
                        width={b.width}
                        height={b.height}
                        fill="transparent"
                        role="link"
                        aria-label={`Open ${doc.pages.find((p) => p.id === e.link)?.name ?? 'screen'}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          const target = doc.pages.findIndex((p) => p.id === e.link)
                          if (target >= 0) go(target, true)
                        }}
                      />
                    )
                  })}
            </PageContent>
          </svg>
        </div>
      )}
      <div className="presenter-controls" onPointerDown={(e) => e.stopPropagation()}>
        <span className="presenter-mode">{MODE_LABELS[doc.mode]}</span>
        <button type="button" className="icon-button" aria-label="Previous" onClick={back}>
          <ChevronLeft size={18} />
        </button>
        <span className="presenter-counter" aria-live="polite">
          {index + 1} / {doc.pages.length}
          {doc.mode === 'deck' && steps > 0 ? ` · step ${step}/${steps}` : ''}
        </span>
        <button type="button" className="icon-button" aria-label="Next" onClick={forward}>
          <ChevronRight size={18} />
        </button>
        {doc.mode === 'animation' && (
          <>
            <button
              type="button"
              className="icon-button"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Restart"
              onClick={() => setTime(0)}
            >
              <RotateCcw size={16} />
            </button>
            <input
              type="range"
              aria-label="Time"
              min={0}
              max={page.duration}
              step={0.01}
              value={Math.min(time, page.duration)}
              onChange={(e) => {
                setPlaying(false)
                setTime(Number(e.target.value))
              }}
            />
            <span className="presenter-counter">{time.toFixed(1)}s</span>
          </>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label="Full screen"
          onClick={() => {
            if (window.document.fullscreenElement) void window.document.exitFullscreen()
            else void root.current?.requestFullscreen?.()
          }}
        >
          <Maximize size={16} />
        </button>
        {onExit && (
          <button
            type="button"
            className="icon-button"
            aria-label="Exit presentation"
            onClick={onExit}
          >
            <X size={18} />
          </button>
        )}
      </div>
      {doc.mode === 'board' && (
        <div
          className="presenter-board-background"
          style={{ background: paintValue(page.background, scope) }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Output } from '../../outputs'
import type { SceneController, Snapshot } from './runtime'
import '@fontsource/dm-mono/400.css'
import '@fontsource/instrument-serif/400.css'
import './scene.css'

export default function SceneHost({ output }: { output: Output }) {
  const host = useRef<HTMLDivElement>(null)
  const controller = useRef<SceneController | null>(null)
  // Freeze authoring input for this visit, including when another tab updates the project.
  const [defaults] = useState(() => structuredClone(output.source.defaultState))
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loadError, setLoadError] = useState('')
  // Do not control this segmented native input: clock renders must preserve partial typing.
  const dateInput = useRef<HTMLInputElement>(null)
  const [dateError, setDateError] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    let cancelled = false
    let mounted: SceneController | undefined
    import('./runtime.js')
      .then(({ mountScene }) => {
        if (cancelled || !host.current) return
        mounted = mountScene(host.current, defaults, setSnapshot)
        controller.current = mounted
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLoadError(error instanceof Error ? error.message : 'Earth could not load.')
      })
    return () => {
      cancelled = true
      controller.current = null
      mounted?.dispose()
    }
  }, [defaults])
  function setTime(event: FormEvent) {
    event.preventDefault()
    try {
      const date = dateInput.current?.value
      if (!date) throw new Error('Choose a UTC date and time.')
      controller.current?.date(Date.parse(`${date}Z`))
      setDateError('')
    } catch (error) {
      setDateError((error as Error).message)
    }
  }
  const error = loadError || snapshot?.error
  const ready = !!snapshot?.ready
  const credits = `${import.meta.env.BASE_URL}assets/cosmic-clock/`
  return (
    <div className="cosmic-clock-viewer">
      <div className="cc-intro">
        <p className="cc-eyebrow">ONE PLANET · COUNTLESS MOMENTS</p>
        <h1>{output.title}</h1>
        <p>{output.description}</p>
      </div>
      <div className="cc-experience">
        <div className="cc-globe-wrap">
          <div
            ref={host}
            className="cc-globe"
            role="img"
            aria-label="Interactive three-dimensional Earth"
            aria-describedby="cc-instructions"
            tabIndex={0}
            data-ready={ready}
          />
          {!ready && (
            <div className="cc-loading" role={error ? 'alert' : 'status'}>
              {error || 'Loading Earth and mapping time zones…'}
            </div>
          )}
          {snapshot?.hovered && snapshot.pointer && (
            <div
              className="cc-tooltip"
              style={{
                left: `${Math.max(8, Math.min(snapshot.pointer[0] + 16, (host.current?.clientWidth ?? 360) - 184))}px`,
                top: `${Math.max(8, snapshot.pointer[1] - 70)}px`,
              }}
            >
              <strong>{snapshot.zoneName}</strong>
              <span>{snapshot.local.time}</span>
            </div>
          )}
          <p id="cc-instructions" className="cc-instructions">
            Drag to orbit · Scroll or pinch to zoom
            <br />
            Arrow keys to orbit · + / − to zoom · Click to pin
          </p>
          <div className="cc-view-actions">
            <button
              disabled={!ready}
              aria-pressed={snapshot?.showZones ?? defaults.showTimeZones}
              onClick={() => controller.current?.toggleZones()}
            >
              Time-zone boundaries
            </button>
            <button disabled={!ready} onClick={() => controller.current?.reset()}>
              Reset view
            </button>
          </div>
        </div>
        <aside className="cc-inspector" aria-label="Local time explorer">
          <p className="cc-eyebrow">
            {snapshot?.hovered
              ? 'EXPLORING EARTH'
              : snapshot?.pinned
                ? 'PINNED TIME ZONE'
                : 'YOUR LOCAL TIME'}
          </p>
          <h2>{snapshot?.zoneName ?? 'A moment, everywhere.'}</h2>
          <p className="cc-zone-id">{snapshot?.zoneId ?? 'Explore the world’s time zones'}</p>
          <div className="cc-local-time" aria-label="Selected local time">
            {snapshot?.local.time ?? '--:--:--'}
          </div>
          <p>{snapshot?.local.date}</p>
          <p className="cc-offset">
            {snapshot?.local.offset} <span>{snapshot?.daylight}</span>
          </p>
          <p className="cc-selection-hint">{snapshot?.hint}</p>
          {snapshot?.pinned && (
            <button
              onClick={() => {
                controller.current?.unpin()
                setSearch('')
              }}
            >
              Unpin time zone
            </button>
          )}
          <label className="cc-search">
            Find a time zone
            <input
              list="cc-zone-options"
              placeholder="e.g. Asia/Kathmandu"
              disabled={!ready}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                controller.current?.selectZone(event.target.value)
              }}
            />
          </label>
          <datalist id="cc-zone-options">
            {snapshot?.zones.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
          <div className="cc-facts">
            <span>
              <strong>23.4°</strong> Axial tilt
            </span>
            <span>
              <strong>24 h</strong> Mean solar day
            </span>
          </div>
        </aside>
      </div>
      <section className="cc-time-controls" aria-label="Simulation controls">
        <div className="cc-moment">
          <span className="cc-eyebrow">
            {snapshot?.live ? 'LIVE · UTC' : snapshot?.paused ? 'PAUSED · UTC' : 'SIMULATION · UTC'}
          </span>
          <time dateTime={snapshot ? new Date(snapshot.timestamp).toISOString() : undefined}>
            {snapshot
              ? new Date(snapshot.timestamp).toISOString().slice(0, 19).replace('T', ' · ')
              : 'Loading…'}
          </time>
        </div>
        <div className="cc-playback">
          <button
            disabled={!ready}
            aria-pressed={snapshot?.live ?? true}
            onClick={() => controller.current?.live()}
          >
            Live
          </button>
          <button disabled={!ready} onClick={() => controller.current?.pause()}>
            {snapshot?.paused ? 'Resume time' : 'Pause time'}
          </button>
          <label>
            Playback speed
            <select
              disabled={!ready}
              value={snapshot?.speed ?? defaults.time.speed}
              onChange={(event) => controller.current?.speed(Number(event.target.value))}
            >
              {[...new Set([1, 60, 3600, 86400, defaults.time.speed])]
                .sort((a, b) => a - b)
                .map((speed) => (
                  <option key={speed} value={speed}>
                    {speed.toLocaleString()}×
                  </option>
                ))}
            </select>
          </label>
        </div>
        <form className="cc-date-form" onSubmit={setTime}>
          <label>
            Simulation date (UTC)
            <input
              type="datetime-local"
              min="1970-01-01T00:00"
              max="2100-12-31T23:59"
              required
              ref={dateInput}
            />
          </label>
          <button disabled={!ready} type="submit">
            Set time
          </button>
          {dateError && <p role="alert">{dateError}</p>}
        </form>
      </section>
      <footer className="cc-footer">
        <p>Explore freely. Your view and time controls last for this visit.</p>
        <details>
          <summary>About this scene & credits</summary>
          <p>{output.metadata.attribution}</p>
          <p>
            NASA imagery is a fixed composite. Geographic boundaries are simplified current maps;
            civil-time rules come from your browser. Open water and unmapped areas use labeled
            nautical offsets.
          </p>
          <div>
            <a href={`${credits}CREDITS.md`} target="_blank" rel="noreferrer">
              Full credits & source data
            </a>
            <a href={`${credits}TIMEZONE_DATA_LICENSE.txt`} target="_blank" rel="noreferrer">
              ODbL license
            </a>
            {output.metadata.sourceUrl && (
              <a href={output.metadata.sourceUrl} target="_blank" rel="noreferrer">
                Design reference
              </a>
            )}
          </div>
        </details>
      </footer>
    </div>
  )
}

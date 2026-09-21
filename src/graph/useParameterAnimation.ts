import { useEffect, useRef, useState } from 'react'
import { advanceParameter } from './animation'
import type { GraphDocument, ParameterEntry } from './model'

export function useParameterAnimation(
  graph: GraphDocument,
  blocked: boolean,
  onFrame: (graph: GraphDocument) => void,
) {
  const runs = useRef(new Map<string, { start: number; time: number; direction: number }>())
  const directions = useRef(new Map<string, number>())
  const current = useRef({ graph, blocked, onFrame })
  current.current = { graph, blocked, onFrame }
  const [playing, setPlaying] = useState<string[]>([])
  function stop() {
    runs.current.clear()
    directions.current.clear()
    setPlaying([])
  }
  function toggle(entry: ParameterEntry) {
    if (blocked) return
    if (runs.current.has(entry.id)) runs.current.delete(entry.id)
    else
      runs.current.set(entry.id, {
        start:
          entry.value >= entry.max && entry.animation?.mode !== 'reverse' ? entry.min : entry.value,
        time: performance.now(),
        direction:
          entry.animation?.mode === 'reverse' ? (directions.current.get(entry.id) ?? 1) : 1,
      })
    setPlaying([...runs.current.keys()])
  }
  useEffect(() => {
    if (blocked) stop()
  }, [blocked])
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop()
    }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [])
  useEffect(() => {
    if (!playing.length) return
    let frame = 0,
      previous = 0
    function tick(time: number) {
      if (current.current.blocked || !runs.current.size) return
      // Ten saved updates per second keep large libraries and implicit plots responsive.
      if (time - previous >= 100) {
        previous = time
        const source = current.current.graph
        let changed = false,
          finished = false
        const entries = source.entries.map((entry) => {
          const run = runs.current.get(entry.id)
          if (entry.kind !== 'parameter' || !run) return entry
          const next = advanceParameter(entry, run.start, time - run.time, run.direction)
          directions.current.set(entry.id, next.direction)
          if (next.done) {
            runs.current.delete(entry.id)
            finished = true
          }
          if (next.value === entry.value) return entry
          changed = true
          return { ...entry, value: next.value }
        })
        if (changed) current.current.onFrame({ ...source, entries })
        if (finished) setPlaying([...runs.current.keys()])
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing.length > 0])
  return { playing, toggle, stop }
}

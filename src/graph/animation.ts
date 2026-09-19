import { DEFAULT_ANIMATION, type ParameterEntry } from './model'

// Elapsed time, not frame count, determines the value. One traversal takes 5/speed seconds.
export function advanceParameter(
  entry: ParameterEntry,
  start: number,
  elapsedMs: number,
  direction = 1,
) {
  const { speed, mode } = entry.animation ?? DEFAULT_ANIMATION
  const range = entry.max - entry.min
  if (!(range > 0) || !Number.isFinite(range) || entry.mode !== 'slider')
    return { value: entry.value, done: true, direction: 1 }
  const initial = (start - entry.min) / range
  let phase = initial + ((elapsedMs * speed) / 5000) * direction
  let done = false,
    nextDirection = direction
  if (mode === 'once') {
    done = phase >= 1
    phase = Math.min(1, Math.max(0, phase))
  } else if (mode === 'loop') phase = ((phase % 1) + 1) % 1
  else {
    const cycle = ((phase % 2) + 2) % 2
    phase = cycle <= 1 ? cycle : 2 - cycle
    nextDirection = cycle < 1 ? direction : -direction
  }
  const raw = entry.min + phase * range
  const value = done
    ? entry.max
    : Math.max(
        entry.min,
        Math.min(entry.max, entry.min + Math.round((raw - entry.min) / entry.step) * entry.step),
      )
  return {
    value: done
      ? entry.max
      : Math.max(entry.min, Math.min(entry.max, Number(value.toPrecision(12)))),
    done,
    direction: nextDirection,
  }
}

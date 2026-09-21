import { test } from 'vitest'
import assert from 'node:assert/strict'
import { SimulationClock } from './SimulationClock.js'

test('live time tracks wall time, simulation tracks elapsed monotonic time', () => {
  let wall = 1_000_000,
    tick = 0
  const clock = new SimulationClock(
    () => wall,
    () => tick,
  )
  wall += 5000
  assert.equal(clock.now(), 1_005_000)
  clock.setSpeed(3600)
  tick += 1000
  assert.equal(clock.now(), 4_605_000)
  wall += 900_000
  assert.equal(clock.now(), 4_605_000)
  clock.setSpeed(60)
  assert.equal(clock.now(), 4_605_000)
  tick += 1000
  assert.equal(clock.now(), 4_665_000)
  clock.togglePause()
  tick += 7000
  assert.equal(clock.now(), 4_665_000)
  clock.togglePause()
  tick += 1000
  assert.equal(clock.now(), 4_725_000)
  clock.goLive()
  assert.equal(clock.now(), wall)
  assert.equal(clock.speed, 1)
})
test('date selection preserves pause and rejects invalid input', () => {
  const clock = new SimulationClock(
    () => 0,
    () => 0,
  )
  clock.togglePause()
  clock.setDate(1234)
  assert.equal(clock.now(), 1234)
  assert.equal(clock.paused, true)
  assert.throws(() => clock.setDate(NaN))
  assert.throws(() => clock.setSpeed(0))
})

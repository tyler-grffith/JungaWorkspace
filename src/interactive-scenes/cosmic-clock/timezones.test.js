import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TimeZoneLayer, localTime, contains, oceanZone } from './TimeZoneLayer.js'
const layer = new TimeZoneLayer(
  JSON.parse(
    readFileSync(new URL('../../../public/assets/cosmic-clock/timezones.geojson', import.meta.url)),
  ),
)
test('geographic lookup resolves cities, islands, fractional zones and date-line regions', () => {
  for (const [lat, lon, expected] of [
    [40.71, -74, 'America/New_York'],
    [33.45, -112.07, 'America/Phoenix'],
    [51.507, -0.127, 'Europe/London'],
    [28.61, 77.2, 'Asia/Kolkata'],
    [27.71, 85.32, 'Asia/Kathmandu'],
    [-36.85, 174.76, 'Pacific/Auckland'],
    [-18.14, 178.44, 'Pacific/Fiji'],
    [1.87, -157.43, 'Pacific/Kiritimati'],
    [21.31, -157.86, 'Pacific/Honolulu'],
  ])
    assert.equal(layer.lookup(lat, lon).tzid, expected)
})
test('local time handles DST, fixed offsets and fractional offsets', () => {
  const winter = Date.parse('2026-01-15T12:00:00Z'),
    summer = Date.parse('2026-07-15T12:00:00Z')
  assert.equal(localTime(winter, 'America/New_York').time, '07:00:00')
  assert.equal(localTime(summer, 'America/New_York').time, '08:00:00')
  assert.equal(localTime(winter, 'America/Phoenix').time, '05:00:00')
  assert.equal(localTime(summer, 'America/Phoenix').time, '05:00:00')
  assert.equal(localTime(winter, 'Asia/Kolkata').time, '17:30:00')
  assert.equal(localTime(winter, 'Asia/Kathmandu').time, '17:45:00')
})
test('DST jumps without inventing nonexistent civil times', () => {
  assert.equal(localTime(Date.parse('2026-03-08T06:59:59Z'), 'America/New_York').time, '01:59:59')
  assert.equal(localTime(Date.parse('2026-03-08T07:00:00Z'), 'America/New_York').time, '03:00:00')
})
test('opposite sides of date line show different local dates', () => {
  const t = Date.parse('2026-09-20T12:00:00Z')
  assert.match(localTime(t, 'Pacific/Kiritimati').date, /21 September/)
  assert.match(localTime(t, 'Pacific/Honolulu').date, /20 September/)
})
test('polygon holes are excluded', () => {
  const poly = [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
    [
      [4, 4],
      [6, 4],
      [6, 6],
      [4, 6],
      [4, 4],
    ],
  ]
  assert.equal(contains(2, 2, poly), true)
  assert.equal(contains(5, 5, poly), false)
})
test('nautical UTC identifiers use the IANA reversed sign convention', () => {
  assert.equal(oceanZone(150).tzid, 'Etc/GMT-10')
  assert.equal(oceanZone(-150).tzid, 'Etc/GMT+10')
  assert.equal(oceanZone(0).tzid, 'Etc/GMT')
  assert.equal(layer.lookup(0, -150).ocean, true)
})

import mapshaper from 'mapshaper'
import { readFile, writeFile } from 'node:fs/promises'
const source = process.argv[2]
if (!source)
  throw new Error(
    'Usage: node src/interactive-scenes/cosmic-clock/prepare-zones.mjs /path/to/combined.json (requires mapshaper 0.7.62)',
  )
const input = await readFile(source, 'utf8')
const output = await mapshaper.applyCommands(
  '-i source.json -simplify dp interval=2500 keep-shapes -o format=geojson precision=0.001',
  { 'source.json': input },
)
const data = JSON.parse(Object.values(output)[0])
data.features.sort((a, b) => a.properties.tzid.localeCompare(b.properties.tzid, 'en'))
await writeFile('public/assets/cosmic-clock/timezones.geojson', JSON.stringify(data))
console.log(
  `Prepared ${data.features.length} time zones; geographic simplification tolerance 2.5 km.`,
)

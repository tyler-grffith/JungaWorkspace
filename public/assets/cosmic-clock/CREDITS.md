# Cosmic Clock asset credits

## Earth surface

NASA Blue Marble: Next Generation, December 2004 global mosaic. Original JPEG, 5400 × 2700 pixels. The application resizes this to 4096 pixels wide when loading it for the GPU. No live weather is implied.

- Source: https://visibleearth.nasa.gov/images/74218/december-blue-marble-next-generation
- Download: https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74218/world.200412.3x5400x2700.jpg
- NASA imagery guidance: https://www.nasa.gov/nasa-brand-center/images-and-media/

## Night lights

NASA Earth Observatory, Black Marble 2016 global color composite, 3600 × 1800 pixels. NASA Earth Observatory images by Joshua Stevens, using Suomi NPP VIIRS data from Miguel Román, NASA Goddard Space Flight Center. The shader suppresses the dim background and illuminates the city-light composite only on Earth's night side.

- Source: https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/
- Download: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg

## Time-zone geography

© OpenStreetMap contributors. Timezone Boundary Builder by Evan Siroky and contributors, release **2026d**, comprehensive land/territorial-water zones, 419 features. This project's derived `timezones.geojson` is distributed under the Open Database License (ODbL) 1.0, like its source. The full license is included in `TIMEZONE_DATA_LICENSE.txt` alongside this file.

- Source and release: https://github.com/evansiroky/timezone-boundary-builder/releases/tag/2026d
- Original database archive: https://github.com/evansiroky/timezone-boundary-builder/releases/download/2026d/timezones.geojson.zip
- OpenStreetMap attribution: https://www.openstreetmap.org/copyright
- License: https://opendatacommons.org/licenses/odbl/1-0/

Modifications: topology-preserving Douglas–Peucker simplification with a 2,500-meter interval and `keep-shapes`, coordinate rounding to 0.001°, and alphabetical sorting by IANA identifier. The reproducible procedure is in `src/interactive-scenes/cosmic-clock/prepare-zones.mjs`. Geographic accuracy near boundaries and small islands is limited by these optimizations and by the source data. Overlaps use the alphabetically first source zone. Open ocean and any uncovered areas use explicitly labeled nautical offsets, calculated from longitude.

The included map represents current geography. It is not a historical boundary database. Civil-time rules are supplied by the browser's IANA time-zone database, including historical DST where available; future rules can change.

## Software and typography

- p5.js 2.3.3 — Processing Foundation and contributors, LGPL-2.1. https://p5js.org/
- Astronomy Engine 2.1.19 — Don Cross, MIT. https://github.com/cosinekitty/astronomy
- Instrument Serif — The Instrument Serif Project Authors, SIL Open Font License. https://github.com/Instrument/instrument-serif
- DM Sans and DM Mono — The DM font project authors, SIL Open Font License. https://github.com/google/fonts/tree/main/ofl/dmsans and https://github.com/google/fonts/tree/main/ofl/dmmono

Complete p5, Astronomy Engine, and font license texts are included in the `licenses/` directory alongside these credits.

## Design reference

User-provided Clock Mockup in Figma: https://www.figma.com/design/RYHxY6TlREXHVtGa6GwZSa/Clock-Mockup?node-id=1-23279

The globe, lighting, and camera are rendered in p5.js. The reference's Roman-numeral dial is intentionally omitted per the project brief.

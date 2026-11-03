// Erzeugt die App-Icons als PNG ohne zusätzliche Abhängigkeiten.
// Motiv: ein Ring auf grünem Grund, zu drei Vierteln gefüllt.
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x15, 0x7a, 0x4e]
const TRACK = [0x3f, 0x93, 0x6c]
const FG = [0xff, 0xff, 0xff]

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y)
      const i = y * (size * 3 + 1) + 1 + x * 3
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Ring mit runden Enden, Füllung 75 %, Start oben im Uhrzeigersinn.
function sample(u, v) {
  const r = 0.27
  const w = 0.085
  const dx = u - 0.5
  const dy = v - 0.5
  const d = Math.hypot(dx, dy)
  const angle = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI)
  const fill = 0.75 * 2 * Math.PI
  const onRing = Math.abs(d - r) <= w / 2
  const capStart = Math.hypot(dx, dy + r) <= w / 2
  const endX = Math.sin(fill) * r
  const endY = -Math.cos(fill) * r
  const capEnd = Math.hypot(dx - endX, dy - endY) <= w / 2
  if ((onRing && angle <= fill) || capStart || capEnd) return FG
  if (onRing) return TRACK
  return BG
}

function render(size) {
  const ss = 4
  return png(size, (x, y) => {
    let acc = [0, 0, 0]
    for (let i = 0; i < ss; i++)
      for (let j = 0; j < ss; j++) {
        const c = sample((x + (i + 0.5) / ss) / size, (y + (j + 0.5) / ss) / size)
        acc = acc.map((v, k) => v + c[k])
      }
    return acc.map((v) => Math.round(v / (ss * ss)))
  })
}

mkdirSync('public/icons', { recursive: true })
for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  writeFileSync(`public/icons/${name}`, render(size))
}

writeFileSync(
  'public/icons/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#157A4E"/><circle cx="32" cy="32" r="17.3" fill="none" stroke="#3F936C" stroke-width="5.4"/><circle cx="32" cy="32" r="17.3" fill="none" stroke="#fff" stroke-width="5.4" stroke-linecap="round" stroke-dasharray="81.5 200" transform="rotate(-90 32 32)"/></svg>\n`,
)
console.log('Icons erzeugt.')

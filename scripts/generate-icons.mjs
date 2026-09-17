import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { createHash } from 'node:crypto'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.concat([t, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcBuf))
  return Buffer.concat([len, t, data, crc])
}

function png(width, height, paint) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = paint(x, y, width, height)
      const i = row + 1 + x * 4
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function paintIcon(x, y, size, { maskable = false } = {}) {
  const pad = maskable ? size * 0.12 : 0
  const inner = size - pad * 2
  const nx = (x - pad) / inner
  const ny = (y - pad) / inner
  if (nx < 0 || ny < 0 || nx > 1 || ny > 1) return [196, 92, 38]
  const r = size * 0.18
  const inRound =
    (x > pad + r && x < size - pad - r) ||
    (y > pad + r && y < size - pad - r) ||
    Math.hypot(x - (pad + r), y - (pad + r)) < r ||
    Math.hypot(x - (size - pad - r), y - (pad + r)) < r ||
    Math.hypot(x - (pad + r), y - (size - pad - r)) < r ||
    Math.hypot(x - (size - pad - r), y - (size - pad - r)) < r
  if (!inRound) return [196, 92, 38]
  const cardL = pad + inner * 0.16
  const cardT = pad + inner * 0.28
  const cardR = pad + inner * 0.84
  const cardB = pad + inner * 0.78
  if (x > cardL && x < cardR && y > cardT && y < cardB) {
    if (x > cardL + inner * 0.08 && x < cardL + inner * 0.28 && y > cardT + inner * 0.08 && y < cardT + inner * 0.24) {
      return [224, 138, 82]
    }
    return [246, 241, 232]
  }
  return [196, 92, 38]
}

await mkdir(root, { recursive: true })
const files = [
  ['icon-192.png', png(192, 192, (x, y, w, h) => paintIcon(x, y, w))],
  ['icon-512.png', png(512, 512, (x, y, w, h) => paintIcon(x, y, w))],
  ['icon-512-maskable.png', png(512, 512, (x, y, w, h) => paintIcon(x, y, w, { maskable: true }))],
]
for (const [name, buf] of files) {
  const path = join(root, name)
  await new Promise((resolve, reject) => {
    const stream = createWriteStream(path)
    stream.on('finish', resolve)
    stream.on('error', reject)
    stream.end(buf)
  })
}
createHash('sha1')
console.log('icons ok')

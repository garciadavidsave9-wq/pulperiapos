export function compressImage(file, { maxWidth = 500, maxBytes = 140 * 1024, quality = 0.84 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No hay archivo'))
      return
    }

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d', { alpha: false })
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)

      let q = quality
      const encode = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('No se pudo comprimir la imagen'))
              return
            }
            if (blob.size > maxBytes && q > 0.45) {
              q = Math.max(0.45, q - 0.08)
              encode()
              return
            }
            const reader = new FileReader()
            reader.onload = () =>
              resolve({
                dataUrl: reader.result,
                bytes: blob.size,
                width: canvas.width,
                height: canvas.height,
              })
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
          },
          'image/jpeg',
          q
        )
      }
      encode()
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('La imagen no se pudo leer'))
    }
    img.src = objectUrl
  })
}

export function formatMoney(value) {
  const n = Number(value) || 0
  return `L. ${n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('es-NI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isSameDay(iso, date = new Date()) {
  const d = new Date(iso)
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  )
}

export function parseTags(input) {
  return String(input || '')
    .split(/[,#]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

export const LOW_STOCK = 5

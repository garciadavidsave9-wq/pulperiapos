export function isValidImageFile(file) {
  if (!file) return false
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  const allowedType = ['image/jpeg', 'image/png', 'image/webp'].includes(type)
  const allowedExt = /\.(jpe?g|png|webp)$/i.test(name)
  return allowedType || allowedExt
}

export function dataUrlToBlob(dataUrl) {
  const [header, base64] = String(dataUrl).split(',')
  const mime = (header.match(/data:(.*?);base64/)?.[1] || 'image/jpeg').toLowerCase()
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function compressImage(file, { maxWidth = 700, maxBytes = 130 * 1024, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No hay archivo seleccionado.'))
      return
    }
    if (!isValidImageFile(file)) {
      reject(new Error('Solo se permiten imágenes JPG, PNG o WEBP.'))
      return
    }

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / Math.max(img.width, 1))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) {
          URL.revokeObjectURL(objectUrl)
          reject(new Error('No se pudo preparar la imagen para compresión.'))
          return
        }

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(objectUrl)

        let q = quality
        const encode = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('La imagen está dañada o no se pudo procesar. Prueba con otra.'))
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
                  blob,
                  bytes: blob.size,
                  width: canvas.width,
                  height: canvas.height,
                })
              reader.onerror = () => reject(new Error('La imagen está dañada o no se pudo leer. Prueba con otra.'))
              reader.readAsDataURL(blob)
            },
            'image/jpeg',
            q
          )
        }
        encode()
      } catch {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('La imagen está dañada o no se pudo procesar. Prueba con otra.'))
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('La imagen está dañada o no se pudo leer. Prueba con otra.'))
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

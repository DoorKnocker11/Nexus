// Image processing: thumbnails are center-cropped squares, portraits keep
// their aspect ratio but are downscaled to a sane maximum dimension.

const THUMB_SIZE = 512
const PORTRAIT_MAX = 1400

async function loadBitmap(fileOrBlob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(fileOrBlob)
    } catch {
      // fall through to <img> path
    }
  }
  const url = URL.createObjectURL(fileOrBlob)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function toBlob(canvas, type = 'image/webp', quality = 0.88) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), type, quality)
  })
}

/** Center-crop to a square thumbnail of THUMB_SIZE. */
export async function processThumb(fileOrBlob) {
  const img = await loadBitmap(fileOrBlob)
  const w = img.width, h = img.height
  const side = Math.min(w, h)
  const sx = (w - side) / 2
  const sy = (h - side) / 2
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_SIZE
  canvas.height = THUMB_SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE)
  if (img.close) img.close()
  return toBlob(canvas)
}

/** Keep aspect ratio, downscale so the longest side is <= PORTRAIT_MAX. */
export async function processPortrait(fileOrBlob) {
  const img = await loadBitmap(fileOrBlob)
  const w = img.width, h = img.height
  const scale = Math.min(1, PORTRAIT_MAX / Math.max(w, h))
  const dw = Math.max(1, Math.round(w * scale))
  const dh = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, dw, dh)
  if (img.close) img.close()
  return toBlob(canvas)
}

export function isImageFile(file) {
  return file && file.type && file.type.startsWith('image/')
}

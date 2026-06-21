// Max bytes to send through Vercel serverless (hard limit 4.5 MB; we target 3.5 MB to leave headroom)
const MAX_BYTES = 3.5 * 1024 * 1024

export async function compressImageFile(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file
  if (file.size <= MAX_BYTES) return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')) }
    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      const MAX_DIM = 2048
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      const outType = file.type === 'image/png' ? 'image/jpeg' : file.type
      let quality  = 0.85

      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Compression failed')); return }
          if (blob.size <= MAX_BYTES || quality <= 0.3) {
            const ext  = outType === 'image/jpeg' ? 'jpg' : 'webp'
            const name = file.name.replace(/\.[^.]+$/, `.${ext}`)
            resolve(new File([blob], name, { type: outType }))
          } else {
            quality = Math.round((quality - 0.1) * 10) / 10
            tryCompress()
          }
        }, outType, quality)
      }
      tryCompress()
    }

    img.src = url
  })
}

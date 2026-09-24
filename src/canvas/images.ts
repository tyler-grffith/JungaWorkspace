// Image files become bounded data URLs so they can live inside a document in local storage.

/** Downscale an image file to fit the storage budget and return a data URL plus its size. */
export function readImageFile(
  file: File,
  maxEdge = 1600,
): Promise<{ src: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
      const width = Math.max(1, Math.round(image.naturalWidth * scale))
      const height = Math.max(1, Math.round(image.naturalHeight * scale))
      if (file.type === 'image/svg+xml' || (scale === 1 && file.size < 200 * 1024)) {
        const reader = new FileReader()
        reader.onload = () => resolve({ src: reader.result as string, width, height })
        reader.onerror = () => reject(new Error('The image could not be read.'))
        reader.readAsDataURL(file)
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(image, 0, 0, width, height)
      const photo = file.type === 'image/jpeg' || file.size > 600 * 1024
      resolve({ src: canvas.toDataURL(photo ? 'image/jpeg' : 'image/png', 0.85), width, height })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file is not an image this browser can open.'))
    }
    image.src = url
  })
}

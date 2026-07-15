export async function comprimirFotoParaBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const MAX = 1600
  const scale = Math.min(1, MAX / bitmap.width, MAX / bitmap.height)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
}

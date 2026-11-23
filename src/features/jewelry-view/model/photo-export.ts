import type { PhotoRecord } from '../../../entities/jewelry/model/item'

export function photoFiles(photos: PhotoRecord[]): File[] {
  return photos.map((photo, index) => {
    const basename = photo.originalName.split(/[/\\]/).pop() ?? ''
    const safeName =
      Array.from(basename)
        .map((character) =>
          character.charCodeAt(0) < 32 || /[<>:"|?*]/.test(character) ? '_' : character,
        )
        .join('')
        .replace(/[. ]+$/, '')
        .slice(-150) || 'photo'
    return new File([photo.blob], `${String(index + 1).padStart(2, '0')}-${safeName}`, {
      type: photo.mimeType,
    })
  })
}

export async function photoArchive(files: File[]): Promise<Blob> {
  const { zip } = await import('fflate')
  const entries = Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [file.name, new Uint8Array(await file.arrayBuffer())]),
    ),
  )
  return new Promise((resolve, reject) => {
    zip(entries, { level: 0 }, (error, data) => {
      if (error) reject(error)
      else resolve(new Blob([new Uint8Array(data)], { type: 'application/zip' }))
    })
  })
}

export function downloadPhotoFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    // Downloads may consume the blob after the click handler has returned.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

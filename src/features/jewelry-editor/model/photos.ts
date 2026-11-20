import type { NewPhoto } from '../../../entities/jewelry/model/item'

export async function preparePhotos(files: File[], existingCount: number): Promise<NewPhoto[]> {
  if (existingCount + files.length > 5)
    throw new Error('Можно добавить не больше 5 фотографий. Выберите меньше файлов.')
  const photos: NewPhoto[] = []
  for (const file of files) {
    if (!file.size || (file.type && !file.type.startsWith('image/')))
      throw new Error('Выберите файл изображения')
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty image')
      photos.push({
        id: crypto.randomUUID(),
        blob: file,
        originalName: file.name,
        mimeType: file.type,
        byteSize: file.size,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    } catch {
      throw new Error(
        'Не удалось открыть фотографию. Этот формат может не поддерживаться браузером; выберите другое фото.',
      )
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  return photos
}

import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { unzipSync } from 'fflate'
import { photoArchive, photoFiles } from './photo-export'
import type { PhotoRecord } from '../../../entities/jewelry/model/item'

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('File', NodeFile)
})
afterEach(() => vi.unstubAllGlobals())

it('exports original bytes with safe, ordered and unique filenames, including duplicate names', async () => {
  const originals = [new Uint8Array([1, 2, 3]), new Uint8Array(100_000).fill(42)]
  const photos = originals.map((bytes, index): PhotoRecord => {
    const blob = new Blob([bytes], { type: 'image/png' })
    return {
      id: String(index),
      itemId: 'item',
      blob,
      originalName: '../папка\\фото.png',
      mimeType: blob.type,
      byteSize: blob.size,
      width: 1,
      height: 1,
    }
  })
  const files = photoFiles(photos)
  expect(files.map((file) => file.name)).toEqual(['01-фото.png', '02-фото.png'])
  expect(files[0].type).toBe('image/png')
  expect(new Uint8Array(await files[1].arrayBuffer())).toEqual(originals[1])
  const archive = await photoArchive(files)
  const unpacked = unzipSync(new Uint8Array(await archive.arrayBuffer()))
  expect(Object.keys(unpacked)).toEqual(files.map((file) => file.name))
  expect(unpacked[files[0].name]).toEqual(originals[0])
  expect(unpacked[files[1].name]).toEqual(originals[1])
})

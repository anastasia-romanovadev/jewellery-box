import { useEffect, useRef, useState } from 'react'
import { readPhoto } from '../../../data/jewelry-repository'
import classes from './StoredPhoto.module.scss'

export function StoredPhoto({ id, blob, alt }: { id: string; blob?: Blob; alt: string }) {
  const container = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(() => !('IntersectionObserver' in window))
  const [image, setImage] = useState<{ id: string; url?: string; error?: string } | null>(null)
  useEffect(() => {
    const element = container.current
    if (!element) return
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: '150px',
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let url: string | undefined
    void (blob ? Promise.resolve(blob) : readPhoto(id).then((photo) => photo.blob))
      .then((value) => {
        if (cancelled) return
        url = URL.createObjectURL(value)
        setImage({ id, url })
      })
      .catch(() => {
        if (!cancelled) setImage({ id, error: 'Не удалось загрузить фото' })
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [id, blob, visible])
  return (
    <div ref={container} className={classes.frame}>
      {visible && image?.id === id && image.url ? (
        <img
          src={image.url}
          alt={alt}
          decoding="async"
          onError={() => setImage({ id, error: 'Не удалось показать фото' })}
        />
      ) : (
        <span role="status">{image?.id === id && image.error ? image.error : 'Фотография'}</span>
      )}
    </div>
  )
}

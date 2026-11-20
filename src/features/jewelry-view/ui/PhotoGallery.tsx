import { useRef } from 'react'
import { StoredPhoto } from '../../../entities/jewelry/ui/StoredPhoto'
import classes from './JewelryDetails.module.scss'

export function PhotoGallery({
  photoIds,
  index,
  label,
  onChange,
  onOpen,
}: {
  photoIds: string[]
  index: number
  label: string
  onChange: (index: number) => void
  onOpen?: () => void
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  function move(next: number) {
    onChange(Math.max(0, Math.min(photoIds.length - 1, next)))
  }
  return (
    <section aria-label="Фотографии украшения" className={classes.gallery}>
      <div
        className={classes.swipeArea}
        onPointerDown={() => {
          suppressClick.current = false
        }}
        onTouchStart={(event) => {
          suppressClick.current = false
          const touch = event.touches[0]
          start.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null
        }}
        onTouchMove={(event) => {
          if (event.touches.length !== 1) start.current = null
        }}
        onTouchCancel={() => {
          start.current = null
        }}
        onTouchEnd={(event) => {
          const origin = start.current
          start.current = null
          if (!origin) return
          const touch = event.changedTouches[0]
          const dx = touch.clientX - origin.x
          const dy = touch.clientY - origin.y
          suppressClick.current = Math.hypot(dx, dy) > 10
          if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5)
            move(index + (dx < 0 ? 1 : -1))
        }}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.preventDefault()
            event.stopPropagation()
            suppressClick.current = false
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            move(index + (event.key === 'ArrowLeft' ? -1 : 1))
          }
        }}
      >
        <button
          className={classes.imageButton}
          onClick={onOpen}
          aria-label={
            onOpen
              ? 'Открыть фотографию крупно'
              : 'Фотография, используйте стрелки для переключения'
          }
        >
          <StoredPhoto
            key={photoIds[index]}
            id={photoIds[index]}
            alt={`${label}, фото ${index + 1}`}
          />
        </button>
      </div>
      <div className={classes.pagination}>
        {photoIds.length > 1 &&
          photoIds.map((id, position) => (
            <button
              key={id}
              className={classes.dot}
              aria-label={`Фото ${position + 1}`}
              aria-current={position === index ? 'true' : undefined}
              onClick={() => onChange(position)}
            />
          ))}
        <span className={classes.counter} role="status" aria-label="Номер фотографии">
          {index + 1} / {photoIds.length}
        </span>
      </div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { collectionTaglines } from '../../../shared/config/playful-copy'

// Remember the last visit across route unmounts, without changing text on collection updates.
let lastVisitedIndex = -1

export function CollectionTagline() {
  const [index] = useState(() => (lastVisitedIndex + 1) % collectionTaglines.length)
  useEffect(() => {
    lastVisitedIndex = index
  }, [index])
  return <p>{collectionTaglines[index]}</p>
}

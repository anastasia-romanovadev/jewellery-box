import { useState } from 'react'

export function useInstallGuide() {
  const [isVisible, setIsVisible] = useState(true)

  function dismiss() {
    setIsVisible(false)
  }

  return { isVisible, dismiss }
}

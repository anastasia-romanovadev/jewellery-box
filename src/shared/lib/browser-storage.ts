export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    console.warn(`Unable to read "${key}" from browser storage.`, error)
    return null
  }
}

export function writeStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch (error) {
    console.warn(`Unable to save "${key}" to browser storage.`, error)
    return false
  }
}

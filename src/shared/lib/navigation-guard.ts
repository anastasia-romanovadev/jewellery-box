export const BEFORE_NAVIGATE = 'jewelry:before-navigate'
export function canNavigate(): boolean {
  return window.dispatchEvent(new Event(BEFORE_NAVIGATE, { cancelable: true }))
}

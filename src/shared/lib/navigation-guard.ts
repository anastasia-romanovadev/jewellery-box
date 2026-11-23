export const BEFORE_NAVIGATE = 'jewelry:before-navigate'
export type NavigationRequest = { onConfirmed?: () => void }
export function canNavigate(onConfirmed?: () => void): boolean {
  return window.dispatchEvent(
    new CustomEvent<NavigationRequest>(BEFORE_NAVIGATE, {
      cancelable: true,
      detail: { onConfirmed },
    }),
  )
}

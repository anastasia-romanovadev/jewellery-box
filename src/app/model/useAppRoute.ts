import { useCallback, useSyncExternalStore } from 'react'
import { canNavigate } from '../../shared/lib/navigation-guard'

export type AppRoute = 'collection' | 'settings'

function getRoute(): AppRoute {
  return window.location.hash.startsWith('#/settings') ? 'settings' : 'collection'
}

function subscribe(onChange: () => void) {
  let previous = window.location.hash
  const hashChanged = () => {
    if (!canNavigate()) {
      window.history.replaceState(null, '', previous || '#/collection')
      return
    }
    previous = window.location.hash
    onChange()
  }
  const internalChanged = () => {
    previous = window.location.hash
    onChange()
  }
  window.addEventListener('hashchange', hashChanged)
  window.addEventListener('app-route', internalChanged)
  return () => {
    window.removeEventListener('hashchange', hashChanged)
    window.removeEventListener('app-route', internalChanged)
  }
}

export function useAppRoute() {
  const route = useSyncExternalStore<AppRoute>(subscribe, getRoute, () => 'collection')
  const navigate = useCallback((nextRoute: AppRoute) => {
    if (!canNavigate()) return false
    const nextHash = `#/${nextRoute}`
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', nextHash)
      window.dispatchEvent(new Event('app-route'))
    }
    return true
  }, [])

  return { route, navigate }
}

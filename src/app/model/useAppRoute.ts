import { useCallback, useSyncExternalStore } from 'react'

export type AppRoute = 'collection' | 'settings'

function getRoute(): AppRoute {
  return window.location.hash.startsWith('#/settings') ? 'settings' : 'collection'
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useAppRoute() {
  const route = useSyncExternalStore<AppRoute>(subscribe, getRoute, () => 'collection')
  const navigate = useCallback((nextRoute: AppRoute) => {
    const nextHash = `#/${nextRoute}`
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash
    }
  }, [])

  return { route, navigate }
}

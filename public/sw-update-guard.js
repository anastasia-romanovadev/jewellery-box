// Keep the previous worker and its lazy chunks while another application tab is open.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'ACTIVATE_WHEN_ALONE') return
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const scope = self.registration.scope
      const applicationClients = clients.filter((client) => client.url.startsWith(scope))
      if (applicationClients.length > 1) {
        event.ports[0]?.postMessage({ activated: false })
        return
      }
      event.ports[0]?.postMessage({ activated: true })
      await self.skipWaiting()
    }),
  )
})

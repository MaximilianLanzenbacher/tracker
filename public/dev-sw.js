// Räumt den Service Worker aus dem Entwicklungsserver auf, falls ein Gerät ihn noch installiert hat.
// Safari prüft beim Öffnen der Seite auf eine neue Version dieser Datei, meldet sie ab und lädt neu.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister()
      const windows = await self.clients.matchAll({ type: 'window' })
      for (const client of windows) client.navigate(client.url)
    })(),
  )
})

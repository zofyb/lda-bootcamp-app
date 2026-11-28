/* Service Worker der LIVEdream Academy: nur für die Installierbarkeit.
   Bewusst ohne Zwischenspeicher, damit nach jedem Update sofort die neue Version lädt. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

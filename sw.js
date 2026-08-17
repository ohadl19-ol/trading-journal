// Service Worker בסיסי ל"תחושת אפליקציה": מאפשר התקנה כאפליקציה עצמאית,
// ושומר עותק מקומי של קבצי המעטפת (shell) לפתיחה מהירה/אופליין.
// חשוב: לא נוגעים בבקשות ל-Google Apps Script — הנתונים תמיד חייבים לבוא רשת חיה.
const CACHE_NAME = 'trading-journal-shell-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // רק בקשות GET מאותו מקור (המעטפת של האפליקציה עצמה)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request)),
  )
})

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// רישום Service Worker כדי לאפשר התקנה כאפליקציה עצמאית (PWA) ופתיחה מהירה יותר
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // כשל ברישום ה-Service Worker לא אמור לשבור את האפליקציה עצמה
    })
  })
}

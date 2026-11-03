import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { db } from './lib/db'
import { ErrorBoundary, markStartupOk } from './ui/ErrorBoundary'
import './styles.css'

async function boot() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    const { seedDemo } = await import('./lib/demo')
    await seedDemo()
    history.replaceState(null, '', location.pathname)
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
  // Klappt ein Lesezugriff mit Cursor, ist der Speicher in Ordnung.
  db.entries
    .limit(1)
    .toArray()
    .then(markStartupOk)
    .catch(() => {})
}

void boot()

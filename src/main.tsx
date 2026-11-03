import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './ui/ErrorBoundary'
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
}

void boot()

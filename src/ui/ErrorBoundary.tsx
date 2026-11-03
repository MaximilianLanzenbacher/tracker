import Dexie from 'dexie'
import { Component, type ReactNode } from 'react'
import { db } from '../lib/db'

const RETRY_KEY = 'teller-db-retry'

/** Safari meldet einen beschädigten oder hängenden Datenspeicher als UnknownError o. Ä. */
function isStorageError(err: unknown): boolean {
  const e = err as { name?: string; inner?: { name?: string }; message?: string }
  const names = [e?.name, e?.inner?.name]
  return (
    names.some((n) => n === 'UnknownError' || n === 'DatabaseClosedError' || n === 'OpenFailedError' || n === 'InvalidStateError') ||
    /indexed ?db|cursor|database/i.test(e?.message ?? '')
  )
}

// Höchstens ein automatisches Neuladen in diesem Zeitraum, damit nie eine Schleife entsteht.
const RETRY_WINDOW_MS = 5 * 60 * 1000

/** true, wenn jetzt ein automatischer Neuversuch erlaubt ist. Merkt sich den Versuch gleich mit. */
function claimRetry(): boolean {
  try {
    const last = Number(localStorage.getItem(RETRY_KEY) ?? 0)
    if (Date.now() - last < RETRY_WINDOW_MS) return false
    localStorage.setItem(RETRY_KEY, String(Date.now()))
    return localStorage.getItem(RETRY_KEY) !== null
  } catch {
    // Ohne funktionierenden Speicher lieber gar nicht automatisch neu laden.
    return false
  }
}

interface State {
  error: unknown
  busy: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, busy: false }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error }
  }

  componentDidCatch(error: unknown) {
    // Einmal von selbst neu verbinden und neu laden, das behebt hängende Verbindungen meist.
    if (isStorageError(error) && claimRetry()) {
      db.close()
      window.location.reload()
    }
  }

  componentDidUpdate() {
    // Die technische Fehlerleiste aus index.html würde die Knöpfe verdecken.
    if (this.state.error) document.getElementById('boot-error')?.remove()
  }

  private reset = async () => {
    const ok = window.confirm(
      'Der Speicher von Teller wird auf diesem Gerät geleert. Einträge, Gewicht und Ziele gehen dabei verloren, außer du hast sie vorher gesichert. Fortfahren?',
    )
    if (!ok) return
    this.setState({ busy: true })
    try {
      db.close()
      await Dexie.delete('teller')
    } finally {
      window.location.reload()
    }
  }

  render() {
    const { error, busy } = this.state
    if (!error) return this.props.children
    const storage = isStorageError(error)
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)

    return (
      <main className="screen crash">
        <h1 className="large-title">{storage ? 'Speicher reagiert nicht' : 'Etwas ist schiefgelaufen'}</h1>
        <p className="crash-text">
          {storage
            ? 'Safari kann den Datenspeicher von Teller gerade nicht öffnen. Lade die App neu. Hilft das nicht, schließ alle Tabs mit Teller und öffne die App noch einmal.'
            : 'Die App ist auf einen Fehler gestoßen. Lade sie neu, deine Daten bleiben erhalten.'}
        </p>
        <button type="button" className="btn" onClick={() => window.location.reload()} disabled={busy}>
          Neu laden
        </button>
        {storage && (
          <>
            <p className="crash-text">
              Bleibt der Fehler, ist der Speicher wahrscheinlich beschädigt. Dann hilft nur, ihn zurückzusetzen.
            </p>
            <button type="button" className="btn btn-danger" onClick={this.reset} disabled={busy}>
              Speicher zurücksetzen
            </button>
          </>
        )}
        <pre className="crash-detail">{detail}</pre>
      </main>
    )
  }
}

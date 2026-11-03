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

function readRetry(): boolean {
  try {
    return sessionStorage.getItem(RETRY_KEY) === '1'
  } catch {
    return true
  }
}

function writeRetry(on: boolean) {
  try {
    if (on) sessionStorage.setItem(RETRY_KEY, '1')
    else sessionStorage.removeItem(RETRY_KEY)
  } catch {
    // ohne sessionStorage einfach nicht automatisch neu versuchen
  }
}

/** Nach einem erfolgreichen Start darf beim nächsten Fehler wieder automatisch neu geladen werden. */
export function markStartupOk() {
  writeRetry(false)
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
    if (isStorageError(error) && !readRetry()) {
      writeRetry(true)
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
      writeRetry(false)
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

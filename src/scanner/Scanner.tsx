import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { CheckIcon } from '../ui/icons'

// Die WebAssembly-Datei wird mit der App ausgeliefert, damit der Scanner auch offline läuft.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
  },
})

type State = 'starting' | 'running' | 'found' | 'denied' | 'unavailable'

const VALID_LENGTHS = new Set([8, 12, 13, 14])

export function Scanner({ onDetect }: { onDetect: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<State>('starting')
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  useEffect(() => {
    let stream: MediaStream | undefined
    let timer: number | undefined
    let cancelled = false
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })

    const stop = () => {
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }

    const tick = async () => {
      const video = videoRef.current
      if (cancelled || !video) return
      if (video.readyState >= 2) {
        try {
          const [hit] = await detector.detect(video)
          const code = hit?.rawValue?.replace(/\D/g, '')
          if (code && VALID_LENGTHS.has(code.length) && !cancelled) {
            setState('found')
            navigator.vibrate?.(30)
            stop()
            // Kurz die Bestätigung zeigen, dann weiter.
            window.setTimeout(() => !cancelled && onDetectRef.current(code), 380)
            return
          }
        } catch {
          // Einzelne Frames dürfen fehlschlagen.
        }
      }
      timer = window.setTimeout(tick, 140)
    }

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelled) return stop()
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setState('running')
        tick()
      } catch (err) {
        if (cancelled) return
        const name = (err as Error).name
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
      }
    }

    start()
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner-video" playsInline muted autoPlay aria-hidden="true" />

      {(state === 'starting' || state === 'running' || state === 'found') && (
        <motion.div
          className={`scanner-frame ${state === 'found' ? 'found' : ''}`}
          animate={state === 'found' ? { scale: [1, 0.94, 1] } : { scale: 1 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <AnimatePresence>
            {state === 'found' && (
              <motion.span
                className="scanner-check"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 26 }}
              >
                <CheckIcon size={30} strokeWidth={2.6} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <p className="scanner-caption">
        {state === 'starting' && 'Kamera wird gestartet …'}
        {state === 'running' && 'Halte den Barcode in den Rahmen'}
        {state === 'found' && 'Erkannt'}
        {state === 'denied' &&
          'Tracker darf die Kamera nicht benutzen. Erlaube den Zugriff unter Einstellungen > Safari > Kamera oder tipp den Barcode unten ein.'}
        {state === 'unavailable' &&
          'Die Kamera ist hier nicht verfügbar. Auf dem iPhone braucht die App dafür eine https-Adresse. Tipp den Barcode solange unten ein.'}
      </p>
    </div>
  )
}

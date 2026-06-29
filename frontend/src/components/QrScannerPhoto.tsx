import { useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import jsQR from 'jsqr'
import QrScanner from 'qr-scanner'
import workerSrc from 'qr-scanner/qr-scanner-worker.min.js?url'

QrScanner.WORKER_PATH = workerSrc

interface Props {
  onScan: (url: string) => void
  onClose: () => void
}

type Mode = 'qrscanner' | 'jsqr'

export default function QrScannerPhoto({ onScan, onClose }: Props) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode>('qrscanner')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setProcessing(true)
    setError('')

    try {
      if (mode === 'qrscanner') {
        // Uses the same WASM engine that works on desktop webcam
        const result = await QrScanner.scanImage(file, {
          returnDetailedScanResult: true,
          alsoTryWithoutScanRegion: true,
        })
        onScan(result.data)
      } else {
        // jsQR via canvas — diagnóstico: mostra R[0] para detectar canvas vazio
        const bitmap = await createImageBitmap(file)
        const MAX = 1024
        const scale = Math.min(1, MAX / bitmap.width, MAX / bitmap.height)
        const w = Math.round(bitmap.width * scale)
        const h = Math.round(bitmap.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(bitmap, 0, 0, w, h)
        bitmap.close()
        const imageData = ctx.getImageData(0, 0, w, h)
        const r0 = imageData.data[0] ?? -1
        const code = jsQR(imageData.data, w, h)
        if (code) {
          onScan(code.data)
        } else {
          setError(`jsQR: não encontrado. Canvas ${w}×${h}px, R[0]=${r0}`)
          if (inputRef.current) inputRef.current.value = ''
        }
      }
    } catch (err) {
      setError(`${mode}: ${err instanceof Error ? err.message : String(err)}`)
      if (inputRef.current) inputRef.current.value = ''
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={styles.container}>
      <p style={styles.hint}>Modo: <strong>{mode}</strong> — troque abaixo se um falhar</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <button
        style={styles.captureButton}
        disabled={processing}
        onClick={() => inputRef.current?.click()}
      >
        {processing ? 'Processando…' : 'Fotografar QR Code'}
      </button>

      <div style={styles.modeRow}>
        <button
          style={{ ...styles.modeButton, fontWeight: mode === 'qrscanner' ? 700 : 400 }}
          onClick={() => { setMode('qrscanner'); setError('') }}
        >
          qr-scanner
        </button>
        <button
          style={{ ...styles.modeButton, fontWeight: mode === 'jsqr' ? 700 : 400 }}
          onClick={() => { setMode('jsqr'); setError('') }}
        >
          jsQR (diagnóstico)
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <button style={styles.cancelButton} onClick={onClose}>
        Cancelar
      </button>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '24px',
    gap: '16px',
  },
  hint: {
    margin: 0,
    color: '#6b7280',
    fontSize: '13px',
    textAlign: 'center',
  },
  captureButton: {
    width: '100%',
    maxWidth: '360px',
    padding: '18px',
    fontSize: '18px',
    fontWeight: '600',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  modeRow: {
    display: 'flex',
    gap: '12px',
  },
  modeButton: {
    padding: '8px 16px',
    fontSize: '13px',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#374151',
  },
  error: {
    margin: 0,
    color: '#dc2626',
    fontSize: '13px',
    textAlign: 'center',
    wordBreak: 'break-all',
  },
  cancelButton: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '8px',
  },
}

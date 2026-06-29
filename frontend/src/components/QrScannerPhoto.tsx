import { useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import jsQR from 'jsqr'

interface Props {
  onScan: (url: string) => void
  onClose: () => void
}

export default function QrScannerPhoto({ onScan, onClose }: Props) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setProcessing(true)
    setError('')

    try {
      // createImageBitmap is more reliable than HTMLImageElement on iOS Safari:
      // respects EXIF rotation and is guaranteed decoded before canvas draw.
      const bitmap = await createImageBitmap(file)

      // Scale down to ≤1024px — iOS PWA canvas silently fails above ~16MP
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
      const code = jsQR(imageData.data, w, h)

      if (code) {
        onScan(code.data)
      } else {
        setError(`QR Code não encontrado (canvas ${w}×${h}px). Tente mais perto.`)
        if (inputRef.current) inputRef.current.value = ''
      }
    } catch (err) {
      setError(`Erro: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={styles.container}>
      <p style={styles.hint}>Fotografe o QR Code da nota fiscal</p>

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
        {processing ? 'Processando…' : 'Abrir câmera'}
      </button>

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
    fontSize: '14px',
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
  error: {
    margin: 0,
    color: '#dc2626',
    fontSize: '14px',
    textAlign: 'center',
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

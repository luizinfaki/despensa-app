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

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setProcessing(true)
    setError('')

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      setProcessing(false)
      if (code) {
        onScan(code.data)
      } else {
        setError('QR Code não encontrado. Tente outra foto.')
        if (inputRef.current) inputRef.current.value = ''
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setProcessing(false)
      setError('Erro ao processar a imagem.')
    }

    img.src = objectUrl
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

import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface Props {
  onScan: (url: string) => void
  onClose: () => void
}

export default function QrScanner({ onScan, onClose }: Props) {
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onScanRef.current = onScan
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader')
    let active = true

    // Small delay to let StrictMode's first-pass cleanup release the camera
    // before the second pass tries to acquire it.
    const timer = setTimeout(() => {
      if (!active) return

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (!active) return
            active = false
            scanner.stop().then(() => onScanRef.current(decodedText)).catch(() => {})
          },
          () => {},
        )
        .catch(() => {
          if (active) onCloseRef.current()
        })
    }, 50)

    return () => {
      active = false
      clearTimeout(timer)
      scanner.stop().catch(() => {})
    }
  }, [])

  return (
    <div style={styles.container}>
      <div id="qr-reader" style={styles.reader} />
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
    flex: 1,
    padding: '16px',
    gap: '16px',
  },
  reader: {
    width: '100%',
    maxWidth: '400px',
  },
  cancelButton: {
    padding: '12px 32px',
    fontSize: '16px',
    background: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#374151',
  },
}

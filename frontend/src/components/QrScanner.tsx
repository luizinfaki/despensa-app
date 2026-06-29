import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'

interface Props {
  onScan: (url: string) => void
  onClose: () => void
}

export default function QrScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onScanRef.current = onScan
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const reader = new BrowserQRCodeReader()
    let controls: IScannerControls | null = null
    let active = true

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (result) => {
          if (result && active) {
            active = false
            controls?.stop()
            onScanRef.current(result.getText())
          }
        },
      )
      .then((c) => {
        controls = c
        if (!active) c.stop()
      })
      .catch(() => {
        if (active) onCloseRef.current()
      })

    return () => {
      active = false
      controls?.stop()
    }
  }, [])

  return (
    <div style={styles.container}>
      <video ref={videoRef} style={styles.video} />
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
  video: {
    width: '100%',
    maxWidth: '400px',
    borderRadius: '8px',
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

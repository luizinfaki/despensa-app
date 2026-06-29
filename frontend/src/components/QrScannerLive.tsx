import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import QrScanner from 'qr-scanner'
import workerSrc from 'qr-scanner/qr-scanner-worker.min.js?url'

// Tell qr-scanner where to find its WASM worker after Vite bundling
QrScanner.WORKER_PATH = workerSrc

interface Props {
  onScan: (url: string) => void
  onClose: () => void
}

export default function QrScannerLive({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onScanRef.current = onScan
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!videoRef.current) return

    let active = true
    const scanner = new QrScanner(
      videoRef.current,
      (result: QrScanner.ScanResult) => {
        if (!active) return
        active = false
        scanner.stop()
        onScanRef.current(result.data)
      },
      { preferredCamera: 'environment' },
    )

    scanner.start().catch(() => {
      if (active) onCloseRef.current()
    })

    return () => {
      active = false
      scanner.destroy()
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

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import QrScannerLive from '../components/QrScannerLive'
import QrScannerPhoto from '../components/QrScannerPhoto'

type ScanMode = 'live' | 'photo' | null
type ScanResult = { ok: boolean; message: string } | null

export default function HomePage() {
  const [scanMode, setScanMode] = useState<ScanMode>(null)
  const [result, setResult] = useState<ScanResult>(null)

  async function handleScan(url: string) {
    setScanMode(null)
    const { data } = await supabase.auth.getUser()
    if (!data.user) return

    const { error } = await supabase
      .from('notas_fiscais')
      .insert({ url_sefaz: url, user_id: data.user.id, status: 'PENDENTE' })

    if (!error) {
      setResult({ ok: true, message: 'Nota salva com sucesso!' })
    } else if (error.code === '23505') {
      setResult({ ok: false, message: 'Essa nota já foi escaneada.' })
    } else {
      setResult({ ok: false, message: `Erro ao salvar: ${error.message}` })
    }
  }

  if (scanMode === 'live') {
    return <QrScannerLive onScan={handleScan} onClose={() => setScanMode(null)} />
  }
  if (scanMode === 'photo') {
    return <QrScannerPhoto onScan={handleScan} onClose={() => setScanMode(null)} />
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Despensa</h1>

      {result && (
        <p style={{ ...styles.feedback, color: result.ok ? '#16a34a' : '#dc2626' }}>
          {result.message}
        </p>
      )}

      <button
        style={styles.primaryButton}
        onClick={() => { setResult(null); setScanMode('live') }}
      >
        Escanear (câmera ao vivo)
      </button>

      <button
        style={{ ...styles.primaryButton, background: '#2563eb' }}
        onClick={() => { setResult(null); setScanMode('photo') }}
      >
        Escanear (foto)
      </button>

      <button
        style={styles.secondaryButton}
        onClick={() => supabase.auth.signOut()}
      >
        Sair
      </button>

      <p style={styles.version}>build {__APP_VERSION__}</p>
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
  title: {
    margin: 0,
    fontSize: '2rem',
    color: '#16a34a',
  },
  feedback: {
    margin: 0,
    fontSize: '16px',
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
    maxWidth: '360px',
    padding: '18px',
    fontSize: '18px',
    fontWeight: '600',
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  secondaryButton: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '8px',
  },
  version: {
    margin: 0,
    marginTop: 'auto',
    paddingTop: '24px',
    fontSize: '11px',
    color: '#d1d5db',
  },
}

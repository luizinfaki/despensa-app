import { useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'

interface NotaData {
  qrcode_url: string | null
  cnpj: string | null
  nome_loja: string | null
  itens: { nome: string; qtd: number; valor_unit: number; valor_total: number }[]
  total: number | null
  data_hora: string | null
}

interface Props {
  onScan: (url: string) => void
  onClose: () => void
}

export default function QrScannerPhoto({ onScan, onClose }: Props) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [nota, setNota] = useState<NotaData | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (inputRef.current) inputRef.current.value = ''

    setProcessing(true)
    setError('')
    setNota(null)

    try {
      // Resize to max 1600px and compress before sending to API
      const bitmap = await createImageBitmap(file)
      const MAX = 1600
      const scale = Math.min(1, MAX / bitmap.width, MAX / bitmap.height)
      const w = Math.round(bitmap.width * scale)
      const h = Math.round(bitmap.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
      bitmap.close()
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]

      const { data: { session } } = await supabase.auth.getSession()

      const resp = await fetch('/api/decode-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ imageBase64, mediaType: 'image/jpeg' }),
      })

      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`)

      setNota(json as NotaData)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setProcessing(false)
    }
  }

  // Preview state — show extracted data before saving
  if (nota) {
    const fmt = (n: number | null | undefined) =>
      n != null ? `R$ ${n.toFixed(2).replace('.', ',')}` : '—'

    return (
      <div style={styles.container}>
        <p style={styles.previewTitle}>Nota identificada pela IA</p>

        <div style={styles.card}>
          {nota.nome_loja && <p style={styles.storeName}>{nota.nome_loja}</p>}
          {nota.cnpj && <p style={styles.field}>CNPJ: {nota.cnpj}</p>}
          {nota.data_hora && <p style={styles.field}>Data: {nota.data_hora}</p>}

          {nota.itens.length > 0 && (
            <>
              <p style={styles.sectionLabel}>Itens ({nota.itens.length})</p>
              <div style={styles.itemList}>
                {nota.itens.map((item, i) => (
                  <div key={i} style={styles.itemRow}>
                    <span style={styles.itemName}>
                      {item.qtd}x {item.nome}
                    </span>
                    <span style={styles.itemPrice}>{fmt(item.valor_total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {nota.total != null && (
            <p style={styles.totalRow}>Total: {fmt(nota.total)}</p>
          )}

          <p style={nota.qrcode_url ? styles.qrOk : styles.qrMissing}>
            {nota.qrcode_url ? 'QR Code lido com sucesso' : 'QR Code não identificado'}
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFile}
        />

        {nota.qrcode_url && (
          <button style={styles.saveButton} onClick={() => onScan(nota.qrcode_url!)}>
            Salvar nota
          </button>
        )}

        <button
          style={styles.retryButton}
          onClick={() => { setNota(null); setError(''); inputRef.current?.click() }}
        >
          Nova foto
        </button>

        <button style={styles.cancelButton} onClick={onClose}>
          Cancelar
        </button>
      </div>
    )
  }

  // Capture state
  return (
    <div style={styles.container}>
      <p style={styles.hint}>
        {processing
          ? 'Analisando com IA… aguarde alguns segundos'
          : 'Fotografe toda a nota fiscal (inclua o QR Code)'}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <button
        style={{ ...styles.captureButton, opacity: processing ? 0.6 : 1 }}
        disabled={processing}
        onClick={() => inputRef.current?.click()}
      >
        {processing ? 'Analisando…' : 'Fotografar nota'}
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
    flex: 1,
    padding: '20px 16px',
    gap: '12px',
    overflowY: 'auto',
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
  // Preview styles
  previewTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  storeName: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '700',
    color: '#111827',
  },
  field: {
    margin: 0,
    fontSize: '13px',
    color: '#6b7280',
  },
  sectionLabel: {
    margin: '8px 0 4px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  itemList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '8px',
  },
  itemName: {
    fontSize: '13px',
    color: '#374151',
    flex: 1,
  },
  itemPrice: {
    fontSize: '13px',
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  totalRow: {
    margin: '8px 0 0',
    fontSize: '15px',
    fontWeight: '700',
    color: '#111827',
    borderTop: '1px solid #e5e7eb',
    paddingTop: '8px',
  },
  qrOk: {
    margin: '4px 0 0',
    fontSize: '13px',
    color: '#16a34a',
    fontWeight: '600',
  },
  qrMissing: {
    margin: '4px 0 0',
    fontSize: '13px',
    color: '#dc2626',
  },
  saveButton: {
    width: '100%',
    maxWidth: '400px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: '600',
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  retryButton: {
    width: '100%',
    maxWidth: '400px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: '500',
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    cursor: 'pointer',
  },
}

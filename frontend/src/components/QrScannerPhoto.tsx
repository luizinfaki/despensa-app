import { useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import { comprimirFotoParaBase64 } from '../lib/foto'

const API_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'
const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? ''

interface NotaData {
  cnpj: string | null
  nome_loja: string | null
  chave_acesso: string | null
  itens: { nome: string; qtd: number; valor_unit: number; valor_total: number; unidade: string }[]
  total: number | null
  data_hora: string | null
}

interface Props {
  onScan: (url: string) => void
  onClose: () => void
}

type State = 'input' | 'processing' | 'preview'

export default function QrScannerPhoto({ onScan, onClose }: Props) {
  const [state, setState] = useState<State>('input')
  const [file, setFile] = useState<File | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [nota, setNota] = useState<NotaData | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  async function handlePasteClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (text.startsWith('http')) setQrUrl(text.trim())
    } catch {
      // clipboard permission denied or not available
    }
  }

  async function handleAnalyze() {
    if (!file) return
    setState('processing')
    setError('')

    try {
      const imageBase64 = await comprimirFotoParaBase64(file)

      const resp = await fetch(`${API_URL}/notas/decode-foto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_TOKEN}` },
        body: JSON.stringify({ imageBase64, mediaType: 'image/jpeg' }),
      })

      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`)

      setNota(json as NotaData)
      setState('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('input')
    }
  }

  function handleReset() {
    setFile(null)
    setNota(null)
    setError('')
    setState('input')
    if (inputRef.current) inputRef.current.value = ''
  }

  const fmt = (n: number | null | undefined) =>
    n != null ? `R$ ${n.toFixed(2).replace('.', ',')}` : '—'

  // ── Estado 2: processing ──────────────────────────────────────────────────
  if (state === 'processing') {
    return (
      <div style={styles.container}>
        <p style={styles.hint}>Analisando com IA… aguarde alguns segundos</p>
      </div>
    )
  }

  // ── Estado 3: preview ─────────────────────────────────────────────────────
  if (state === 'preview' && nota) {
    return (
      <div style={styles.container}>
        <p style={styles.previewTitle}>Nota identificada</p>

        <div style={styles.card}>
          {nota.nome_loja && <p style={styles.storeName}>{nota.nome_loja}</p>}
          {nota.cnpj && <p style={styles.field}>CNPJ: {nota.cnpj}</p>}
          {nota.data_hora && <p style={styles.field}>Data: {nota.data_hora}</p>}
          {nota.chave_acesso && (
            <p style={styles.chave}>Chave: {nota.chave_acesso}</p>
          )}

          {nota.itens.length > 0 && (
            <>
              <p style={styles.sectionLabel}>Itens ({nota.itens.length})</p>
              <div style={styles.itemList}>
                {nota.itens.map((item, i) => (
                  <div key={i} style={styles.itemRow}>
                    <span style={styles.itemName}>{item.qtd}x {item.nome}</span>
                    <span style={styles.itemPrice}>{fmt(item.valor_total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {nota.total != null && (
            <p style={styles.totalRow}>Total: {fmt(nota.total)}</p>
          )}

          {qrUrl && (
            <p style={styles.qrOk}>URL do QR Code registrada</p>
          )}
        </div>

        <button
          style={{ ...styles.saveButton, opacity: qrUrl.trim() ? 1 : 0.4 }}
          disabled={!qrUrl.trim()}
          onClick={() => onScan(qrUrl.trim())}
        >
          Salvar nota
        </button>

        <button style={styles.retryButton} onClick={handleReset}>
          Nova foto
        </button>

        <button style={styles.cancelButton} onClick={onClose}>
          Cancelar
        </button>
      </div>
    )
  }

  // ── Estado 1: input ───────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <p style={styles.hint}>Fotografe a nota e cole a URL do QR Code</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <button style={styles.photoButton} onClick={() => inputRef.current?.click()}>
        {file ? `Foto: ${file.name}` : 'Fotografar nota'}
      </button>

      <div style={styles.urlRow}>
        <input
          type="url"
          style={styles.urlInput}
          placeholder="Cole aqui a URL do QR Code"
          value={qrUrl}
          onChange={e => setQrUrl(e.target.value)}
        />
        <button style={styles.pasteButton} onClick={handlePasteClipboard}>
          Colar
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <button
        style={{ ...styles.analyzeButton, opacity: file || qrUrl.trim() ? 1 : 0.4 }}
        disabled={!file && !qrUrl.trim()}
        onClick={file ? handleAnalyze : () => onScan(qrUrl.trim())}
      >
        {file ? 'Analisar nota' : 'Salvar nota'}
      </button>

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
  photoButton: {
    width: '100%',
    maxWidth: '400px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: '600',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  urlRow: {
    display: 'flex',
    width: '100%',
    maxWidth: '400px',
    gap: '8px',
  },
  urlInput: {
    flex: 1,
    padding: '12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    minWidth: 0,
  },
  pasteButton: {
    padding: '12px 14px',
    fontSize: '14px',
    fontWeight: '600',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  analyzeButton: {
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
  // Preview
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
  chave: {
    margin: 0,
    fontSize: '11px',
    color: '#9ca3af',
    wordBreak: 'break-all',
    fontFamily: 'monospace',
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

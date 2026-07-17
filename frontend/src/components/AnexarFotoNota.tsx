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
  notaId: number
  onSuccess: () => void
  onClose: () => void
}

type State = 'input' | 'processing' | 'preview' | 'saving'

export default function AnexarFotoNota({ notaId, onSuccess, onClose }: Props) {
  const [state, setState] = useState<State>('input')
  const [nota, setNota] = useState<NotaData | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const totalCalculado = nota
    ? Math.round(nota.itens.reduce((s, i) => s + i.valor_total, 0) * 100) / 100
    : 0

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
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

  function atualizarItem(i: number, campo: keyof NotaData['itens'][number], valor: string | number) {
    setNota(prev => {
      if (!prev) return prev
      const itens = prev.itens.map((item, idx) => {
        if (idx !== i) return item
        const atualizado = { ...item, [campo]: valor }
        if (campo === 'qtd' || campo === 'valor_unit') {
          atualizado.valor_total = Math.round(atualizado.qtd * atualizado.valor_unit * 100) / 100
        }
        return atualizado
      })
      return { ...prev, itens }
    })
  }

  function removerItem(i: number) {
    setNota(prev => (prev ? { ...prev, itens: prev.itens.filter((_, idx) => idx !== i) } : prev))
  }

  function adicionarItem() {
    setNota(prev =>
      prev
        ? { ...prev, itens: [...prev.itens, { nome: '', qtd: 1, valor_unit: 0, valor_total: 0, unidade: 'UN' }] }
        : prev
    )
  }

  async function handleConfirmar() {
    if (!nota) return
    setState('saving')
    setError('')

    try {
      const resp = await fetch(`${API_URL}/notas/${notaId}/processar-foto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_TOKEN}` },
        body: JSON.stringify({ ...nota, total: totalCalculado }),
      })

      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`)

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('preview')
    }
  }

  function handleReset() {
    setNota(null)
    setError('')
    setState('input')
    if (inputRef.current) inputRef.current.value = ''
  }

  const fmt = (n: number | null | undefined) =>
    n != null ? `R$ ${n.toFixed(2).replace('.', ',')}` : '—'

  if (state === 'processing') {
    return (
      <div style={styles.container}>
        <p style={styles.hint}>Analisando com IA… aguarde alguns segundos</p>
      </div>
    )
  }

  if ((state === 'preview' || state === 'saving') && nota) {
    const podeConfirmar = nota.itens.length > 0 && nota.itens.every(item => item.nome.trim() !== '')

    return (
      <div style={styles.container}>
        <p style={styles.previewTitle}>Nota identificada</p>

        <div style={styles.card}>
          {nota.nome_loja && <p style={styles.storeName}>{nota.nome_loja}</p>}
          {nota.cnpj && <p style={styles.field}>CNPJ: {nota.cnpj}</p>}
          {nota.data_hora && <p style={styles.field}>Data: {nota.data_hora}</p>}

          <p style={styles.sectionLabel}>Itens ({nota.itens.length})</p>
          <div style={styles.itemList}>
            {nota.itens.map((item, i) => (
              <div key={i} style={styles.itemCard}>
                <div style={styles.itemCardTopo}>
                  <div style={{ ...styles.campo, flex: 1 }}>
                    <label style={styles.label}>Item</label>
                    <input
                      style={styles.itemInput}
                      value={item.nome}
                      placeholder="Nome do item"
                      onChange={e => atualizarItem(i, 'nome', e.target.value)}
                      disabled={state === 'saving'}
                    />
                  </div>
                  <button
                    style={styles.btnRemover}
                    onClick={() => removerItem(i)}
                    disabled={state === 'saving'}
                    title="Remover item"
                  >
                    ×
                  </button>
                </div>
                <div style={styles.itemGrid}>
                  <div style={styles.campo}>
                    <label style={styles.label}>Qtd</label>
                    <input
                      style={styles.itemInput}
                      type="number"
                      value={item.qtd}
                      onChange={e => atualizarItem(i, 'qtd', Number(e.target.value))}
                      disabled={state === 'saving'}
                    />
                  </div>
                  <div style={styles.campo}>
                    <label style={styles.label}>Unidade</label>
                    <input
                      style={styles.itemInput}
                      value={item.unidade}
                      onChange={e => atualizarItem(i, 'unidade', e.target.value)}
                      disabled={state === 'saving'}
                    />
                  </div>
                  <div style={styles.campo}>
                    <label style={styles.label}>Valor unit.</label>
                    <input
                      style={styles.itemInput}
                      type="number"
                      step="0.01"
                      value={item.valor_unit}
                      onChange={e => atualizarItem(i, 'valor_unit', Number(e.target.value))}
                      disabled={state === 'saving'}
                    />
                  </div>
                  <div style={styles.campo}>
                    <label style={styles.label}>Valor total</label>
                    <input
                      style={styles.itemInput}
                      type="number"
                      step="0.01"
                      value={item.valor_total}
                      onChange={e => atualizarItem(i, 'valor_total', Number(e.target.value))}
                      disabled={state === 'saving'}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button style={styles.btnAdicionar} onClick={adicionarItem} disabled={state === 'saving'}>
            + Adicionar item
          </button>

          <p style={styles.totalRow}>Total: {fmt(totalCalculado)}</p>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button
          style={{ ...styles.saveButton, opacity: podeConfirmar && state !== 'saving' ? 1 : 0.6 }}
          disabled={!podeConfirmar || state === 'saving'}
          onClick={handleConfirmar}
        >
          {state === 'saving' ? 'Enviando...' : 'Confirmar e enviar para validação'}
        </button>

        <button style={styles.retryButton} onClick={handleReset} disabled={state === 'saving'}>
          Nova foto
        </button>

        <button style={styles.cancelButton} onClick={onClose} disabled={state === 'saving'}>
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <p style={styles.hint}>Fotografe a nota fiscal para extrair os itens</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <button style={styles.photoButton} onClick={() => inputRef.current?.click()}>
        Fotografar nota
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
  itemCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '8px',
  },
  itemCardTopo: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '6px',
  },
  itemGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  campo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  label: {
    fontSize: '11px',
    color: '#6b7280',
    fontWeight: '600',
  },
  itemInput: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '6px 8px',
    fontSize: '13px',
    color: '#374151',
  },
  btnRemover: {
    flexShrink: 0,
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    width: '28px',
    height: '28px',
    fontSize: '16px',
    lineHeight: '1',
    cursor: 'pointer',
  },
  btnAdicionar: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    color: '#2563eb',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '4px 0',
  },
  totalRow: {
    margin: '8px 0 0',
    fontSize: '15px',
    fontWeight: '700',
    color: '#111827',
    borderTop: '1px solid #e5e7eb',
    paddingTop: '8px',
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

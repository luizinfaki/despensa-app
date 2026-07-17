import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'
const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? ''

const chWidth = (v: string | number) => `${Math.max(2, String(v).length + 1)}ch`

function CampoInline({ value, editing, tipo = 'text', style, disabled, onStartEdit, onChange, onStopEdit }: {
  value: string | number
  editing: boolean
  tipo?: 'text' | 'number'
  style?: CSSProperties
  disabled?: boolean
  onStartEdit: () => void
  onChange: (v: string) => void
  onStopEdit: () => void
}) {
  if (editing && !disabled) {
    return (
      <input
        autoFocus
        type={tipo}
        step={tipo === 'number' ? '0.01' : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={e => e.target.select()}
        onBlur={onStopEdit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        style={{ font: 'inherit', color: 'inherit', border: 'none', background: 'transparent', outline: 'none', padding: 0, width: chWidth(value), ...style }}
      />
    )
  }
  return (
    <span onClick={disabled ? undefined : onStartEdit} style={{ ...(disabled ? {} : { cursor: 'pointer' }), ...style }}>
      {value}
    </span>
  )
}

type ItemBruto = {
  nome_bruto: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  unidade: string
  codigo_produto?: string
}

type ItemValidacao = ItemBruto & {
  tipo: string
  marca: string
  peso_volume: string
  unidade_mapeada: string
  tags: string[]
  ja_mapeado: boolean
  editando: boolean
  carregando: boolean
  avulso: boolean
}

type Nota = {
  id: number
  status: string
  valor_total_nota: number
  data_emissao: string | null
  itens_brutos: ItemBruto[] | null
  mercados: { nome_fantasia: string; descricao: string | null } | null
  nome_emitente: string | null
}

async function buscarMapeamento(nomeBruto: string): Promise<Partial<ItemValidacao> | null> {
  const { data } = await supabase
    .from('mapeamento_produtos')
    .select('unidade, produtos(marca, peso_volume, unidade, tipos_item(nome))')
    .eq('nome_bruto', nomeBruto)
    .maybeSingle()

  if (!data) return null
  const p = (data as any).produtos
  return {
    tipo: p?.tipos_item?.nome ?? '',
    marca: p?.marca ?? '',
    peso_volume: p?.peso_volume ?? '',
    unidade_mapeada: (data as any).unidade ?? p?.unidade ?? '',
    tags: [],
    ja_mapeado: true,
  }
}

async function classificarIA(nomeBruto: string): Promise<Partial<ItemValidacao>> {
  const res = await fetch(`${API_URL}/produtos/mapear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}` },
    body: JSON.stringify({ nome_bruto: nomeBruto }),
  })
  if (!res.ok) return { tipo: '', marca: '', peso_volume: '', unidade_mapeada: '', tags: [] }
  const d = await res.json()
  return { tipo: d.tipo ?? '', marca: d.marca ?? '', peso_volume: d.peso_volume ?? '', unidade_mapeada: d.unidade ?? '', tags: d.tags ?? [] }
}

export default function ValidacaoNotaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [nota, setNota] = useState<Nota | null>(null)
  const [itens, setItens] = useState<ItemValidacao[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [tiposDisponiveis, setTiposDisponiveis] = useState<string[]>([])
  const [dropdownIdx, setDropdownIdx] = useState<number | null>(null)
  const [hoveredTipo, setHoveredTipo] = useState<string | null>(null)
  const [campoAtivo, setCampoAtivo] = useState<{ i: number; campo: string } | null>(null)
  const emEdicao = (i: number, campo: string) => campoAtivo?.i === i && campoAtivo?.campo === campo

  useEffect(() => {
    supabase.from('tipos_item').select('nome').order('nome').then(({ data }) => {
      setTiposDisponiveis((data ?? []).map((t: any) => t.nome))
    })
  }, [])

  useEffect(() => {
    supabase
      .from('notas_fiscais')
      .select('id, status, valor_total_nota, data_emissao, itens_brutos, nome_emitente, mercados(nome_fantasia, descricao)')
      .eq('id', id!)
      .single()
      .then(async ({ data }) => {
        if (!data) return
        setNota(data as unknown as Nota)

        const brutos: ItemBruto[] = (data as any).itens_brutos ?? []
        const iniciais: ItemValidacao[] = brutos.map(b => ({
          ...b,
          tipo: '', marca: '', peso_volume: '', unidade_mapeada: b.unidade, tags: [],
          ja_mapeado: false, editando: false, carregando: true, avulso: false,
        }))
        setItens(iniciais)

        // Resolver mapeamentos em paralelo
        const resolvidos = await Promise.all(
          brutos.map(async (b, i) => {
            const cache = await buscarMapeamento(b.nome_bruto)
            if (cache) return { ...iniciais[i], ...cache, carregando: false }
            const ia = await classificarIA(b.nome_bruto)
            return { ...iniciais[i], ...ia, carregando: false }
          })
        )
        setItens(resolvidos)
      })
  }, [id])

  const CAMPOS_SYNC: (keyof ItemValidacao)[] = ['nome_bruto', 'tipo', 'marca', 'peso_volume', 'unidade_mapeada', 'tags', 'avulso']

  function atualizar(i: number, campo: keyof ItemValidacao, valor: string | string[] | boolean | number) {
    const nomeBruto = itens[i]?.nome_bruto
    if (CAMPOS_SYNC.includes(campo) && nomeBruto) {
      setItens(prev => prev.map(item =>
        item.nome_bruto === nomeBruto ? { ...item, [campo]: valor } : item
      ))
    } else {
      setItens(prev => prev.map((item, idx) => {
        if (idx !== i) return item
        const atualizado = { ...item, [campo]: valor }
        if (campo === 'quantidade' || campo === 'valor_unitario') {
          atualizado.valor_total = Math.round(atualizado.quantidade * atualizado.valor_unitario * 100) / 100
        }
        return atualizado
      }))
    }
  }

  async function confirmar() {
    if (!nota) return
    setEnviando(true)
    setErro('')

    const payload = {
      itens: itens.map(item => item.avulso
        ? {
            nome_bruto: item.nome_bruto,
            avulso: true,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            valor_total: item.valor_total,
          }
        : {
            nome_bruto: item.nome_bruto,
            tipo: item.tipo,
            marca: item.marca,
            peso_volume: item.peso_volume,
            unidade: item.unidade_mapeada || item.unidade,
            tags: item.tags,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            valor_total: item.valor_total,
          }
      )
    }

    const res = await fetch(`${API_URL}/notas/${nota.id}/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}` },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (data.ok) {
      navigate('/notas')
    } else {
      setErro(data.error ?? 'Erro ao confirmar')
      setEnviando(false)
    }
  }

  if (!nota) return <p style={styles.msg}>Carregando...</p>

  const mercado = nota.mercados?.descricao ?? nota.mercados?.nome_fantasia ?? nota.nome_emitente ?? '—'
  const data = nota.data_emissao ? new Date(nota.data_emissao).toLocaleDateString('pt-BR') : '—'
  const total = nota.valor_total_nota?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
  const todosOk = itens.every(i => !i.carregando && (i.avulso || i.tipo.trim()) && i.nome_bruto.trim())

  return (
    <div style={styles.container}>
      <div style={styles.cabecalho}>
        <div>
          <strong style={styles.mercadoNome}>{mercado}</strong>
          <span style={styles.meta}>{data} · {total}</span>
        </div>
        <span style={styles.badge}>{itens.length} itens</span>
      </div>

      <div style={styles.lista}>
        {itens.map((item, i) => (
          <div key={i} style={item.avulso ? { ...styles.card, ...styles.cardAvulso } : styles.card}>
            <div style={styles.cardTopo}>
              <CampoInline
                value={item.nome_bruto}
                editing={emEdicao(i, 'nome_bruto')}
                style={styles.nomeBruto}
                disabled={!item.editando}
                onStartEdit={() => setCampoAtivo({ i, campo: 'nome_bruto' })}
                onChange={v => atualizar(i, 'nome_bruto', v)}
                onStopEdit={() => setCampoAtivo(null)}
              />
              <button
                style={item.avulso ? { ...styles.iconAvulso, ...styles.iconAvulsoAtivo } : styles.iconAvulso}
                onClick={() => atualizar(i, 'avulso', !item.avulso)}
                title={item.avulso ? 'Desfazer avulso' : 'Marcar como avulso'}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                  {item.avulso && <line x1="3" y1="3" x2="21" y2="21"/>}
                </svg>
              </button>
            </div>

            <div style={styles.linhaValores}>
              <CampoInline
                value={item.quantidade}
                editing={emEdicao(i, 'quantidade')}
                tipo="number"
                disabled={!item.editando}
                onStartEdit={() => setCampoAtivo({ i, campo: 'quantidade' })}
                onChange={v => atualizar(i, 'quantidade', Number(v))}
                onStopEdit={() => setCampoAtivo(null)}
              />
              {' '}
              <CampoInline
                value={item.unidade}
                editing={emEdicao(i, 'unidade')}
                disabled={!item.editando}
                onStartEdit={() => setCampoAtivo({ i, campo: 'unidade' })}
                onChange={v => atualizar(i, 'unidade', v)}
                onStopEdit={() => setCampoAtivo(null)}
              />
              {' · R$ '}
              <CampoInline
                value={item.valor_unitario}
                editing={emEdicao(i, 'valor_unitario')}
                tipo="number"
                disabled={!item.editando}
                onStartEdit={() => setCampoAtivo({ i, campo: 'valor_unitario' })}
                onChange={v => atualizar(i, 'valor_unitario', Number(v))}
                onStopEdit={() => setCampoAtivo(null)}
              />
              {'/un · R$ '}
              <CampoInline
                value={item.valor_total}
                editing={emEdicao(i, 'valor_total')}
                tipo="number"
                style={styles.destaque}
                disabled={!item.editando}
                onStartEdit={() => setCampoAtivo({ i, campo: 'valor_total' })}
                onChange={v => atualizar(i, 'valor_total', Number(v))}
                onStopEdit={() => setCampoAtivo(null)}
              />
            </div>

            {!item.avulso && item.carregando ? (
              <span style={styles.classificando}>Classificando...</span>
            ) : !item.editando ? (
              <div style={styles.mapeamentoRow} onClick={() => atualizar(i, 'editando', true)}>
                {item.avulso ? (
                  <span style={styles.editar}>editar</span>
                ) : (
                  <>
                    {item.ja_mapeado
                      ? <span style={styles.checkmark}>✓</span>
                      : <span style={styles.iaIcon}>IA</span>
                    }
                    <span style={styles.mapeamentoTexto}>
                      {item.tipo}{item.marca ? ` · ${item.marca}` : ''}{item.peso_volume ? ` · ${item.peso_volume}` : ''}
                    </span>
                    <span style={styles.editar}>editar</span>
                  </>
                )}
              </div>
            ) : (
              <div style={styles.form}>
                {!item.avulso && (
                  <>
                    <label style={styles.label}>Tipo *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        style={styles.input}
                        value={item.tipo}
                        onChange={e => atualizar(i, 'tipo', e.target.value)}
                        onFocus={() => setDropdownIdx(i)}
                        onBlur={() => setTimeout(() => setDropdownIdx(null), 150)}
                        placeholder="ex: Café Moído"
                      />
                      {dropdownIdx === i && (() => {
                        const filtrados = tiposDisponiveis.filter(t =>
                          t.toLowerCase().includes(item.tipo.toLowerCase().trim()) && t !== item.tipo
                        )
                        return filtrados.length > 0 ? (
                          <div style={styles.dropdown}>
                            {filtrados.map(t => (
                              <div
                                key={t}
                                style={{ ...styles.dropdownItem, background: hoveredTipo === t ? '#f3f4f6' : '#fff' }}
                                onMouseDown={() => { atualizar(i, 'tipo', t); setDropdownIdx(null) }}
                                onMouseEnter={() => setHoveredTipo(t)}
                                onMouseLeave={() => setHoveredTipo(null)}
                              >
                                {t}
                              </div>
                            ))}
                          </div>
                        ) : null
                      })()}
                    </div>
                    <label style={styles.label}>Marca</label>
                    <input style={styles.input} value={item.marca} onChange={e => atualizar(i, 'marca', e.target.value)} placeholder="ex: Pilão" />
                    <label style={styles.label}>Peso/Volume</label>
                    <input style={styles.input} value={item.peso_volume} onChange={e => atualizar(i, 'peso_volume', e.target.value)} placeholder="ex: 500g" />
                    <label style={styles.label}>Tags (separadas por vírgula)</label>
                    <input
                      style={styles.input}
                      value={item.tags.join(', ')}
                      onChange={e => atualizar(i, 'tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean) as any)}
                      placeholder="ex: Alimentação, Matinal"
                    />
                  </>
                )}
                <button style={styles.btnOk} onClick={() => atualizar(i, 'editando', false)}>OK</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {erro && <p style={styles.erro}>{erro}</p>}

      <button
        style={{ ...styles.btnConfirmar, opacity: todosOk && !enviando ? 1 : 0.5 }}
        disabled={!todosOk || enviando}
        onClick={confirmar}
      >
        {enviando ? 'Confirmando...' : 'Confirmar compra'}
      </button>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: { padding: '16px', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '32px' },
  msg: { textAlign: 'center', color: '#6b7280', marginTop: '40px' },
  cabecalho: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0' },
  mercadoNome: { display: 'block', fontSize: '17px', color: '#111827' },
  meta: { fontSize: '13px', color: '#6b7280' },
  badge: { background: '#f3f4f6', color: '#374151', fontSize: '12px', fontWeight: '600', padding: '4px 10px', borderRadius: '99px' },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  cardTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' },
  nomeBruto: { fontSize: '13px', fontWeight: '600', color: '#111827', flex: 1 },
  linhaValores: { fontSize: '12px', color: '#6b7280' },
  destaque: { color: '#374151', fontWeight: '600' },
  classificando: { fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' },
  mapeamentoRow: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
  checkmark: { color: '#16a34a', fontSize: '14px', fontWeight: '700' },
  iaIcon: { background: '#ede9fe', color: '#7c3aed', fontSize: '10px', fontWeight: '700', padding: '2px 5px', borderRadius: '4px' },
  mapeamentoTexto: { fontSize: '13px', color: '#374151', flex: 1 },
  editar: { fontSize: '11px', color: '#9ca3af' },
  form: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '11px', color: '#6b7280', fontWeight: '600' },
  input: { padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' },
  btnOk: { alignSelf: 'flex-end', background: '#16a34a', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  btnConfirmar: { background: '#16a34a', color: '#fff', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', width: '100%' },
  erro: { color: '#dc2626', fontSize: '14px', textAlign: 'center' },
  cardAvulso: { background: '#fffbeb', border: '1px solid #fcd34d' },
  iconAvulso: { background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#d1d5db', display: 'flex', alignItems: 'center', borderRadius: '4px' },
  iconAvulsoAtivo: { color: '#d97706' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 100, maxHeight: '180px', overflowY: 'auto', marginTop: '2px' },
  dropdownItem: { padding: '8px 12px', fontSize: '14px', color: '#374151', cursor: 'pointer' },
}

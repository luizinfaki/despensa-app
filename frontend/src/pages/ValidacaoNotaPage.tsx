import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'
const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? ''

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
          ja_mapeado: false, editando: false, carregando: true,
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

  function atualizar(i: number, campo: keyof ItemValidacao, valor: string | string[] | boolean) {
    setItens(prev => prev.map((item, idx) => idx === i ? { ...item, [campo]: valor } : item))
  }

  async function confirmar() {
    if (!nota) return
    setEnviando(true)
    setErro('')

    const payload = {
      itens: itens.map(item => ({
        nome_bruto: item.nome_bruto,
        tipo: item.tipo,
        marca: item.marca,
        peso_volume: item.peso_volume,
        unidade: item.unidade_mapeada || item.unidade,
        tags: item.tags,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
      }))
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
  const todosOk = itens.every(i => !i.carregando && i.tipo.trim())

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
          <div key={item.nome_bruto + i} style={styles.card}>
            <div style={styles.cardTopo}>
              <span style={styles.nomeBruto}>{item.nome_bruto}</span>
              <span style={styles.qtdValor}>
                {item.quantidade} {item.unidade} · {item.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>

            {item.carregando ? (
              <span style={styles.classificando}>Classificando...</span>
            ) : !item.editando ? (
              <div style={styles.mapeamentoRow} onClick={() => atualizar(i, 'editando', true)}>
                {item.ja_mapeado
                  ? <span style={styles.checkmark}>✓</span>
                  : <span style={styles.iaIcon}>IA</span>
                }
                <span style={styles.mapeamentoTexto}>
                  {item.tipo}{item.marca ? ` · ${item.marca}` : ''}{item.peso_volume ? ` · ${item.peso_volume}` : ''}
                </span>
                <span style={styles.editar}>editar</span>
              </div>
            ) : (
              <div style={styles.form}>
                <label style={styles.label}>Tipo *</label>
                <input style={styles.input} value={item.tipo} onChange={e => atualizar(i, 'tipo', e.target.value)} placeholder="ex: Café Moído" />
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
  qtdValor: { fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' },
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
}

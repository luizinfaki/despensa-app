import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../lib/supabase'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

type Compra = {
  id: number
  data_compra: string
  valor_total_nota: number | null
  valor_total_calculado: number | null
  mercados: { nome_fantasia: string; descricao: string | null } | null
}

type ItemDetalhe = {
  quantidade: number
  valor_unitario: number
  valor_total_item: number
  mapeamento_produtos: {
    nome_bruto: string
    produtos: {
      marca: string | null
      peso_volume: string | null
      tipos_item: { nome: string } | null
    } | null
  } | null
}

type GrupoCategoria = {
  nome: string
  subtotal: number
  itens: { descricao: string; quantidade: number; valor_unitario: number; valor_total: number }[]
}

function nomeMercado(c: Compra): string {
  if (c.mercados?.descricao) return c.mercados.descricao
  if (c.mercados?.nome_fantasia) return c.mercados.nome_fantasia
  return '—'
}

function formatValor(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatData(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}

function intervaloDeMes(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10)
  return { start, end }
}

function agruparPorCategoria(itens: ItemDetalhe[]): GrupoCategoria[] {
  const map: Record<string, GrupoCategoria> = {}
  for (const item of itens) {
    const categoria = item.mapeamento_produtos?.produtos?.tipos_item?.nome ?? '(sem categoria)'
    const p = item.mapeamento_produtos?.produtos
    const partes = [p?.marca, p?.peso_volume].filter(Boolean)
    const descricao = partes.length > 0
      ? `${item.mapeamento_produtos?.nome_bruto} (${partes.join(' ')})`
      : item.mapeamento_produtos?.nome_bruto ?? '—'

    if (!map[categoria]) {
      map[categoria] = { nome: categoria, subtotal: 0, itens: [] }
    }
    map[categoria].subtotal += item.valor_total_item ?? 0
    map[categoria].itens.push({
      descricao,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.valor_total_item,
    })
  }
  return Object.values(map).sort((a, b) => b.subtotal - a.subtotal)
}

export default function ComprasPage() {
  const now = new Date()
  const [mes, setMes] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [detalheId, setDetalheId] = useState<number | null>(null)
  const [detalhes, setDetalhes] = useState<Record<number, GrupoCategoria[]>>({})
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)

  useEffect(() => {
    setLoading(true)
    setDetalheId(null)
    const { start, end } = intervaloDeMes(mes.year, mes.month)
    supabase
      .from('compras')
      .select('id, data_compra, valor_total_nota, valor_total_calculado, mercados(nome_fantasia, descricao)')
      .gte('data_compra', start)
      .lte('data_compra', end)
      .order('data_compra', { ascending: false })
      .then(({ data }) => {
        setCompras((data as unknown as Compra[]) ?? [])
        setLoading(false)
      })
  }, [mes])

  async function toggleDetalhe(id: number) {
    if (detalheId === id) {
      setDetalheId(null)
      return
    }
    setDetalheId(id)
    if (detalhes[id]) return

    setLoadingDetalhe(true)
    const { data } = await supabase
      .from('itens_comprados')
      .select('quantidade, valor_unitario, valor_total_item, mapeamento_produtos(nome_bruto, produtos(marca, peso_volume, tipos_item(nome)))')
      .eq('compra_id', id)

    const grupos = agruparPorCategoria((data as unknown as ItemDetalhe[]) ?? [])
    setDetalhes(prev => ({ ...prev, [id]: grupos }))
    setLoadingDetalhe(false)
  }

  function irMes(delta: number) {
    setMes(prev => {
      let m = prev.month + delta
      let y = prev.year
      if (m < 0) { m = 11; y-- }
      if (m > 11) { m = 0; y++ }
      return { year: y, month: m }
    })
  }

  const totalMes = compras.reduce((s, c) => s + (c.valor_total_calculado ?? 0), 0)

  return (
    <div style={styles.container}>
      <div style={styles.mesNav}>
        <button style={styles.mesBtn} onClick={() => irMes(-1)}>‹</button>
        <span style={styles.mesNome}>{MESES[mes.month]} {mes.year}</span>
        <button style={styles.mesBtn} onClick={() => irMes(1)}>›</button>
      </div>

      <div style={styles.totalCard}>
        <span style={styles.totalLabel}>Total do mês</span>
        <span style={styles.totalValor}>{formatValor(totalMes)}</span>
      </div>

      {loading && <p style={styles.msg}>Carregando...</p>}

      {!loading && compras.length === 0 && (
        <p style={styles.msg}>Nenhuma compra em {MESES[mes.month]}.</p>
      )}

      {compras.map(compra => (
        <div key={compra.id} style={styles.card} onClick={() => toggleDetalhe(compra.id)}>
          <div style={styles.cardTopo}>
            <span style={styles.mercado}>{nomeMercado(compra)}</span>
            <span style={styles.valor}>{formatValor(compra.valor_total_calculado ?? compra.valor_total_nota)}</span>
          </div>
          <span style={styles.data}>{formatData(compra.data_compra)}</span>

          {detalheId === compra.id && (
            <div style={styles.detalhe}>
              {loadingDetalhe && !detalhes[compra.id] ? (
                <p style={styles.detalheMsg}>Carregando itens...</p>
              ) : (detalhes[compra.id] ?? []).map(grupo => (
                <div key={grupo.nome} style={styles.grupo}>
                  <div style={styles.grupoHeader}>
                    <span style={styles.grupoNome}>{grupo.nome}</span>
                    <span style={styles.grupoSubtotal}>{formatValor(grupo.subtotal)}</span>
                  </div>
                  {grupo.itens.map((item, i) => (
                    <div key={i} style={styles.itemLinha}>
                      <span style={styles.itemDesc}>{item.descricao}</span>
                      <span style={styles.itemQtd}>
                        {item.quantidade} × {formatValor(item.valor_unitario)}
                      </span>
                      <span style={styles.itemTotal}>{formatValor(item.valor_total)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: {
    padding: '20px',
    maxWidth: '640px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingBottom: '32px',
  },
  mesNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  },
  mesBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#374151',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  },
  mesNome: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#111827',
    minWidth: '160px',
    textAlign: 'center',
  },
  totalCard: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: '13px',
    color: '#166534',
    fontWeight: '500',
  },
  totalValor: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#15803d',
  },
  msg: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: '20px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  cardTopo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mercado: {
    fontWeight: '600',
    fontSize: '15px',
    color: '#111827',
  },
  valor: {
    fontWeight: '600',
    fontSize: '15px',
    color: '#111827',
  },
  data: {
    fontSize: '13px',
    color: '#6b7280',
  },
  detalhe: {
    marginTop: '8px',
    borderTop: '1px solid #f3f4f6',
    paddingTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  detalheMsg: {
    fontSize: '13px',
    color: '#9ca3af',
    textAlign: 'center',
  },
  grupo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  grupoHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2px',
  },
  grupoNome: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  grupoSubtotal: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#374151',
  },
  itemLinha: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    paddingLeft: '8px',
  },
  itemDesc: {
    fontSize: '13px',
    color: '#6b7280',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemQtd: {
    fontSize: '12px',
    color: '#9ca3af',
    whiteSpace: 'nowrap',
  },
  itemTotal: {
    fontSize: '13px',
    color: '#374151',
    whiteSpace: 'nowrap',
    minWidth: '64px',
    textAlign: 'right',
  },
}

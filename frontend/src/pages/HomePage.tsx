import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import QrScannerPhoto from '../components/QrScannerPhoto'

type ScanResult = { ok: boolean; message: string } | null

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function HomePage() {
  const navigate = useNavigate()
  const now = new Date()
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult>(null)
  const [mes, setMes] = useState({ year: now.getFullYear(), month: now.getMonth() })

  const [gastoMes, setGastoMes] = useState<number | null>(null)
  const [pendentes, setPendentes] = useState(0)
  const [top3, setTop3] = useState<{ nome: string; valor: number }[]>([])

  function irMes(delta: number) {
    setMes(prev => {
      let m = prev.month + delta
      let y = prev.year
      if (m < 0) { m = 11; y-- }
      if (m > 11) { m = 0; y++ }
      return { year: y, month: m }
    })
  }

  useEffect(() => {
    const start = `${mes.year}-${String(mes.month + 1).padStart(2, '0')}-01`
    const end = new Date(mes.year, mes.month + 1, 0).toISOString().slice(0, 10)

    async function carregar() {
      const [{ data: compras }, { count }] = await Promise.all([
        supabase
          .from('compras')
          .select('id, valor_total_calculado')
          .gte('data_compra', start)
          .lte('data_compra', end),
        supabase
          .from('notas_fiscais')
          .select('id', { count: 'exact', head: true })
          .in('status', ['PENDENTE', 'AGUARDANDO_VALIDACAO']),
      ])

      const gasto = (compras ?? []).reduce((s, c) => s + (c.valor_total_calculado ?? 0), 0)
      setGastoMes(gasto)
      setTop3([])
      setPendentes(count ?? 0)

      const ids = (compras ?? []).map(c => c.id)
      if (ids.length > 0) {
        const { data: itens } = await supabase
          .from('itens_comprados')
          .select('valor_total_item, mapeamento_produtos(produtos(tipos_item(nome)))')
          .in('compra_id', ids)

        const map: Record<string, number> = {}
        for (const item of itens ?? []) {
          const nome = (item as any).mapeamento_produtos?.produtos?.tipos_item?.nome ?? '(sem categoria)'
          map[nome] = (map[nome] ?? 0) + (item.valor_total_item ?? 0)
        }
        const ranking = Object.entries(map)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([nome, valor]) => ({ nome, valor }))
        setTop3(ranking)
      }
    }

    carregar()
  }, [mes])

  function extrairChave(url: string): string | null {
    try {
      const p = new URL(url).searchParams.get('p')
      const chave = p?.split('|')[0] ?? null
      return chave?.length === 44 ? chave : null
    } catch {
      return null
    }
  }

  async function handleScan(url: string) {
    setScanning(false)
    const { data } = await supabase.auth.getUser()
    if (!data.user) return

    const chave_acesso = extrairChave(url)

    const { error } = await supabase
      .from('notas_fiscais')
      .insert({ url_sefaz: url, chave_acesso, user_id: data.user.id, status: 'PENDENTE' })

    if (!error) {
      setResult({ ok: true, message: 'Nota salva com sucesso!' })
    } else if (error.code === '23505') {
      setResult({ ok: false, message: 'Essa nota já foi escaneada.' })
    } else {
      setResult({ ok: false, message: `Erro ao salvar: ${error.message}` })
    }
  }

  if (scanning) {
    return <QrScannerPhoto onScan={handleScan} onClose={() => setScanning(false)} />
  }

  const gastoFormatado = gastoMes == null
    ? '—'
    : gastoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div style={styles.container}>
      <div style={styles.mesNav}>
        <button style={styles.mesBtn} onClick={() => irMes(-1)}>‹</button>
        <span style={styles.mesNome}>{MESES[mes.month]} {mes.year}</span>
        <button style={styles.mesBtn} onClick={() => irMes(1)}>›</button>
      </div>

      <div style={styles.gastoCard}>
        <span style={styles.gastoLabel}>Gasto em {MESES[mes.month]}</span>
        <span style={styles.gastoValor}>{gastoFormatado}</span>
      </div>

      {pendentes > 0 && (
        <button style={styles.pendentesCard} onClick={() => navigate('/notas')}>
          <span style={styles.pendentesTexto}>
            {pendentes} nota{pendentes > 1 ? 's' : ''} aguardando
          </span>
          <span style={styles.pendentesArrow}>→</span>
        </button>
      )}

      {result && (
        <p style={{ ...styles.feedback, color: result.ok ? '#16a34a' : '#dc2626' }}>
          {result.message}
        </p>
      )}

      <button
        style={styles.primaryButton}
        onClick={() => { setResult(null); setScanning(true) }}
      >
        Registrar nota
      </button>

      {top3.length > 0 && (
        <div style={styles.top3Container}>
          <span style={styles.top3Titulo}>Top categorias do mês</span>
          {top3.map(({ nome, valor }) => (
            <div key={nome} style={styles.top3Linha}>
              <span style={styles.top3Nome}>{nome}</span>
              <span style={styles.top3Valor}>
                {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          ))}
        </div>
      )}

      <p style={styles.version}>build {__APP_VERSION__}</p>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    padding: '24px',
    gap: '16px',
  },
  mesNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    width: '100%',
    maxWidth: '360px',
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
    textAlign: 'center' as const,
  },
  gastoCard: {
    width: '100%',
    maxWidth: '360px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  gastoLabel: {
    fontSize: '13px',
    color: '#166534',
    fontWeight: '500',
  },
  gastoValor: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#15803d',
  },
  pendentesCard: {
    width: '100%',
    maxWidth: '360px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '12px',
    padding: '14px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  pendentesTexto: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#92400e',
  },
  pendentesArrow: {
    fontSize: '16px',
    color: '#92400e',
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
  top3Container: {
    width: '100%',
    maxWidth: '360px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  top3Titulo: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  top3Linha: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: '#f9fafb',
    borderRadius: '8px',
  },
  top3Nome: {
    fontSize: '14px',
    color: '#374151',
  },
  top3Valor: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  version: {
    margin: 0,
    marginTop: 'auto',
    paddingTop: '24px',
    fontSize: '11px',
    color: '#d1d5db',
  },
}

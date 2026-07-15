import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AnexarFotoNota from '../components/AnexarFotoNota'

type Nota = {
  id: number
  status: string
  data_escaneamento: string
  data_emissao: string | null
  valor_total_nota: number | null
  nome_emitente: string | null
  cnpj_emitente: string | null
  url_sefaz: string | null
  chave_acesso: string | null
  mercados: { nome_fantasia: string; descricao: string | null } | null
}

function nomeMercado(nota: Nota): string {
  if (nota.mercados?.descricao) return nota.mercados.descricao
  if (nota.mercados?.nome_fantasia) return nota.mercados.nome_fantasia
  if (nota.nome_emitente) return nota.nome_emitente
  return nota.cnpj_emitente ?? '—'
}

function formatData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatValor(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function FilaNotasPage() {
  const [notas, setNotas] = useState<Nota[]>([])
  const [loading, setLoading] = useState(true)
  const [notaFotoId, setNotaFotoId] = useState<number | null>(null)
  const navigate = useNavigate()

  function fetchNotas() {
    supabase
      .from('notas_fiscais')
      .select('id, status, data_escaneamento, data_emissao, valor_total_nota, nome_emitente, cnpj_emitente, url_sefaz, chave_acesso, mercados(nome_fantasia, descricao)')
      .in('status', ['PENDENTE', 'AGUARDANDO_VALIDACAO'])
      .order('data_escaneamento', { ascending: false })
      .then(({ data }) => {
        setNotas((data as unknown as Nota[]) ?? [])
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchNotas()

    const intervalId = setInterval(fetchNotas, 15000)

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') fetchNotas()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  if (notaFotoId != null) {
    return (
      <AnexarFotoNota
        notaId={notaFotoId}
        onSuccess={() => { setNotaFotoId(null); fetchNotas() }}
        onClose={() => setNotaFotoId(null)}
      />
    )
  }

  if (loading) return <p style={styles.empty}>Carregando...</p>

  return (
    <div style={styles.container}>
      <h2 style={styles.titulo}>Notas pendentes</h2>

      {notas.length === 0 && (
        <p style={styles.empty}>Nenhuma nota pendente.</p>
      )}

      {notas.map(nota => {
        const aguardando = nota.status === 'AGUARDANDO_VALIDACAO'
        return (
          <div
            key={nota.id}
            style={{ ...styles.card, ...(aguardando ? styles.cardClicavel : styles.cardPendente) }}
            onClick={() => aguardando && navigate(`/notas/${nota.id}`)}
          >
            <div style={styles.cardTopo}>
              <span style={styles.mercado}>{nomeMercado(nota)}</span>
              <span style={{ ...styles.badge, ...(aguardando ? styles.badgeAguardando : styles.badgePendente) }}>
                {aguardando ? 'Aguardando' : 'Pendente'}
              </span>
            </div>
            <div style={styles.cardInfo}>
              <span>{formatData(nota.data_emissao ?? nota.data_escaneamento)}</span>
              <span style={styles.valor}>{formatValor(nota.valor_total_nota)}</span>
            </div>
            {nota.chave_acesso && (
              <span style={styles.chave}>Chave: {nota.chave_acesso}</span>
            )}
            {aguardando && <span style={styles.hint}>Toque para validar →</span>}
            {!aguardando && (
              <div style={styles.acoesPendente}>
                {nota.url_sefaz && (
                  <a
                    href={nota.url_sefaz}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.urlLink}
                    onClick={e => e.stopPropagation()}
                  >
                    Abrir nota na SEFAZ →
                  </a>
                )}
                <button
                  style={styles.btnAnexarFoto}
                  onClick={e => { e.stopPropagation(); setNotaFotoId(nota.id) }}
                >
                  Anexar foto
                </button>
              </div>
            )}
          </div>
        )
      })}
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
  },
  titulo: {
    margin: '0 0 4px 0',
    fontSize: '1.25rem',
    color: '#111827',
  },
  empty: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: '40px',
  },
  card: {
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardClicavel: {
    background: '#fff',
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  cardPendente: {
    background: '#f9fafb',
    opacity: 0.7,
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
  badge: {
    fontSize: '12px',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '99px',
  },
  badgeAguardando: {
    background: '#fef3c7',
    color: '#92400e',
  },
  badgePendente: {
    background: '#f3f4f6',
    color: '#6b7280',
  },
  cardInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    color: '#6b7280',
  },
  valor: {
    fontWeight: '600',
    color: '#111827',
  },
  hint: {
    fontSize: '12px',
    color: '#16a34a',
  },
  chave: {
    fontSize: '11px',
    color: '#9ca3af',
    wordBreak: 'break-all',
  },
  urlLink: {
    fontSize: '12px',
    color: '#2563eb',
    textDecoration: 'none',
    alignSelf: 'flex-start',
  },
  acoesPendente: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  btnAnexarFoto: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#2563eb',
    background: 'none',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    padding: '4px 10px',
    cursor: 'pointer',
  },
}

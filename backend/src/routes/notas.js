import { getSupabase } from '../plugins/supabase.js'

function parseDataEmissao(str) {
  // "18/06/2026 19:04:40" → ISO string
  if (!str) return null
  const [datePart, timePart] = str.trim().split(' ')
  if (!datePart) return null
  const [day, month, year] = datePart.split('/')
  return new Date(`${year}-${month}-${day}T${timePart || '00:00:00'}`).toISOString()
}

export default async function notasRoutes(fastify) {
  fastify.post('/notas/processar-scrape', async (req, reply) => {
    // Auth
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${process.env.API_TOKEN}`) {
      return reply.code(401).send({ error: 'Token inválido' })
    }

    const {
      url_sefaz, cnpj_emitente, nome_emitente, chave_acesso,
      numero_nf, data_emissao, valor_total_nota, itens
    } = req.body

    if (!chave_acesso || !itens?.length) {
      return reply.code(400).send({ error: 'chave_acesso e itens são obrigatórios' })
    }

    const supabase = getSupabase()

    // 1. Buscar nota pela chave_acesso
    const { data: nota, error: errNota } = await supabase
      .from('notas_fiscais')
      .select('id, user_id, status')
      .eq('chave_acesso', chave_acesso)
      .single()

    if (errNota || !nota) {
      return reply.code(404).send({ error: 'Nota não encontrada. Escaneie o QR code pelo app primeiro.' })
    }

    if (nota.status !== 'PENDENTE') {
      return reply.code(409).send({ error: `Nota já processada (status: ${nota.status})` })
    }

    // 2. Upsert mercado
    let mercado_id = null
    if (cnpj_emitente && nome_emitente) {
      const { data: mercado, error: errMercado } = await supabase
        .from('mercados')
        .upsert(
          { user_id: nota.user_id, cnpj: cnpj_emitente, nome_fantasia: nome_emitente },
          { onConflict: 'user_id,cnpj', ignoreDuplicates: false }
        )
        .select('id')
        .single()

      if (errMercado) {
        return reply.code(500).send({ error: `Erro ao salvar mercado: ${errMercado.message}` })
      }
      mercado_id = mercado.id
    }

    // 3. Atualizar nota
    const { error: errUpdate } = await supabase
      .from('notas_fiscais')
      .update({
        numero_nf,
        chave_acesso,
        nome_emitente,
        cnpj_emitente,
        valor_total_nota,
        data_emissao: parseDataEmissao(data_emissao),
        itens_brutos: itens,
        mercado_id,
        status: 'AGUARDANDO_VALIDACAO',
      })
      .eq('id', nota.id)

    if (errUpdate) {
      return reply.code(500).send({ error: `Erro ao atualizar nota: ${errUpdate.message}` })
    }

    return { ok: true, id_nota: nota.id }
  })
}

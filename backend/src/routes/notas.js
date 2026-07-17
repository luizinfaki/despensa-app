import { getSupabase } from '../plugins/supabase.js'
import { getAnthropic } from '../plugins/anthropic.js'

const PROMPT_DECODE_FOTO = `Analise esta nota fiscal de consumidor eletrônica (NFC-e) brasileira.
Extraia todas as informações visíveis e retorne SOMENTE o JSON abaixo, sem texto adicional:

{
  "cnpj": "CNPJ no formato XX.XXX.XXX/XXXX-XX ou null",
  "nome_loja": "nome do estabelecimento ou null",
  "chave_acesso": "44 dígitos no formato 'XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX' ou null",
  "itens": [{"nome": "string", "qtd": 1, "valor_unit": 0.00, "valor_total": 0.00, "unidade": "UN se vendido por unidade/embalagem, KG se vendido por peso"}],
  "total": 0.00,
  "data_hora": "DD/MM/YYYY HH:MM ou null"
}

A chave de acesso tem 44 dígitos divididos em grupos de 4, impressa próximo ao QR code ou código de barras.
Retorne APENAS o JSON, sem explicações adicionais, em uma única linha e sem espaços/indentação desnecessários.`

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

  fastify.post('/notas/:id/processar-foto', async (req, reply) => {
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${process.env.API_TOKEN}`) {
      return reply.code(401).send({ error: 'Token inválido' })
    }

    const notaId = Number(req.params.id)
    const { cnpj, nome_loja, itens, total, data_hora } = req.body

    if (!itens?.length) {
      return reply.code(400).send({ error: 'itens é obrigatório' })
    }

    const supabase = getSupabase()

    const { data: nota, error: errNota } = await supabase
      .from('notas_fiscais')
      .select('id, user_id, status')
      .eq('id', notaId)
      .single()

    if (errNota || !nota) {
      return reply.code(404).send({ error: 'Nota não encontrada' })
    }

    if (nota.status !== 'PENDENTE') {
      return reply.code(409).send({ error: `Nota já processada (status: ${nota.status})` })
    }

    let mercado_id = null
    if (cnpj && nome_loja) {
      const { data: mercado, error: errMercado } = await supabase
        .from('mercados')
        .upsert(
          { user_id: nota.user_id, cnpj, nome_fantasia: nome_loja },
          { onConflict: 'user_id,cnpj', ignoreDuplicates: false }
        )
        .select('id')
        .single()

      if (errMercado) {
        return reply.code(500).send({ error: `Erro ao salvar mercado: ${errMercado.message}` })
      }
      mercado_id = mercado.id
    }

    const itensBrutos = itens.map(item => ({
      nome_bruto: item.nome,
      quantidade: item.qtd,
      valor_unitario: item.valor_unit,
      valor_total: item.valor_total,
      unidade: item.unidade,
    }))

    const { error: errUpdate } = await supabase
      .from('notas_fiscais')
      .update({
        nome_emitente: nome_loja,
        cnpj_emitente: cnpj,
        valor_total_nota: total,
        data_emissao: parseDataEmissao(data_hora),
        itens_brutos: itensBrutos,
        mercado_id,
        status: 'AGUARDANDO_VALIDACAO',
      })
      .eq('id', nota.id)

    if (errUpdate) {
      return reply.code(500).send({ error: `Erro ao atualizar nota: ${errUpdate.message}` })
    }

    return { ok: true, id_nota: nota.id }
  })

  fastify.post('/notas/decode-foto', { bodyLimit: 10 * 1024 * 1024 }, async (req, reply) => {
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${process.env.API_TOKEN}`) {
      return reply.code(401).send({ error: 'Token inválido' })
    }

    const { imageBase64, mediaType = 'image/jpeg' } = req.body ?? {}
    if (!imageBase64) {
      return reply.code(400).send({ error: 'imageBase64 é obrigatório' })
    }

    const anthropic = getAnthropic()
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: PROMPT_DECODE_FOTO },
          ],
        },
      ],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return reply.code(422).send({ error: 'Não foi possível extrair dados da imagem' })
    }

    try {
      return JSON.parse(match[0])
    } catch {
      return reply.code(422).send({ error: 'Não foi possível interpretar a nota — tente novamente ou tire uma foto com menos itens visíveis por vez' })
    }
  })

  fastify.post('/notas/:id/confirmar', async (req, reply) => {
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${process.env.API_TOKEN}`) {
      return reply.code(401).send({ error: 'Token inválido' })
    }

    const notaId = Number(req.params.id)
    const { itens } = req.body
    if (!itens?.length) return reply.code(400).send({ error: 'itens é obrigatório' })

    const supabase = getSupabase()

    // 1. Carregar nota
    const { data: nota, error: errNota } = await supabase
      .from('notas_fiscais')
      .select('id, user_id, status, mercado_id, data_emissao, valor_total_nota')
      .eq('id', notaId)
      .single()

    if (errNota || !nota) return reply.code(404).send({ error: 'Nota não encontrada' })
    if (nota.status !== 'AGUARDANDO_VALIDACAO') {
      return reply.code(409).send({ error: `Status inválido: ${nota.status}` })
    }

    const uid = nota.user_id

    // 2. Resolver mapeamentos para cada item
    const mapeamentoIds = []
    for (const item of itens) {
      if (item.avulso) {
        mapeamentoIds.push(null)
        continue
      }

      // 2a. Upsert tipo (tem UNIQUE user_id,nome)
      const { data: tipo, error: errTipo } = await supabase
        .from('tipos_item')
        .upsert({ user_id: uid, nome: item.tipo }, { onConflict: 'user_id,nome' })
        .select('id').single()
      if (errTipo || !tipo) return reply.code(500).send({ error: `Erro ao salvar tipo "${item.tipo}": ${errTipo?.message}` })

      // 2b. Produto: SELECT primeiro, INSERT se não existir
      //     (produtos não tem UNIQUE constraint — nullable marca/peso_volume impedem upsert simples)
      const marca = item.marca || null
      const pesoVolume = item.peso_volume || null
      let produtoQuery = supabase
        .from('produtos')
        .select('id')
        .eq('user_id', uid)
        .eq('tipo_id', tipo.id)
        .eq('unidade', item.unidade)
      produtoQuery = marca ? produtoQuery.eq('marca', marca) : produtoQuery.is('marca', null)
      produtoQuery = pesoVolume ? produtoQuery.eq('peso_volume', pesoVolume) : produtoQuery.is('peso_volume', null)
      const { data: produtoExistente } = await produtoQuery.maybeSingle()

      let produto = produtoExistente
      if (!produto) {
        const { data: novo, error: errProduto } = await supabase
          .from('produtos')
          .insert({ user_id: uid, tipo_id: tipo.id, marca, peso_volume: pesoVolume, unidade: item.unidade })
          .select('id').single()
        if (errProduto || !novo) return reply.code(500).send({ error: `Erro ao criar produto: ${errProduto?.message}` })
        produto = novo
      }

      // 2c. Upsert tags + produto_tags
      for (const tagNome of (item.tags ?? [])) {
        const { data: tag, error: errTag } = await supabase
          .from('tags')
          .upsert({ user_id: uid, nome: tagNome }, { onConflict: 'user_id,nome' })
          .select('id').single()
        if (errTag || !tag) return reply.code(500).send({ error: `Erro ao salvar tag "${tagNome}": ${errTag?.message}` })
        await supabase
          .from('produto_tags')
          .upsert({ produto_id: produto.id, tag_id: tag.id }, { onConflict: 'produto_id,tag_id' })
      }

      // 2d. Upsert mapeamento (tem UNIQUE user_id,nome_bruto)
      const { data: mapeamento, error: errMap } = await supabase
        .from('mapeamento_produtos')
        .upsert(
          { user_id: uid, nome_bruto: item.nome_bruto, produto_id: produto.id, unidade: item.unidade },
          { onConflict: 'user_id,nome_bruto' }
        )
        .select('id').single()
      if (errMap || !mapeamento) return reply.code(500).send({ error: `Erro ao salvar mapeamento: ${errMap?.message}` })

      mapeamentoIds.push(mapeamento.id)
    }

    // 3. Criar compra
    const dataCompra = nota.data_emissao
      ? new Date(nota.data_emissao).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)

    const { data: compra, error: errCompra } = await supabase
      .from('compras')
      .insert({
        user_id: uid,
        nota_id: nota.id,
        mercado_id: nota.mercado_id,
        data_compra: dataCompra,
        valor_total_nota: nota.valor_total_nota,
        tipo_registro: 'AUTOMATICO_NF',
      })
      .select('id').single()

    if (errCompra) return reply.code(500).send({ error: `Erro ao criar compra: ${errCompra.message}` })

    // 4. Criar itens_comprados
    const itensRows = itens.map((item, i) => ({
      compra_id: compra.id,
      mapeamento_id: mapeamentoIds[i],
      nome_bruto: item.nome_bruto,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total_item: item.valor_total,
    }))

    await supabase.from('itens_comprados').insert(itensRows)

    // 5. Atualizar valor_total_calculado
    const totalCalculado = itens.reduce((sum, i) => sum + i.valor_total, 0)
    await supabase.from('compras').update({ valor_total_calculado: totalCalculado }).eq('id', compra.id)

    // 6. Fechar nota
    await supabase.from('notas_fiscais').update({
      status: 'CONFIRMADO',
      data_processamento: new Date().toISOString(),
      itens_brutos: null,
    }).eq('id', nota.id)

    return { ok: true, compra_id: compra.id }
  })
}

import { getAnthropic } from '../plugins/anthropic.js'

const PROMPT = `Você é um classificador de produtos de supermercado brasileiro.
Dado o nome bruto de um item de nota fiscal, retorne SOMENTE o JSON abaixo sem texto adicional:

{
  "tipo": "categoria geral do produto (ex: Café Moído, Frango, Detergente Líquido)",
  "marca": "marca comercial ou null se não identificável",
  "peso_volume": "tamanho da embalagem como string (ex: 500g, 1L, 12un) ou null se vendido a granel/peso",
  "unidade": "UN se vendido por unidade/embalagem, KG se vendido por peso",
  "tags": ["array", "de", "categorias", "amplas"]
}

Tags sugeridas: Alimentação, Bebida, Limpeza, Higiene, Laticínio, Carne, Hortifruti, Padaria, Frios, Congelado, Matinal, Tempero`

export default async function produtosRoutes(fastify) {
  fastify.post('/produtos/mapear', async (req, reply) => {
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${process.env.API_TOKEN}`) {
      return reply.code(401).send({ error: 'Token inválido' })
    }

    const { nome_bruto } = req.body
    if (!nome_bruto) {
      return reply.code(400).send({ error: 'nome_bruto é obrigatório' })
    }

    const anthropic = getAnthropic()
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: `Nome do item: "${nome_bruto}"\n\n${PROMPT}` }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return reply.code(422).send({ error: 'IA não retornou JSON válido' })
    }

    return JSON.parse(match[0])
  })
}

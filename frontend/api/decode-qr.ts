import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = { maxDuration: 30 }

const client = new Anthropic()

const PROMPT = `Analise esta nota fiscal de consumidor eletrônica (NFC-e) brasileira.
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
Retorne APENAS o JSON, sem explicações adicionais.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { imageBase64, mediaType = 'image/jpeg' } = (req.body ?? {}) as {
    imageBase64?: string
    mediaType?: string
  }

  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 obrigatório' })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageBase64,
              },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return res.status(422).json({ error: 'Não foi possível extrair dados da imagem' })

    return res.json(JSON.parse(match[0]))
  } catch (err) {
    console.error('decode-qr error:', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}

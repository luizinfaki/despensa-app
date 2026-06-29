import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = { maxDuration: 30 }

const client = new Anthropic()

const PROMPT = `Analise esta nota fiscal de consumidor eletrônica (NFC-e) brasileira.
Extraia todas as informações visíveis e retorne SOMENTE o JSON abaixo, sem texto adicional:

{
  "qrcode_url": "URL completa do QR code (começa com http) ou null",
  "cnpj": "CNPJ no formato XX.XXX.XXX/XXXX-XX ou null",
  "nome_loja": "nome do estabelecimento ou null",
  "itens": [{"nome": "string", "qtd": 1, "valor_unit": 0.00, "valor_total": 0.00}],
  "total": 0.00,
  "data_hora": "DD/MM/YYYY HH:MM ou null"
}

Se não conseguir ler o QR code, retorne null para qrcode_url.
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
      model: 'claude-sonnet-4-6',
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

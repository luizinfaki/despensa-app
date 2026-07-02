import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import notasRoutes from './routes/notas.js'
import produtosRoutes from './routes/produtos.js'

const fastify = Fastify({ logger: true })

await fastify.register(cors, { origin: '*' })
await fastify.register(notasRoutes)
await fastify.register(produtosRoutes)

fastify.get('/health', async () => ({ ok: true }))

const port = Number(process.env.PORT) || 3000
await fastify.listen({ port, host: '0.0.0.0' })

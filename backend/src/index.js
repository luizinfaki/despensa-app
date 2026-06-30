import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import notasRoutes from './routes/notas.js'

const fastify = Fastify({ logger: true })

await fastify.register(cors, { origin: '*' })
await fastify.register(notasRoutes)

fastify.get('/health', async () => ({ ok: true }))

const port = Number(process.env.PORT) || 3000
await fastify.listen({ port, host: '0.0.0.0' })

import 'dotenv/config'
import pg from 'pg'
import { readFileSync } from 'fs'

const { Client } = pg

if (!process.env.DATABASE_URL) {
  console.error('Erro: DATABASE_URL não definida no .env')
  process.exit(1)
}

const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const sql = readFileSync('./migrations/001_schema.sql', 'utf8')
await client.query(sql)
await client.end()

console.log('Migration executada com sucesso.')

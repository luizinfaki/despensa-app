# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Despensa is a personal PWA for tracking household grocery purchases in Brazil (Espírito Santo). It centralizes purchase history for financial control and price-variation tracking across markets. Core flow: capture NFC-e (SEFAZ-ES receipt) QR codes on a phone, resolve the SEFAZ CAPTCHA/Cloudflare on a desktop, scrape the receipt HTML, then validate AI-suggested item classifications before committing the purchase. Full product spec and data model live in `prd.md` — read it for business rules before making data-model or flow changes.

## Repo Layout

- **`/frontend`** — React 18 + Vite PWA (TypeScript). Uses the Supabase **anon key** with a logged-in user session; RLS enforces per-user data isolation.
- **`/backend`** — Node.js + Fastify (ESM). Uses the Supabase **service role key** (bypasses RLS) and a static bearer token (`API_TOKEN`) to authenticate requests from the bookmarklet/extension, which have no Supabase session.
- **`/scraper`** — Legacy bookmarklet approach: `src/bookmarklet.js` is built by `build.mjs` into a minified `javascript:` URI (`bookmarklet.txt`), with `apiUrl`/`apiToken` injected from `config.json`.
- **`/extension`** — Firefox extension (manifest v2) that supersedes the bookmarklet: content scripts auto-inject on specific SEFAZ-ES pages (QR code, DANFE, principal) instead of requiring a manual bookmarklet click. Configured via its options page, storing `apiUrl`/`apiToken` in `browser.storage.local`.

## Development Commands

```
# Backend (Fastify API)
cd backend && npm run dev      # node --watch src/index.js
cd backend && npm start

# Frontend (Vite PWA)
cd frontend && npm run dev
cd frontend && npm run build   # tsc && vite build
cd frontend && npm run preview

# Scraper bookmarklet build
cd scraper && node build.mjs   # requires config.json (copy from config.example.json)
```

There is no automated test suite in this repo currently.

### Database migrations

`backend/migrate.js` connects via `DATABASE_URL` and runs a **hardcoded** SQL file (`./migrations/001_schema.sql`) — it does not loop over the `migrations/` directory. When adding a new migration file (e.g. `002_avulso.sql`), the runner script must be pointed at it explicitly (or run manually via `psql`) — don't assume `node migrate.js` picks up new migrations automatically.

## Architecture Notes

### Nota lifecycle (status machine)

`notas_fiscais.status` moves through `PENDENTE` → `AGUARDANDO_VALIDACAO` → `CONFIRMADO` (or `ARQUIVADO`), driven from three different surfaces:

1. **Mobile PWA scan** (`QrScanner*` components) decodes the SEFAZ QR URL, extracts the 44-digit `chave_acesso`, and inserts the `notas_fiscais` row as `PENDENTE` directly via the Supabase client (RLS, no backend involved).
2. **Desktop scrape** (bookmarklet or extension) POSTs scraped HTML data to `backend` `POST /notas/processar-scrape`, matched to the existing row by `chave_acesso` (never by ID — the desktop scraper doesn't know it). This is the join point between the two async legs of capture. Moves the nota to `AGUARDANDO_VALIDACAO`.
3. **Validation UI** (`ValidacaoNotaPage`) calls `POST /produtos/mapear` per new raw item name to get an AI (Claude Haiku) suggestion, lets the user edit, then `POST /notas/:id/confirmar` performs the write: upserts `tipos_item`/`produtos`/`tags`/`mapeamento_produtos`, creates `compras` + `itens_comprados`, and closes the nota as `CONFIRMADO` (clearing `itens_brutos`).

### Mapping cache

`mapeamento_produtos` (`user_id` + `nome_bruto` UNIQUE) is a cache from raw receipt item text to a normalized `produtos` row. New raw names get an AI classification (backend `/produtos/mapear`); once mapped, future purchases of the same raw text skip the AI call entirely. Retroactively editing a mapping is intended to affect all linked purchases (see PRD Sprint 7, not yet built).

### Two AI integrations, same backend

Both live in `backend`, sharing the lazy-singleton Anthropic client from `backend/src/plugins/anthropic.js` (mirrors `plugins/supabase.js`), but keep distinct prompts/purposes — don't conflate the two when changing prompts or models.

- `backend/src/routes/produtos.js` (`POST /produtos/mapear`) — text-only classification of a raw item name into `{tipo, marca, peso_volume, unidade, tags}` via Claude Haiku, used during validation.
- `backend/src/routes/notas.js` (`POST /notas/decode-foto`) — Claude vision reading a photographed nota/QR code when live QR scanning fails (`AnexarFotoNota`, `QrScannerPhoto`). Needs a raised Fastify `bodyLimit` (base64-encoded photos exceed the 1MB default).

### Auth model asymmetry

Backend routes check `Authorization: Bearer ${API_TOKEN}` individually per-handler (not a global `onRequest` hook) — the frontend never calls these two routes with this token; only the bookmarklet/extension do. Frontend-originated writes (nota creation from QR scan, reads) go straight to Supabase with the user's session and rely on RLS, not the backend.

### Data model

See `prd.md` §4 for the full normalized schema (`notas_fiscais`, `mercados`, `tipos_item`, `produtos`, `tags`/`produto_tags`, `mapeamento_produtos`, `compras`, `itens_comprados`, `orcamento_mensal`). Note `produtos` has no UNIQUE constraint (nullable `marca`/`peso_volume` prevent a simple upsert key), so `confirmar` does a manual select-then-insert instead of an upsert for that table — replicate that pattern rather than adding a upsert that nullable columns would break.

---

## Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

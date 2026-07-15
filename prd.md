# Documento de Requisitos do Produto (PRD)

## Projeto: Despensa — Gestor de Compras Domésticas

---

### 1. Visão Geral do Produto

Uma aplicação web pessoal desenvolvida como **PWA (Progressive Web App)**, projetada para o registro prático e gestão de compras de supermercado e suprimentos domésticos. O foco central está na centralização do histórico de compras para controle financeiro individual e identificação de variações de preços entre mercados. O sistema utiliza uma arquitetura assíncrona (Celular → Computador → Servidor) para captura de notas fiscais (NFC-e SEFAZ-ES), transpondo barreiras de CAPTCHA/Cloudflare sem digitação manual.

#### 1.1 Objetivos Principais

- **Acompanhar gastos mensais:** clareza sobre o montante gasto por mês com suprimentos.
- **Identificar itens de maior gasto:** descobrir quais produtos consomem a maior fatia do orçamento.
- **Monitorar variação de preço entre mercados:** saber qual estabelecimento cobra menos por um item frequente.
- **Calcular inflação pessoal:** acompanhar o crescimento real do preço de itens ao longo do tempo.

---

### 2. Personas e Casos de Uso

- **Usuário Único (Gestor do Lar):** usa o iPhone na rua para registros rápidos e o computador em casa para processamento de notas. Exige processo de entrada rápido e recusa cadastro manual item a item.

---

### 3. Fluxo de Captura da Nota Fiscal

1. **No mercado (PWA mobile):** aponta a câmera para o QR Code da nota. O PWA decodifica a URL da SEFAZ, extrai a chave de acesso de 44 dígitos e cria um registro em `notas_fiscais` com status `PENDENTE`.
2. **Em casa (computador):** acessa a fila de notas pendentes, abre a URL da SEFAZ no navegador e resolve o Turnstile/Captcha manualmente se necessário.
3. **Extração via bookmarklet:** com a página carregada, o bookmarklet raspa o HTML, extrai os dados estruturados (emitente, CNPJ, itens com nome bruto, quantidade, valores) e envia via POST para o backend. A nota transita para `AGUARDANDO_VALIDACAO`.
4. **Validação (PWA desktop ou mobile):** o usuário abre a nota na fila, visualiza todos os itens com sugestões da IA, edita se necessário e confirma. A nota vai para `CONFIRMADO` e a compra é efetivada no banco.

---

### 4. Modelo de Dados (Implementado)

O schema real difere do modelo inicial do PRD — é mais normalizado.

#### 4.1 Tabelas

**`notas_fiscais`**
- `id`, `user_id`, `url_sefaz` (UNIQUE), `chave_acesso` (VARCHAR 44), `numero_nf`
- `status`: `PENDENTE` → `AGUARDANDO_VALIDACAO` → `CONFIRMADO` | `ARQUIVADO`
- `data_escaneamento`, `data_emissao`, `data_processamento`
- `nome_emitente`, `cnpj_emitente`, `valor_total_nota`
- `itens_brutos` (JSONB) — preenchido pelo bookmarklet, zerado após confirmação
- `mercado_id` (FK → mercados)

**`mercados`**
- `id`, `user_id`, `cnpj` (UNIQUE por user), `nome_fantasia`, `descricao`

**`tipos_item`** *(agrupador geral — ex: "Café Moído", "Carne Bovina")*
- `id`, `user_id`, `nome` (UNIQUE por user)

**`produtos`** *(especificação comercial — tipo + marca + peso/volume)*
- `id`, `user_id`, `tipo_id` (FK → tipos_item), `marca`, `peso_volume`, `unidade`

**`tags`**
- `id`, `user_id`, `nome` (UNIQUE por user)

**`produto_tags`** *(junction)*
- `produto_id`, `tag_id`

**`mapeamento_produtos`** *(memória da aplicação: nome bruto → produto)*
- `id`, `user_id`, `nome_bruto` (UNIQUE por user), `produto_id` (FK → produtos), `unidade`

**`compras`**
- `id`, `user_id`, `nota_id` (FK → notas_fiscais, UNIQUE), `mercado_id`
- `data_compra`, `valor_total_nota`, `valor_total_calculado`, `tipo_registro` (`AUTOMATICO_NF` | `MANUAL`)

**`itens_comprados`**
- `id`, `compra_id` (FK → compras), `mapeamento_id` (FK → mapeamento_produtos)
- `quantidade`, `valor_unitario`, `valor_total_item`

**`orcamento_mensal`**
- `id`, `user_id`, `mes_ano` (VARCHAR, ex: `"2026-06"`), `valor_limite`

#### 4.2 Regras de Negócio

- **Mapeamento cacheável:** nome bruto inédito → IA classifica → salvo em `mapeamento_produtos`. Compras futuras do mesmo item reutilizam o cache sem custo de IA.
- **Idempotência:** re-escaneamento bloqueado por UNIQUE na `chave_acesso`.
- **Amarração nota↔bookmarklet:** feita pela chave de acesso de 44 dígitos (presente na URL do QR code e na página SEFAZ).

---

### 5. Interface e Navegação

#### NavBar (sempre visível quando autenticado)
- **Início** → `/`
- **Notas** → `/notas`
- **Compras** → `/compras`
- Botão **Sair**

#### Tela Inicial — `/` (Home)
- Gasto total do mês atual (soma dos `valor_total_calculado` das compras do mês)
- Botão principal: **"Escanear nota"**
- Atalho para notas pendentes (se houver notas com status PENDENTE ou AGUARDANDO_VALIDACAO)
- Top 3 categorias do mês (tipos_item com maior gasto)

#### Fila de Notas — `/notas`
- Lista de notas com status PENDENTE ou AGUARDANDO_VALIDACAO
- Cards com: mercado, data, valor total, badge de status
- Notas AGUARDANDO_VALIDACAO são clicáveis → tela de validação

#### Validação de Nota — `/notas/:id`
- Cabeçalho: mercado, data, valor total
- Lista de itens: nome bruto, quantidade, valor
- Cada item exibe sugestão da IA (tipo, marca, peso, tags) ou mapeamento existente (✓)
- Campos editáveis por item; botão "Confirmar compra" confirma tudo junto

#### Compras — `/compras`
- Seletor de mês (navegação anterior/próximo)
- Total gasto no mês selecionado
- Lista de compras do mês (mercado, data, valor)
- Detalhe de compra: itens com quantidade, valor unitário, valor total e breakdown por categoria

---

### 6. Arquitetura Técnica

- **`/frontend`** — React + Vite PWA. Supabase anon key + sessão do usuário (RLS filtra automaticamente).
- **`/backend`** — Node.js + Fastify. Supabase service role key (bypassa RLS). Bearer token fixo para autenticação do bookmarklet.
- **`/scraper`** — Bookmarklet JavaScript executado no navegador desktop na página SEFAZ.

**Variáveis de ambiente:**
- Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `API_TOKEN`, `ANTHROPIC_API_KEY`, `PORT`
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_URL`, `VITE_API_TOKEN`

---

### 7. Sprints

#### ✅ Sprint 1 — PWA com câmera e escaneamento de QR Code
- PWA funcional com câmera HTML5
- Decodificação da URL do QR Code via IA (Claude Sonnet)
- Extração da chave de acesso de 44 dígitos da URL
- Salvamento em `notas_fiscais` com status PENDENTE
- Autenticação via Supabase (login com email/senha)

#### ✅ Sprint 2 — Schema do banco
- Todas as tabelas criadas com RLS
- Migration em `backend/migrations/001_schema.sql`

#### ✅ Sprint 3 — Backend Fastify
- `POST /notas/processar-scrape` — recebe dados do bookmarklet, upserta mercado, atualiza nota para AGUARDANDO_VALIDACAO
- `POST /produtos/mapear` — classifica item via Claude Haiku, retorna tipo/marca/peso/unidade/tags
- `POST /notas/:id/confirmar` — upserta tipos/produtos/mapeamentos/tags, cria compra e itens_comprados, fecha nota como CONFIRMADO
- `GET /health`

#### ✅ Sprint 4 — Bookmarklet SEFAZ-ES
- Extrai: emitente, CNPJ, número NF, chave de acesso, data, valor total, todos os itens (nome, código, unidade, quantidade, valores)
- Preview modal antes de enviar
- Build script com substituição de placeholders e minificação

#### ✅ Sprint 5 — Fila de notas e validação
- React Router com rotas protegidas por sessão
- NavBar com Início/Notas/Sair
- `FilaNotasPage` — lista notas pendentes
- `ValidacaoNotaPage` — verifica cache de mapeamentos, chama IA para itens novos em paralelo, campos editáveis, confirmação

#### 🔲 Sprint 6 — Home reformulada + tela de Compras
- Home com gasto do mês, atalho para pendentes, top 3 categorias
- `/compras` com navegação por mês, lista de compras e detalhe com breakdown por categoria

#### 🔲 Sprint 7 — Gestão de mapeamentos
- Tela para listar, buscar e editar registros de `mapeamento_produtos`
- Correção retroativa: editar um mapeamento reflete em todas as compras vinculadas

#### 🔲 Backlog (sem sprint definido)
- Orçamento mensal: cadastro de `orcamento_mensal` + barra de progresso na Home
- Lançamento manual de compra (sem nota fiscal)
- Fila offline com LocalStorage (sincronismo automático ao reconectar)
- Fallback de colagem de texto bruto caso o bookmarklet falhe
- Variação de preço por produto ao longo do tempo
- Comparativo de preços entre mercados

---

### 8. Riscos e Mitigações

**IA classificar incorretamente um item inédito.**
Mitigação: validação humana antes do commit. O usuário edita na tela de validação. O banco memoriza a correção.

**Mapeamento salvo incorretamente após o commit.**
Mitigação: Sprint 7 — tela de gestão de mapeamentos com edição retroativa.

**Mudança no HTML do portal SEFAZ quebrando o bookmarklet.**
Mitigação (backlog): fallback de colagem de texto bruto com reprocessamento via IA.

**Sem sinal no mercado.**
Mitigação (backlog): fila offline com LocalStorage.

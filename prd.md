# Documento de Requisitos do Produto (PRD)

## Projeto: Gestor de Suprimentos Domésticos (App de Compras)

---

### 1. Visão Geral do Produto

Uma aplicação web pessoal desenvolvida como **PWA (Progressive Web App)**, projetada para o registro prático e gestão de compras de supermercado e suprimentos domésticos. O foco central está na centralização do histórico de compras para controle financeiro individual e identificação de variações de preços entre mercados. O sistema utiliza uma arquitetura assíncrona inteligente (Celular ➔ Computador ➔ Servidor) para captura de notas fiscais (NFC-e SEFAZ-ES), transpondo barreiras de CAPTCHA/Cloudflare sem a necessidade de digitação manual obrigatória ou custos excessivos com IA.

#### 1.1 Objetivos Principais

- **Acompanhar Gastos Mensais com Mercado:** Oferecer clareza absoluta sobre o montante gasto por mês com suprimentos, permitindo definir e monitorar um orçamento doméstico.
- **Identificar "Ralos de Dinheiro" (Itens Mais Gastos):** Descobrir quais os produtos específicos que consomem a maior fatia do orçamento no mês ou no ano através de rankings detalhados.
- **Monitorar Variação de Valor entre Mercados:** Saber exatamente qual o estabelecimento que cobra o valor mais barato por um item frequente com base no histórico de compras.
- **Calcular a Inflação Pessoal:** Acompanhar o crescimento real do preço de itens isolados ao longo do tempo através de gráficos históricos.

---

### 2. Personas e Casos de Uso

- **Usuário Único (Gestor do Lar):** Utiliza o iPhone na rua para registros rápidos e o Computador em casa para gestão pesada e relatórios. Deseja inteligência de dados, mas exige um processo de entrada rápido e recusa-se a cadastrar manualmente marca por marca ou item por item.

---

### 3. Modelo de Dados e Fluxos de Entrada

#### 3.1 A Estrutura de Cadastro (3 Níveis)

Para viabilizar relatórios de inflação sem duplicar itens por causa de marcas diferentes, os produtos são estruturados em:

1. **Agrupador Geral (O que o produto é essencialmente):** Ex: `Café Moído`, `Detergente Líquido`. (Nível onde roda o cálculo de variação de preço).
2. **Item / Especificação Comercial (Marca e Peso/Volume):** Ex: `Pilão Intenso 500g`, `Ypê Coco 500ml`.
3. **Tags (Categorização ampla):** Ex: `["Alimentação", "Matinal"]`, `["Limpeza"]`.

#### 3.2 Fluxo Assíncrono de Captura da Nota Fiscal (Bypass Cloudflare)

1. **Passo 1 (No Mercado via PWA Mobile):** O usuário aponta a câmera do iPhone para o QR Code da nota fiscal. O PWA decodifica a URL da SEFAZ e envia para o backend, criando um registro na tabela `notas_fiscais` com status `'PENDENTE'`.
2. **Passo 2 (Em Casa via Computador):** Na interface Desktop, o usuário acessa a fila de "Notas Pendentes" e clica em processar. O sistema abre a URL da SEFAZ num navegador local. O usuário (humano) resolve o Turnstile/Captcha do Cloudflare se necessário.
3. **Passo 3 (Extração Client-side):** Uma vez carregada a página com a tabela de produtos da SEFAZ, um script injetado no cliente (Bookmarklet) raspa o HTML limpo, extrai os dados estruturados (Nome bruto, Qtd, Valor Unitário, Valor Total) e envia via POST para a API do backend. A nota transita para `AGUARDANDO_VALIDACAO`.

#### 3.3 Separação de Notas e Compras

A tabela de `notas_fiscais` é desacoplada da tabela de `compras`. Uma compra pode nascer a partir do processamento bem-sucedido de uma nota fiscal ou ser introduzida de forma 100% manual (ex: compras em feiras ou mercados sem NFC-e). No fluxo manual, a nota vai diretamente de `PENDENTE` para `CONFIRMADO`, sem passar por `AGUARDANDO_VALIDACAO`.

#### 3.4 Regras de Negócio Específicas

- **Mapeamento Inteligente com IA Cacheável:** Quando um nome de produto bruto é inédito, o backend aciona a IA para determinar o *Agrupador Geral*, a *Marca*, o *Peso/Volume* e as *Tags*. O resultado é salvo na tabela de cache (`mapeamento_produtos`). Se o item for comprado novamente no futuro, o sistema reutiliza o mapeamento histórico, ignorando a IA (custo zero).
- **Arquivamento de Notas:** Notas com erros crônicos ou leituras incorretas podem ser alteradas para o status `'ARQUIVADO'`, sumindo da fila de processamento sem apagar o histórico de tentativa.
- **Gestão de Mercados Dinâmica:** Na nota, o mercado é identificado unicamente pelo CNPJ. No lançamento manual, o usuário digita o nome do mercado e o sistema exibe em tempo real os mercados já cadastrados que correspondam à busca, permitindo a seleção de um existente ou o cadastro de um novo caso não haja correspondência.
- **Idempotência:** A URL da SEFAZ ou a chave de acesso de 44 dígitos possui restrição de unicidade (`UNIQUE`). O re-escaneamento acidental de uma nota é bloqueado pelo banco.

---

### 4. Interface e Navegação

#### 4.1 Tela Inicial (Home) - Focada em Ação e Produtividade

Interface minimalista focada no ecossistema mobile (iPhone):

- Botão principal de grande dimensão: **"Registrar Compra"** (Leva ao fluxo de lançamento manual com seleção de mercado).
- Botão de gatilho nativo: **"Escanear Nota"** (Abre a câmera HTML5 para leitura do QR Code).
- Bloco informativo secundário: Link para a fila de **Histórico de Compras / Notas Pendentes**.
- Mini Dashboard Financeiro: Exibição numérica simples do **Gasto Consolidado do Mês Atual** com indicador visual de progresso em relação ao orçamento mensal definido, funcionando como termômetro de orçamento.

#### 4.2 Área de Análises (Relatórios)

Menu dedicado, desenvolvido de forma totalmente responsiva (visível com gráficos adaptados tanto no celular quanto na tela grande do computador), englobando:

- **Módulo de Evolução de Preços:** Seleciona-se um *Agrupador Geral* (ex: Café Moído) e visualiza-se um gráfico de linhas contendo a flutuação de preço dele ao longo dos meses, independente da marca comprada.
- **Módulo Top 10 Gastos:** Gráfico de barras/pizza listando os itens específicos que mais consumiram capital no período filtrado.

---

### 5. Arquitetura de Dados e Estrutura do Banco

O banco de dados relacional (Supabase / PostgreSQL) é projetado com restrições e chaves estrangeiras claras para manter a consistência financeira.

```
       ┌─────────────────┐             ┌──────────────┐
       │  notas_fiscais  │0..1        1│   mercados   │
       └────────┬────────┘             └──────┬───────┘
                │1                            │1
                │ (id_nota)                   │ (id_mercado)
                ▼                             ▼
       ┌─────────────────┐             ┌──────────────────┐
       │     compras     │1───────────N│ itens_comprados  │
       └─────────────────┘             └──────┬───────────┘
                                              │N
                                              │ (id_mapeamento)
                                              ▼
                                       ┌──────────────────────┐
                                       │  mapeamento_produtos  │
                                       └──────────────────────┘

                                       ┌──────────────────────┐
                                       │   orcamento_mensal   │
                                       └──────────────────────┘
```

#### 5.1 Dicionário de Tabelas

**1. Tabela: `notas_fiscais`**
- `id` (SERIAL, Primary Key)
- `user_id` (INTEGER, Foreign Key → auth.users)
- `url_sefaz` (TEXT, UNIQUE) — URL do QR Code.
- `numero_nf` (VARCHAR, Nullable) — Número do documento.
- `status` (VARCHAR) — Estados possíveis:
  - `PENDENTE` — Nota escaneada no celular, aguardando abertura no computador.
  - `AGUARDANDO_VALIDACAO` — SEFAZ lida pelo scraper, itens extraídos e mapeados pela IA, aguardando confirmação humana.
  - `CONFIRMADO` — Compra validada e efetivada no banco. Estado final.
  - `ARQUIVADO` — Nota com erro crônico ou inválida, removida da fila sem apagar o histórico.
- `data_escaneamento` (TIMESTAMP, Default: NOW()) — Momento em que o QR Code foi lido no celular.
- `data_processamento` (TIMESTAMP, Nullable) — Momento em que a nota transitou para `CONFIRMADO`.

**2. Tabela: `compras`**
- `id` (SERIAL, Primary Key)
- `user_id` (INTEGER, Foreign Key → auth.users)
- `id_nota` (INTEGER, Foreign Key → notas_fiscais, UNIQUE, Nullable)
- `id_mercado` (INTEGER, Foreign Key → mercados)
- `data_compra` (DATE)
- `valor_total_nota` (DECIMAL) — Valor total importado diretamente da nota fiscal ou informado manualmente. Representa o que foi efetivamente pago.
- `valor_total_calculado` (DECIMAL, Gerado) — Campo derivado: soma automática dos `valor_total_item` de todos os `itens_comprados` vinculados. Permite detectar divergências em relação ao `valor_total_nota` (ex: descontos no caixa, arredondamentos).
- `tipo_registro` (VARCHAR) — `['AUTOMATICO_NF', 'MANUAL']`

**3. Tabela: `mercados`**
- `id` (SERIAL, Primary Key)
- `user_id` (INTEGER, Foreign Key → auth.users)
- `cnpj` (VARCHAR, UNIQUE, Nullable) — Preenchido apenas via extração de nota.
- `nome_fantasia` (VARCHAR)

**4. Tabela: `mapeamento_produtos`** *(A Memória da Aplicação)*
- `id` (SERIAL, Primary Key)
- `user_id` (INTEGER, Foreign Key → auth.users)
- `nome_bruto_nota` (VARCHAR, UNIQUE) — Ex: `"CAFÉ PILAO 500G ARÁBICO"`
- `agrupador_geral` (VARCHAR) — Ex: `"Café Moído"`
- `marca` (VARCHAR, Nullable) — Ex: `"Pilão"`
- `peso_volume` (VARCHAR, Nullable) — Ex: `"500g"`
- `tags` (TEXT[], Nullable) — Ex: `["Alimentação", "Matinal"]`

**5. Tabela: `itens_comprados`**
- `id` (SERIAL, Primary Key)
- `id_compra` (INTEGER, Foreign Key → compras, On Delete Cascade)
- `id_mapeamento` (INTEGER, Foreign Key → mapeamento_produtos)
- `valor_unitario` (DECIMAL)
- `quantidade` (DECIMAL)
- `valor_total_item` (DECIMAL)

**6. Tabela: `orcamento_mensal`**
- `id` (SERIAL, Primary Key)
- `user_id` (INTEGER, Foreign Key → auth.users)
- `mes_ano` (VARCHAR) — Ex: `"2025-07"`
- `valor_limite` (DECIMAL) — Orçamento definido para o mês. Usado como referência no termômetro da Home.

---

### 6. Riscos e Mitigações

**Risco: A IA classificar incorretamente um item inédito.**
- **Mitigação — Validação Humana com Confirmação Intermediária:** Após o processamento da nota no Computador, o frontend exibirá uma lista com as classificações sugeridas pela IA para itens inéditos. O usuário valida ou edita na tela antes de efetivar o commit no banco. O banco memoriza a correção. Este é o momento em que a nota transita de `AGUARDANDO_VALIDACAO` para `CONFIRMADO`.

**Risco: O usuário perceber, após o commit, que um mapeamento foi salvo incorretamente.**
- **Mitigação — Tela de Gestão de Mapeamentos:** O sistema disponibiliza uma interface dedicada (acessível pelo menu) para listar, buscar e editar todos os registros da tabela `mapeamento_produtos`. Ao corrigir um agrupador, marca ou tags de um item já salvo, os relatórios passam a refletir a correção retroativamente em todas as compras que referenciam aquele mapeamento, sem necessidade de reprocessamento manual.

**Risco: Mudança repentina no HTML do portal da SEFAZ quebrando o script de raspagem.**
- **Mitigação — Fallback de colagem de texto bruto (Ctrl+A):** Se o script falhar, o sistema apresentará um campo de texto livre. O usuário copia todo o conteúdo textual da página da SEFAZ, cola no app, e o backend utiliza a IA temporariamente para reestruturar os dados brutos até que o script seja atualizado.

**Risco: Falta de sinal ou internet móvel dentro do supermercado.**
- **Mitigação — Fila Offline com LocalStorage:** O PWA em React armazenará localmente os links dos QR Codes escaneados caso não haja rede, efetuando o sincronismo automático com o Supabase assim que a conexão for restabelecida.

---

### 7. Diretrizes de Implementação

> ⚠️ **ATENÇÃO, AGENTE DE IA / CLAUDE CODE:** As diretrizes técnicas listadas abaixo são restrições mandatórias de desenvolvimento. Siga-as rigorosamente na geração dos arquivos e códigos.

#### 7.1 Estrutura de Arquitetura (Padrão Monorepo)

Separe o código estritamente nas seguintes pastas de raiz do diretório:

- `/frontend` — Aplicação React + Vite configurada como Progressive Web App (PWA).
- `/backend` — API REST construída em Node.js utilizando o framework Fastify.
- `/scraper` — Script/Bookmarklet isolado em JavaScript para execução no client-side do navegador desktop.

#### 7.2 Isolamento de Segurança (Supabase RLS)

Todas as tabelas do banco de dados descritas na seção 5 possuem obrigatoriamente uma coluna `user_id` referenciando `auth.users(id)` do Supabase. Ative o Row Level Security (RLS) em todas elas, limitando as políticas de SELECT, INSERT, UPDATE e DELETE ao contexto de usuário autenticado (`auth.uid() = user_id`).

#### 7.3 Gerenciamento de Credenciais (.env)

Não escreva credenciais diretas no código (hardcoding). No backend utilize `process.env` para mapear `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e chaves de API de LLMs. No frontend utilize o prefixo padrão do Vite (`import.meta.env.VITE_...`).

#### 7.4 Estratégia de Codificação Incremental (Sprints)

Não execute a aplicação inteira de uma só vez. Siga o roteiro em Sprints modulares:

1. **Sprint 1:** PWA funcional com câmera ativa, leitura de QR Code e salvamento da URL no Supabase. Validar o fluxo mobile de ponta a ponta antes de qualquer outra coisa.
2. **Sprint 2:** Schema completo do banco de dados com RLS e migrations.
3. **Sprint 3:** Backend Fastify — rotas de autenticação, endpoint de importação e pipeline de mapeamento com IA.
4. **Sprint 4:** Scraper/Bookmarklet isolado para extração do portal SEFAZ.
5. **Sprint 5:** Frontend desktop — fila de notas pendentes e tela de validação de mapeamentos.
6. **Sprint 6:** Relatórios e tela de gestão de mapeamentos.

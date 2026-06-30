-- =================================================================
-- Despensa — Schema completo
-- Executar no Supabase Studio > SQL Editor
-- =================================================================

-- -----------------------------------------------------------------
-- 1. mercados
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mercados (
  id             SERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cnpj           VARCHAR,
  nome_fantasia  VARCHAR NOT NULL,
  descricao      VARCHAR,
  UNIQUE (user_id, cnpj)
);

ALTER TABLE mercados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mercados: acesso proprio" ON mercados
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------
-- 2. tipos_item
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos_item (
  id       SERIAL PRIMARY KEY,
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome     VARCHAR NOT NULL,
  UNIQUE (user_id, nome)
);

ALTER TABLE tipos_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tipos_item: acesso proprio" ON tipos_item
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------
-- 3. tags
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
  id       SERIAL PRIMARY KEY,
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome     VARCHAR NOT NULL,
  UNIQUE (user_id, nome)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags: acesso proprio" ON tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------
-- 4. produtos
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produtos (
  id           SERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_id      INTEGER NOT NULL REFERENCES tipos_item(id),
  marca        VARCHAR,
  peso_volume  VARCHAR,
  unidade      VARCHAR NOT NULL
);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "produtos: acesso proprio" ON produtos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------
-- 5. produto_tags (junction)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produto_tags (
  produto_id  INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (produto_id, tag_id)
);

ALTER TABLE produto_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "produto_tags: acesso proprio" ON produto_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM produtos p
      WHERE p.id = produto_tags.produto_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM produtos p
      WHERE p.id = produto_tags.produto_id AND p.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------
-- 6. mapeamento_produtos
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mapeamento_produtos (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_bruto      VARCHAR NOT NULL,
  produto_id      INTEGER NOT NULL REFERENCES produtos(id),
  codigo_produto  VARCHAR,
  unidade         VARCHAR NOT NULL,
  UNIQUE (user_id, nome_bruto)
);

ALTER TABLE mapeamento_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mapeamento_produtos: acesso proprio" ON mapeamento_produtos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------
-- 7. notas_fiscais — adicionar colunas (tabela já existe do Sprint 1)
-- -----------------------------------------------------------------
ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS numero_nf          VARCHAR,
  ADD COLUMN IF NOT EXISTS chave_acesso       VARCHAR(44),
  ADD COLUMN IF NOT EXISTS nome_emitente      VARCHAR,
  ADD COLUMN IF NOT EXISTS cnpj_emitente      VARCHAR,
  ADD COLUMN IF NOT EXISTS valor_total_nota   DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS data_emissao       TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS data_processamento TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS itens_brutos       JSONB,
  ADD COLUMN IF NOT EXISTS mercado_id         INTEGER REFERENCES mercados(id);

-- -----------------------------------------------------------------
-- 8. compras
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compras (
  id                     SERIAL PRIMARY KEY,
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nota_id                INTEGER UNIQUE REFERENCES notas_fiscais(id),
  mercado_id             INTEGER NOT NULL REFERENCES mercados(id),
  data_compra            DATE NOT NULL,
  valor_total_nota       DECIMAL(10,2) NOT NULL,
  valor_total_calculado  DECIMAL(10,2),
  tipo_registro          VARCHAR NOT NULL CHECK (tipo_registro IN ('AUTOMATICO_NF', 'MANUAL'))
);

ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compras: acesso proprio" ON compras
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------
-- 9. itens_comprados
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS itens_comprados (
  id               SERIAL PRIMARY KEY,
  compra_id        INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  mapeamento_id    INTEGER NOT NULL REFERENCES mapeamento_produtos(id),
  quantidade       DECIMAL(10,4) NOT NULL,
  valor_unitario   DECIMAL(10,2) NOT NULL,
  valor_total_item DECIMAL(10,2) NOT NULL
);

ALTER TABLE itens_comprados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "itens_comprados: acesso proprio" ON itens_comprados
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM compras c
      WHERE c.id = itens_comprados.compra_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM compras c
      WHERE c.id = itens_comprados.compra_id AND c.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------
-- 10. orcamento_mensal
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orcamento_mensal (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes_ano       VARCHAR NOT NULL,
  valor_limite  DECIMAL(10,2) NOT NULL,
  UNIQUE (user_id, mes_ano)
);

ALTER TABLE orcamento_mensal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orcamento_mensal: acesso proprio" ON orcamento_mensal
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------
-- Índices úteis
-- -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mapeamento_user_nome    ON mapeamento_produtos (user_id, nome_bruto);
CREATE INDEX IF NOT EXISTS idx_compras_user_data       ON compras (user_id, data_compra);
CREATE INDEX IF NOT EXISTS idx_itens_compra            ON itens_comprados (compra_id);
CREATE INDEX IF NOT EXISTS idx_notas_url               ON notas_fiscais (url_sefaz);

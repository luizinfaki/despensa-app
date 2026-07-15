-- Permite itens avulsos: mapeamento_id nullable + coluna nome_bruto para exibição
ALTER TABLE itens_comprados ALTER COLUMN mapeamento_id DROP NOT NULL;
ALTER TABLE itens_comprados ADD COLUMN IF NOT EXISTS nome_bruto TEXT;

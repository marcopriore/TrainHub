-- Tabela de participantes (parceiros) de treinamentos
-- Participantes importados via planilha no formulário de registro

CREATE TABLE IF NOT EXISTS treinamento_parceiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treinamento_id UUID NOT NULL REFERENCES treinamentos(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treinamento_parceiros_treinamento_id
  ON treinamento_parceiros(treinamento_id);
CREATE INDEX IF NOT EXISTS idx_treinamento_parceiros_tenant_id
  ON treinamento_parceiros(tenant_id);

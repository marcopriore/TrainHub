-- Tabela de módulos habilitados por tenant
-- Permite que cada tenant tenha módulos (gestao, trilhas) ativos ou não.

-- Função para atualizar atualizado_em (usada pelo trigger)
CREATE OR REPLACE FUNCTION public.update_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- Tabela
CREATE TABLE IF NOT EXISTS tenant_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, modulo)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tenant_modulos_tenant_id
  ON tenant_modulos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_modulos_modulo
  ON tenant_modulos(modulo);

-- RLS
ALTER TABLE tenant_modulos ENABLE ROW LEVEL SECURITY;

-- Master lê e escreve tudo
CREATE POLICY "tenant_modulos_master_all"
  ON tenant_modulos FOR ALL
  USING (public.is_current_user_master())
  WITH CHECK (public.is_current_user_master());

-- Usuários leem módulos do seu próprio tenant
CREATE POLICY "tenant_modulos_select"
  ON tenant_modulos FOR SELECT
  USING (
    tenant_id = (
      SELECT tenant_id FROM public.usuarios
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- Trigger para atualizar atualizado_em
DROP TRIGGER IF EXISTS trg_tenant_modulos_updated ON tenant_modulos;
CREATE TRIGGER trg_tenant_modulos_updated
  BEFORE UPDATE ON tenant_modulos
  FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

-- Popular módulos iniciais para tenants existentes
INSERT INTO tenant_modulos (tenant_id, modulo, ativo)
SELECT id, 'gestao', true FROM tenants
ON CONFLICT (tenant_id, modulo) DO NOTHING;

INSERT INTO tenant_modulos (tenant_id, modulo, ativo)
SELECT id, 'trilhas', false FROM tenants
ON CONFLICT (tenant_id, modulo) DO NOTHING;

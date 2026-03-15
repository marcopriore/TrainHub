-- Tabela de catálogo de treinamentos por tenant
-- Executar no Supabase: SQL Editor (ou via supabase db push)
--
-- Depende de: is_current_user_master(), update_atualizado_em()
-- Esta migration cria is_current_user_admin() se não existir.

-- Função auxiliar: retorna true se o usuário atual é admin do tenant (perfil is_admin)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.usuarios u
     JOIN public.perfis p ON p.id = u.perfil_id
     WHERE u.id = auth.uid()
     LIMIT 1),
    false
  );
$$;

-- Tabela de catálogo de treinamentos por tenant
CREATE TABLE IF NOT EXISTS catalogo_treinamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  conteudo_programatico TEXT,
  objetivo TEXT,
  carga_horaria NUMERIC(6,1),
  categoria TEXT,
  nivel TEXT CHECK (nivel IN ('basico', 'intermediario', 'avancado')),
  modalidade TEXT CHECK (modalidade IN ('presencial', 'online', 'hibrido')),
  imagem_url TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('ativo', 'inativo', 'rascunho')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_catalogo_tenant_id
  ON catalogo_treinamentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_status
  ON catalogo_treinamentos(status);
CREATE INDEX IF NOT EXISTS idx_catalogo_categoria
  ON catalogo_treinamentos(categoria);

-- RLS
ALTER TABLE catalogo_treinamentos ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário do tenant
CREATE POLICY "catalogo_select"
  ON catalogo_treinamentos FOR SELECT
  USING (
    is_current_user_master()
    OR tenant_id = (
      SELECT tenant_id FROM usuarios
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- Escrita: master, admin ou usuário com permissão gerenciar_catalogo
CREATE POLICY "catalogo_insert"
  ON catalogo_treinamentos FOR INSERT
  WITH CHECK (
    is_current_user_master()
    OR is_current_user_admin()
    OR (
      tenant_id = (
        SELECT tenant_id FROM usuarios
        WHERE id = auth.uid()
        LIMIT 1
      )
      AND EXISTS (
        SELECT 1 FROM perfil_permissoes pp
        JOIN usuarios u ON u.perfil_id = pp.perfil_id
        WHERE u.id = auth.uid()
        AND pp.permissao = 'gerenciar_catalogo'
      )
    )
  );

CREATE POLICY "catalogo_update"
  ON catalogo_treinamentos FOR UPDATE
  USING (
    is_current_user_master()
    OR is_current_user_admin()
    OR (
      tenant_id = (
        SELECT tenant_id FROM usuarios
        WHERE id = auth.uid()
        LIMIT 1
      )
      AND EXISTS (
        SELECT 1 FROM perfil_permissoes pp
        JOIN usuarios u ON u.perfil_id = pp.perfil_id
        WHERE u.id = auth.uid()
        AND pp.permissao = 'gerenciar_catalogo'
      )
    )
  )
  WITH CHECK (
    is_current_user_master()
    OR is_current_user_admin()
    OR tenant_id = (
      SELECT tenant_id FROM usuarios
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "catalogo_delete"
  ON catalogo_treinamentos FOR DELETE
  USING (
    is_current_user_master()
    OR is_current_user_admin()
    OR (
      tenant_id = (
        SELECT tenant_id FROM usuarios
        WHERE id = auth.uid()
        LIMIT 1
      )
      AND EXISTS (
        SELECT 1 FROM perfil_permissoes pp
        JOIN usuarios u ON u.perfil_id = pp.perfil_id
        WHERE u.id = auth.uid()
        AND pp.permissao = 'gerenciar_catalogo'
      )
    )
  );

-- Trigger para atualizar atualizado_em
CREATE TRIGGER trg_catalogo_updated
  BEFORE UPDATE ON catalogo_treinamentos
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

-- Pool global de catálogo: consentimento no tenant, fila de moderação Master, publicação global, opt-in por categoria.
-- Fila entra apenas quando o app envia submissão com item em status ativo + consentimento (lógica no cliente/RPC).

-- 1) Catálogo local: consentimento e rastreio de cópia global
ALTER TABLE public.catalogo_treinamentos
  ADD COLUMN IF NOT EXISTS pool_global_consentimento boolean NOT NULL DEFAULT false;

ALTER TABLE public.catalogo_treinamentos
  ADD COLUMN IF NOT EXISTS pool_global_consentimento_em timestamptz;

ALTER TABLE public.catalogo_treinamentos
  ADD COLUMN IF NOT EXISTS pool_global_termo_versao text;

ALTER TABLE public.catalogo_treinamentos
  ADD COLUMN IF NOT EXISTS pool_global_linhagem_id uuid;

ALTER TABLE public.catalogo_treinamentos
  ADD COLUMN IF NOT EXISTS copiado_de_global_id uuid;

-- FK copiado_de após criar tabela global
-- (aplicado abaixo após CREATE catalogo_treinamentos_globais)

-- 2) Versões publicadas globalmente (aprovadas pelo Master)
CREATE TABLE IF NOT EXISTS public.catalogo_treinamentos_globais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linhagem_id uuid NOT NULL,
  versao int NOT NULL,
  titulo text NOT NULL,
  conteudo_programatico text,
  objetivo text,
  carga_horaria numeric(6,1),
  categoria text,
  nivel text CHECK (nivel IS NULL OR nivel IN ('basico', 'intermediario', 'avancado')),
  modalidade text CHECK (modalidade IS NULL OR modalidade IN ('presencial', 'online', 'hibrido')),
  imagem_url text,
  status text NOT NULL DEFAULT 'publicado'
    CHECK (status IN ('publicado', 'despublicado')),
  origem_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  origem_catalogo_id uuid,
  submissao_id uuid,
  aprovado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  aprovado_em timestamptz,
  despublicado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  despublicado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (linhagem_id, versao)
);

CREATE INDEX IF NOT EXISTS idx_cat_globais_linhagem ON public.catalogo_treinamentos_globais (linhagem_id);
CREATE INDEX IF NOT EXISTS idx_cat_globais_status_cat ON public.catalogo_treinamentos_globais (status, categoria);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalogo_treinamentos_copiado_de_global_fk'
  ) THEN
    ALTER TABLE public.catalogo_treinamentos
      ADD CONSTRAINT catalogo_treinamentos_copiado_de_global_fk
      FOREIGN KEY (copiado_de_global_id)
      REFERENCES public.catalogo_treinamentos_globais(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_catalogo_globais_updated ON public.catalogo_treinamentos_globais;
CREATE TRIGGER trg_catalogo_globais_updated
  BEFORE UPDATE ON public.catalogo_treinamentos_globais
  FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

-- 3) Submissões (fila de moderação)
CREATE TABLE IF NOT EXISTS public.catalogo_global_submissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  catalogo_local_id uuid NOT NULL REFERENCES public.catalogo_treinamentos(id) ON DELETE CASCADE,
  linhagem_id uuid NOT NULL,
  versao int NOT NULL,
  titulo text NOT NULL,
  conteudo_programatico text,
  objetivo text,
  carga_horaria numeric(6,1),
  categoria text,
  nivel text CHECK (nivel IS NULL OR nivel IN ('basico', 'intermediario', 'avancado')),
  modalidade text CHECK (modalidade IS NULL OR modalidade IN ('presencial', 'online', 'hibrido')),
  imagem_url text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovado', 'reprovado', 'cancelado')),
  revisado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  revisado_em timestamptz,
  motivo_reprovacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cat_subm_tenant ON public.catalogo_global_submissoes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cat_subm_status ON public.catalogo_global_submissoes (status);
CREATE INDEX IF NOT EXISTS idx_cat_subm_local ON public.catalogo_global_submissoes (catalogo_local_id);

ALTER TABLE public.catalogo_treinamentos_globais
  DROP CONSTRAINT IF EXISTS catalogo_treinamentos_globais_submissao_fk;

ALTER TABLE public.catalogo_treinamentos_globais
  ADD CONSTRAINT catalogo_treinamentos_globais_submissao_fk
  FOREIGN KEY (submissao_id) REFERENCES public.catalogo_global_submissoes(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_catalogo_subm_updated ON public.catalogo_global_submissoes;
CREATE TRIGGER trg_catalogo_subm_updated
  BEFORE UPDATE ON public.catalogo_global_submissoes
  FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

-- 4) Opt-in por tenant + categoria
CREATE TABLE IF NOT EXISTS public.tenant_catalogo_global_categorias (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  opt_in boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, categoria)
);

-- 5) Auditoria (Master visualiza; inserções a partir da aplicação)
CREATE TABLE IF NOT EXISTS public.auditoria_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ator_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id text,
  detalhes jsonb,
  ip_address text,
  user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_criado ON public.auditoria_eventos (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_ator ON public.auditoria_eventos (ator_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON public.auditoria_eventos (entidade, entidade_id);

-- RLS
ALTER TABLE public.catalogo_treinamentos_globais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_global_submissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_catalogo_global_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cat_globais_select_master" ON public.catalogo_treinamentos_globais;
CREATE POLICY "cat_globais_select_master"
  ON public.catalogo_treinamentos_globais FOR SELECT TO authenticated
  USING (public.is_current_user_master());

DROP POLICY IF EXISTS "cat_globais_select_consumer" ON public.catalogo_treinamentos_globais;
CREATE POLICY "cat_globais_select_consumer"
  ON public.catalogo_treinamentos_globais FOR SELECT TO authenticated
  USING (
    status = 'publicado'
    AND EXISTS (
      SELECT 1
      FROM public.tenant_catalogo_global_categorias tgc
      JOIN public.usuarios u ON u.tenant_id = tgc.tenant_id
      WHERE u.id = auth.uid()
        AND tgc.opt_in = true
        AND tgc.categoria = catalogo_treinamentos_globais.categoria
    )
  );

DROP POLICY IF EXISTS "cat_globais_all_master" ON public.catalogo_treinamentos_globais;
CREATE POLICY "cat_globais_all_master"
  ON public.catalogo_treinamentos_globais FOR ALL TO authenticated
  USING (public.is_current_user_master())
  WITH CHECK (public.is_current_user_master());

DROP POLICY IF EXISTS "cat_subm_select" ON public.catalogo_global_submissoes;
CREATE POLICY "cat_subm_select"
  ON public.catalogo_global_submissoes FOR SELECT TO authenticated
  USING (
    public.is_current_user_master()
    OR tenant_id = (SELECT u.tenant_id FROM public.usuarios u WHERE u.id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "cat_subm_insert" ON public.catalogo_global_submissoes;
CREATE POLICY "cat_subm_insert"
  ON public.catalogo_global_submissoes FOR INSERT TO authenticated
  WITH CHECK (
    (NOT public.is_current_user_master())
    AND tenant_id = (SELECT u.tenant_id FROM public.usuarios u WHERE u.id = auth.uid() LIMIT 1)
    AND (
      public.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM public.perfil_permissoes pp
        JOIN public.usuarios u ON u.perfil_id = pp.perfil_id
        WHERE u.id = auth.uid()
          AND pp.permissao = 'gerenciar_catalogo'
      )
    )
  );

DROP POLICY IF EXISTS "cat_subm_delete_tenant_pendente" ON public.catalogo_global_submissoes;
CREATE POLICY "cat_subm_delete_tenant_pendente"
  ON public.catalogo_global_submissoes FOR DELETE TO authenticated
  USING (
    status = 'pendente'
    AND tenant_id = (SELECT u.tenant_id FROM public.usuarios u WHERE u.id = auth.uid() LIMIT 1)
    AND (
      public.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM public.perfil_permissoes pp
        JOIN public.usuarios u ON u.perfil_id = pp.perfil_id
        WHERE u.id = auth.uid()
          AND pp.permissao = 'gerenciar_catalogo'
      )
    )
  );

DROP POLICY IF EXISTS "cat_subm_update_master" ON public.catalogo_global_submissoes;
CREATE POLICY "cat_subm_update_master"
  ON public.catalogo_global_submissoes FOR UPDATE TO authenticated
  USING (public.is_current_user_master())
  WITH CHECK (public.is_current_user_master());

DROP POLICY IF EXISTS "tgc_select" ON public.tenant_catalogo_global_categorias;
CREATE POLICY "tgc_select"
  ON public.tenant_catalogo_global_categorias FOR SELECT TO authenticated
  USING (
    public.is_current_user_master()
    OR tenant_id = (SELECT u.tenant_id FROM public.usuarios u WHERE u.id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "tgc_modify" ON public.tenant_catalogo_global_categorias;
CREATE POLICY "tgc_modify"
  ON public.tenant_catalogo_global_categorias FOR ALL TO authenticated
  USING (
    public.is_current_user_master()
    OR (
      tenant_id = (SELECT u.tenant_id FROM public.usuarios u WHERE u.id = auth.uid() LIMIT 1)
      AND (
        public.is_current_user_admin()
        OR EXISTS (
          SELECT 1 FROM public.perfil_permissoes pp
          JOIN public.usuarios u ON u.perfil_id = pp.perfil_id
          WHERE u.id = auth.uid()
            AND pp.permissao = 'gerenciar_catalogo'
        )
      )
    )
  )
  WITH CHECK (
    public.is_current_user_master()
    OR (
      tenant_id = (SELECT u.tenant_id FROM public.usuarios u WHERE u.id = auth.uid() LIMIT 1)
      AND (
        public.is_current_user_admin()
        OR EXISTS (
          SELECT 1 FROM public.perfil_permissoes pp
          JOIN public.usuarios u ON u.perfil_id = pp.perfil_id
          WHERE u.id = auth.uid()
            AND pp.permissao = 'gerenciar_catalogo'
        )
      )
    )
  );

DROP POLICY IF EXISTS "auditoria_select_master" ON public.auditoria_eventos;
CREATE POLICY "auditoria_select_master"
  ON public.auditoria_eventos FOR SELECT TO authenticated
  USING (public.is_current_user_master());

DROP POLICY IF EXISTS "auditoria_insert_authenticated" ON public.auditoria_eventos;
CREATE POLICY "auditoria_insert_authenticated"
  ON public.auditoria_eventos FOR INSERT TO authenticated
  WITH CHECK (ator_id = auth.uid() OR public.is_current_user_master());

COMMENT ON TABLE public.catalogo_treinamentos_globais IS 'Versões aprovadas do catálogo global TrainHub.';
COMMENT ON TABLE public.catalogo_global_submissoes IS 'Fila de moderação Master; criada ao publicar (ativo) item com consentimento pool global.';
COMMENT ON TABLE public.tenant_catalogo_global_categorias IS 'Opt-in por categoria para exibir itens globais na vitrine (default opt_in=false).';

-- Módulo Catálogo (consumo): tenant_modulos + preferências, favoritos e avaliações.
-- Depende: catalogo_treinamentos, usuarios, tenants, is_current_user_master(), update_atualizado_em()

-- Habilita módulo catálogo para tenants existentes (novos: inserir manualmente ou via app)
INSERT INTO tenant_modulos (tenant_id, modulo, ativo)
SELECT id, 'catalogo', true FROM tenants
ON CONFLICT (tenant_id, modulo) DO NOTHING;

-- Preferências de aprendizado (recomendações)
CREATE TABLE IF NOT EXISTS usuario_catalogo_preferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  categorias TEXT[] NOT NULL DEFAULT '{}',
  niveis TEXT[] NOT NULL DEFAULT '{}',
  modalidades TEXT[] NOT NULL DEFAULT '{}',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_ucp_tenant ON usuario_catalogo_preferencias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ucp_usuario ON usuario_catalogo_preferencias(usuario_id);

ALTER TABLE usuario_catalogo_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ucp_select"
  ON usuario_catalogo_preferencias FOR SELECT TO authenticated
  USING (
    (
      public.is_current_user_master()
      AND usuario_id = auth.uid()
    )
    OR (
      usuario_id = auth.uid()
      AND tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "ucp_insert"
  ON usuario_catalogo_preferencias FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND (
      (
        public.is_current_user_master()
        AND EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id)
      )
      OR tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "ucp_update"
  ON usuario_catalogo_preferencias FOR UPDATE TO authenticated
  USING (
    (
      public.is_current_user_master()
      AND usuario_id = auth.uid()
    )
    OR (
      usuario_id = auth.uid()
      AND tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    usuario_id = auth.uid()
    AND (
      (
        public.is_current_user_master()
        AND EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id)
      )
      OR tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "ucp_delete"
  ON usuario_catalogo_preferencias FOR DELETE TO authenticated
  USING (
    (
      public.is_current_user_master()
      AND usuario_id = auth.uid()
    )
    OR (
      usuario_id = auth.uid()
      AND tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
    )
  );

DROP TRIGGER IF EXISTS trg_ucp_updated ON usuario_catalogo_preferencias;
CREATE TRIGGER trg_ucp_updated
  BEFORE UPDATE ON usuario_catalogo_preferencias
  FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

-- Favoritos (salvar para depois)
CREATE TABLE IF NOT EXISTS catalogo_favoritos (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalogo_treinamento_id UUID NOT NULL REFERENCES catalogo_treinamentos(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, catalogo_treinamento_id)
);

CREATE INDEX IF NOT EXISTS idx_cat_fav_tenant ON catalogo_favoritos(tenant_id);

ALTER TABLE catalogo_favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_fav_select"
  ON catalogo_favoritos FOR SELECT TO authenticated
  USING (
    public.is_current_user_master()
    OR tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "cat_fav_insert"
  ON catalogo_favoritos FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND (
      (
        public.is_current_user_master()
        AND EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id)
      )
      OR tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "cat_fav_delete"
  ON catalogo_favoritos FOR DELETE TO authenticated
  USING (
    public.is_current_user_master()
    OR (
      usuario_id = auth.uid()
      AND tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
    )
  );

-- Avaliações internas (1–5)
CREATE TABLE IF NOT EXISTS catalogo_avaliacoes (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalogo_treinamento_id UUID NOT NULL REFERENCES catalogo_treinamentos(id) ON DELETE CASCADE,
  nota SMALLINT NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, catalogo_treinamento_id)
);

CREATE INDEX IF NOT EXISTS idx_cat_aval_catalogo ON catalogo_avaliacoes(catalogo_treinamento_id, tenant_id);

ALTER TABLE catalogo_avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_aval_select"
  ON catalogo_avaliacoes FOR SELECT TO authenticated
  USING (
    public.is_current_user_master()
    OR tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "cat_aval_insert"
  ON catalogo_avaliacoes FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND (
      (
        public.is_current_user_master()
        AND EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id)
      )
      OR tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "cat_aval_update"
  ON catalogo_avaliacoes FOR UPDATE TO authenticated
  USING (
    usuario_id = auth.uid()
    AND (
      (
        public.is_current_user_master()
        AND EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id)
      )
      OR tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    usuario_id = auth.uid()
    AND (
      (
        public.is_current_user_master()
        AND EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id)
      )
      OR tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "cat_aval_delete"
  ON catalogo_avaliacoes FOR DELETE TO authenticated
  USING (
    public.is_current_user_master()
    OR (
      usuario_id = auth.uid()
      AND tenant_id = (SELECT tenant_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
    )
  );

DROP TRIGGER IF EXISTS trg_cat_aval_updated ON catalogo_avaliacoes;
CREATE TRIGGER trg_cat_aval_updated
  BEFORE UPDATE ON catalogo_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

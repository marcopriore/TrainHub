-- Flag global (Master): exibir ou ocultar o módulo Catálogo de Treinamentos em toda a plataforma.
-- Default false = módulo oculto até o Master reativar em Configurações → Plataforma.

CREATE TABLE IF NOT EXISTS public.platform_feature_flags (
  id text PRIMARY KEY CHECK (id = 'singleton'),
  catalogo_trainings_module_enabled boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL
);

INSERT INTO public.platform_feature_flags (id, catalogo_trainings_module_enabled)
VALUES ('singleton', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_flags_select_all" ON public.platform_feature_flags;
CREATE POLICY "platform_flags_select_all"
  ON public.platform_feature_flags FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "platform_flags_update_master" ON public.platform_feature_flags;
CREATE POLICY "platform_flags_update_master"
  ON public.platform_feature_flags FOR UPDATE TO authenticated
  USING (public.is_current_user_master())
  WITH CHECK (public.is_current_user_master());

COMMENT ON TABLE public.platform_feature_flags IS 'Flags globais da plataforma (uma linha id=singleton).';

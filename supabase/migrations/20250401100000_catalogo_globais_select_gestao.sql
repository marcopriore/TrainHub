-- Permite que admin / gerenciar_catalogo listem todo o catálogo global publicado (importação na gestão),
-- independentemente do opt-in da vitrine (opt-in continua valendo só para colaboradores).

DROP POLICY IF EXISTS "cat_globais_select_gestao" ON public.catalogo_treinamentos_globais;
CREATE POLICY "cat_globais_select_gestao"
  ON public.catalogo_treinamentos_globais FOR SELECT TO authenticated
  USING (
    status = 'publicado'
    AND (
      public.is_current_user_master()
      OR public.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM public.perfil_permissoes pp
        JOIN public.usuarios u ON u.perfil_id = pp.perfil_id
        WHERE u.id = auth.uid()
          AND pp.permissao = 'gerenciar_catalogo'
      )
    )
  );

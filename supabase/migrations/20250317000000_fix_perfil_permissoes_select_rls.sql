-- Restringe SELECT em perfil_permissoes ao próprio perfil do usuário ou master.
-- Substitui política permissiva (USING true) introduzida em 20250312000000.

DROP POLICY IF EXISTS "perfil_permissoes_select" ON perfil_permissoes;

CREATE POLICY "perfil_permissoes_select"
ON perfil_permissoes FOR SELECT TO authenticated
USING (
  public.is_current_user_master()
  OR perfil_id IN (
    SELECT perfil_id FROM usuarios
    WHERE id = auth.uid() AND perfil_id IS NOT NULL
  )
);

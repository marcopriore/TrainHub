-- Permite que Master gerencie perfil_permissoes (INSERT, UPDATE, DELETE)
-- SELECT já existe para usuários autenticados

DROP POLICY IF EXISTS "perfil_permissoes_usuarios_read" ON perfil_permissoes;

CREATE POLICY "perfil_permissoes_select"
ON perfil_permissoes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "perfil_permissoes_master_modify"
ON perfil_permissoes FOR INSERT TO authenticated
WITH CHECK (public.is_current_user_master());

CREATE POLICY "perfil_permissoes_master_update"
ON perfil_permissoes FOR UPDATE TO authenticated
USING (public.is_current_user_master())
WITH CHECK (public.is_current_user_master());

CREATE POLICY "perfil_permissoes_master_delete"
ON perfil_permissoes FOR DELETE TO authenticated
USING (public.is_current_user_master());

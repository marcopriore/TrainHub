-- RLS: Permitir que usuários master leiam e gerenciem dados de qualquer tenant.
-- O master seleciona o tenant pelo TenantSelector; as queries usam getActiveTenantId.
--
-- Execute no Supabase SQL Editor: Dashboard > SQL Editor

-- Função auxiliar: retorna true se o usuário atual é master
CREATE OR REPLACE FUNCTION public.is_current_user_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_master FROM public.usuarios WHERE id = auth.uid()),
    false
  );
$$;

-- ========== TENANTS ==========
-- Master pode ler todos os tenants (para o TenantSelector)
-- Usuário normal pode ler apenas seu próprio tenant
DROP POLICY IF EXISTS "Usuário pode ler seu tenant" ON tenants;
CREATE POLICY "Usuários podem ler tenants conforme permissão"
ON tenants FOR SELECT TO authenticated
USING (
  public.is_current_user_master()
  OR id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid() AND tenant_id IS NOT NULL)
);

-- Master: todas as operações em tenants (para painel de gestão)
-- Usuário normal: sem acesso direto a tenants
DROP POLICY IF EXISTS "tenants_master_all" ON tenants;
CREATE POLICY "Master pode gerenciar tenants"
ON tenants FOR ALL TO authenticated
USING (public.is_current_user_master())
WITH CHECK (public.is_current_user_master());

-- ========== PERFIS ==========
-- Master precisa ler perfis de qualquer tenant (ao adicionar usuário)
DROP POLICY IF EXISTS "Usuário pode ler seu perfil" ON perfis;
CREATE POLICY "Usuários podem ler perfis conforme permissão"
ON perfis FOR SELECT TO authenticated
USING (
  public.is_current_user_master()
  OR id IN (SELECT perfil_id FROM usuarios WHERE id = auth.uid() AND perfil_id IS NOT NULL)
);

-- Master: inserir/atualizar perfis em qualquer tenant
DROP POLICY IF EXISTS "perfis_master_all" ON perfis;
CREATE POLICY "Master pode gerenciar perfis"
ON perfis FOR ALL TO authenticated
USING (public.is_current_user_master())
WITH CHECK (public.is_current_user_master());

-- ========== USUARIOS ==========
-- Master precisa ler usuários de qualquer tenant (gestão na tela de edit tenant)
DROP POLICY IF EXISTS "Usuário pode ler seu próprio registro" ON usuarios;
CREATE POLICY "Usuários podem ler conforme permissão"
ON usuarios FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_current_user_master()
);

-- Master: inserir/atualizar usuarios em qualquer tenant
DROP POLICY IF EXISTS "usuarios_master_all" ON usuarios;
CREATE POLICY "Master pode gerenciar usuarios"
ON usuarios FOR ALL TO authenticated
USING (public.is_current_user_master())
WITH CHECK (public.is_current_user_master());

-- ========== SETORES ==========
DROP POLICY IF EXISTS "setores_tenant_policy" ON setores;
DROP POLICY IF EXISTS "setores_tenant_read" ON setores;
DROP POLICY IF EXISTS "setores_policy" ON setores;
CREATE POLICY "Setores: usuário ou master"
ON setores FOR ALL TO authenticated
USING (
  public.is_current_user_master()
  OR tenant_id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid() AND tenant_id IS NOT NULL)
)
WITH CHECK (
  public.is_current_user_master()
  OR tenant_id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid() AND tenant_id IS NOT NULL)
);

-- ========== EMPRESAS_PARCEIRAS ==========
DROP POLICY IF EXISTS "empresas_parceiras_tenant_policy" ON empresas_parceiras;
DROP POLICY IF EXISTS "empresas_parceiras_tenant_read" ON empresas_parceiras;
DROP POLICY IF EXISTS "empresas_parceiras_policy" ON empresas_parceiras;
CREATE POLICY "Empresas parceiras: usuário ou master"
ON empresas_parceiras FOR ALL TO authenticated
USING (
  public.is_current_user_master()
  OR tenant_id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid() AND tenant_id IS NOT NULL)
)
WITH CHECK (
  public.is_current_user_master()
  OR tenant_id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid() AND tenant_id IS NOT NULL)
);

-- ========== COLABORADORES ==========
DROP POLICY IF EXISTS "colaboradores_tenant_policy" ON colaboradores;
DROP POLICY IF EXISTS "colaboradores_tenant_read" ON colaboradores;
DROP POLICY IF EXISTS "colaboradores_policy" ON colaboradores;
CREATE POLICY "Colaboradores: usuário ou master"
ON colaboradores FOR ALL TO authenticated
USING (
  public.is_current_user_master()
  OR tenant_id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid() AND tenant_id IS NOT NULL)
)
WITH CHECK (
  public.is_current_user_master()
  OR tenant_id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid() AND tenant_id IS NOT NULL)
);

-- ========== TREINAMENTOS ==========
DROP POLICY IF EXISTS "treinamentos_tenant_policy" ON treinamentos;
DROP POLICY IF EXISTS "treinamentos_tenant_read" ON treinamentos;
DROP POLICY IF EXISTS "treinamentos_policy" ON treinamentos;
CREATE POLICY "Treinamentos: usuário ou master"
ON treinamentos FOR ALL TO authenticated
USING (
  public.is_current_user_master()
  OR tenant_id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid() AND tenant_id IS NOT NULL)
)
WITH CHECK (
  public.is_current_user_master()
  OR tenant_id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid() AND tenant_id IS NOT NULL)
);

-- ========== TREINAMENTO_COLABORADORES ==========
-- Acesso via join com treinamentos (tenant); usuário acessa treinamentos do seu tenant
-- Para simplificar: permitir se o usuário tem acesso ao treinamento correspondente
DROP POLICY IF EXISTS "treinamento_colaboradores_policy" ON treinamento_colaboradores;
DROP POLICY IF EXISTS "treinamento_colaboradores_read" ON treinamento_colaboradores;
CREATE POLICY "Treinamento colaboradores: usuário ou master"
ON treinamento_colaboradores FOR ALL TO authenticated
USING (
  public.is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM treinamentos t
    WHERE t.id = treinamento_colaboradores.treinamento_id
    AND t.tenant_id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid() AND tenant_id IS NOT NULL)
  )
)
WITH CHECK (
  public.is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM treinamentos t
    WHERE t.id = treinamento_colaboradores.treinamento_id
    AND t.tenant_id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid() AND tenant_id IS NOT NULL)
  )
);

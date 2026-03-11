-- Corrige políticas RLS para o UserProvider carregar dados após o login.
--
-- A política genérica baseada em get_tenant_id() pode falhar na primeira
-- chamada quando o usuário ainda não tem tenant_id carregado.
--
-- Execute este script no Supabase SQL Editor (Dashboard > SQL Editor).

-- ========== USUARIOS ==========
-- Remove políticas existentes que possam estar bloqueando
DROP POLICY IF EXISTS "Usuarios tenant policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_tenant_policy" ON usuarios;
DROP POLICY IF EXISTS "Enable read for tenant users" ON usuarios;
DROP POLICY IF EXISTS "Usuários podem ler dados do tenant" ON usuarios;

-- Usuário autenticado pode ler seu próprio registro (essencial para UserProvider)
CREATE POLICY "Usuário pode ler seu próprio registro"
ON usuarios FOR SELECT TO authenticated
USING (id = auth.uid());

-- ========== TENANTS ==========
-- Permite ler o tenant do próprio usuário (necessário para o JOIN na query)
DROP POLICY IF EXISTS "tenants_usuarios_read" ON tenants;
CREATE POLICY "Usuário pode ler seu tenant"
ON tenants FOR SELECT TO authenticated
USING (
  id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid())
);

-- ========== PERFIS ==========
-- Permite ler o perfil do próprio usuário (necessário para o JOIN na query)
DROP POLICY IF EXISTS "perfis_usuarios_read" ON perfis;
CREATE POLICY "Usuário pode ler seu perfil"
ON perfis FOR SELECT TO authenticated
USING (
  id IN (SELECT perfil_id FROM usuarios WHERE id = auth.uid() AND perfil_id IS NOT NULL)
);

-- ========== PERFIL_PERMISSOES ==========
-- Permite ler permissões do perfil do próprio usuário
DROP POLICY IF EXISTS "perfil_permissoes_usuarios_read" ON perfil_permissoes;
CREATE POLICY "Usuário pode ler permissões do seu perfil"
ON perfil_permissoes FOR SELECT TO authenticated
USING (
  perfil_id IN (SELECT perfil_id FROM usuarios WHERE id = auth.uid() AND perfil_id IS NOT NULL)
);

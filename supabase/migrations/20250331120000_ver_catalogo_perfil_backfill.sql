-- Permissão ver_catalogo: vitrine do catálogo (além do módulo tenant_modulos).
-- Concede acesso de leitura/vitrine a perfis que ainda não têm nenhuma permissão de catálogo,
-- preservando o comportamento anterior em que o módulo ativo bastava para colaboradores comuns.

INSERT INTO perfil_permissoes (perfil_id, permissao)
SELECT p.id, 'ver_catalogo'
FROM perfis p
WHERE COALESCE(p.is_admin, false) = false
  AND NOT EXISTS (
    SELECT 1
    FROM perfil_permissoes pp
    WHERE pp.perfil_id = p.id
      AND pp.permissao IN ('ver_catalogo', 'gerenciar_catalogo')
  );

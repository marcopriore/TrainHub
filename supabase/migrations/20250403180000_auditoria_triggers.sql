-- Auditoria automática: INSERT/UPDATE/DELETE em tabelas operacionais + resolução de tenant.
-- Login e importação em lote continuam com insert explícito no app (sem trigger em auth.users).

CREATE OR REPLACE FUNCTION public.auditoria_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_old jsonb;
  v_tenant uuid;
  v_pk text;
  v_acao text;
  v_detalhes jsonb;
BEGIN
  IF TG_TABLE_NAME = 'auditoria_eventos' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    v_old := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
    IF TG_OP = 'UPDATE' THEN
      v_old := to_jsonb(OLD);
    END IF;
  END IF;

  -- Chave lógica do registro
  v_pk := v_row->>'id';
  IF v_pk IS NULL OR v_pk = '' THEN
    CASE TG_TABLE_NAME
      WHEN 'catalogo_favoritos' THEN
        v_pk := coalesce(v_row->>'usuario_id', v_old->>'usuario_id') || ':' ||
                coalesce(v_row->>'catalogo_treinamento_id', v_old->>'catalogo_treinamento_id');
      WHEN 'tenant_catalogo_global_categorias' THEN
        v_pk := coalesce(v_row->>'tenant_id', v_old->>'tenant_id') || ':' ||
                coalesce(v_row->>'categoria', v_old->>'categoria');
      ELSE
        v_pk := md5(coalesce(v_row::text, v_old::text, ''::text));
    END CASE;
  END IF;

  -- Tenant do evento
  v_tenant := nullif(v_row->>'tenant_id', '')::uuid;
  IF v_tenant IS NULL AND TG_OP = 'DELETE' THEN
    v_tenant := nullif(v_old->>'tenant_id', '')::uuid;
  END IF;

  IF v_tenant IS NULL THEN
    CASE TG_TABLE_NAME
      WHEN 'tenants' THEN
        v_tenant := coalesce(
          nullif(v_row->>'id', '')::uuid,
          nullif(v_old->>'id', '')::uuid
        );
      WHEN 'treinamento_colaboradores' THEN
        SELECT t.tenant_id INTO v_tenant
        FROM treinamentos t
        WHERE t.id = coalesce(
          nullif(v_row->>'treinamento_id', '')::uuid,
          nullif(v_old->>'treinamento_id', '')::uuid
        )
        LIMIT 1;
      WHEN 'treinamento_parceiros' THEN
        SELECT t.tenant_id INTO v_tenant
        FROM treinamentos t
        WHERE t.id = coalesce(
          nullif(v_row->>'treinamento_id', '')::uuid,
          nullif(v_old->>'treinamento_id', '')::uuid
        )
        LIMIT 1;
      WHEN 'perfil_permissoes' THEN
        SELECT p.tenant_id INTO v_tenant
        FROM perfis p
        WHERE p.id = coalesce(
          nullif(v_row->>'perfil_id', '')::uuid,
          nullif(v_old->>'perfil_id', '')::uuid
        )
        LIMIT 1;
      WHEN 'pesquisa_perguntas' THEN
        SELECT f.tenant_id INTO v_tenant
        FROM pesquisa_formularios f
        WHERE f.id = coalesce(
          nullif(v_row->>'formulario_id', '')::uuid,
          nullif(v_old->>'formulario_id', '')::uuid
        )
        LIMIT 1;
      WHEN 'avaliacao_perguntas' THEN
        SELECT f.tenant_id INTO v_tenant
        FROM avaliacao_formularios f
        WHERE f.id = coalesce(
          nullif(v_row->>'formulario_id', '')::uuid,
          nullif(v_old->>'formulario_id', '')::uuid
        )
        LIMIT 1;
      ELSE
        NULL;
    END CASE;
  END IF;

  v_acao := lower(TG_OP) || '_' || TG_TABLE_NAME;

  v_detalhes := jsonb_build_object(
    'operacao', TG_OP,
    'tabela', TG_TABLE_NAME
  );

  IF TG_OP = 'UPDATE' AND v_old IS NOT NULL THEN
    DECLARE
      v_antes jsonb := '{}'::jsonb;
      v_depois jsonb := '{}'::jsonb;
      k text;
    BEGIN
      FOR k IN
        SELECT DISTINCT u.key
        FROM (
          SELECT jsonb_object_keys(v_row) AS key
          UNION
          SELECT jsonb_object_keys(v_old) AS key
        ) AS u
      LOOP
        IF k IN ('atualizado_em', 'criado_em') THEN
          CONTINUE;
        END IF;
        IF (v_old -> k) IS DISTINCT FROM (v_row -> k) THEN
          v_antes := v_antes || jsonb_build_object(k, v_old -> k);
          v_depois := v_depois || jsonb_build_object(k, v_row -> k);
        END IF;
      END LOOP;
      IF v_antes <> '{}'::jsonb THEN
        v_detalhes := v_detalhes || jsonb_build_object('antes', v_antes, 'depois', v_depois);
      END IF;
    END;
  END IF;

  INSERT INTO public.auditoria_eventos (
    ator_id,
    tenant_id,
    acao,
    entidade,
    entidade_id,
    detalhes
  )
  VALUES (
    v_uid,
    v_tenant,
    v_acao,
    TG_TABLE_NAME,
    v_pk,
    v_detalhes
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Anexa trigger se a tabela existir (instalações antigas / parciais)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'tenants',
    'usuarios',
    'perfis',
    'perfil_permissoes',
    'tenant_modulos',
    'setores',
    'categorias',
    'empresas_parceiras',
    'colaboradores',
    'treinamentos',
    'treinamento_colaboradores',
    'treinamento_parceiros',
    'catalogo_treinamentos',
    'certificado_templates',
    'pesquisa_formularios',
    'pesquisa_perguntas',
    'pesquisa_tokens',
    'pesquisa_respostas',
    'avaliacao_formularios',
    'avaliacao_perguntas',
    'avaliacao_tokens',
    'avaliacao_respostas',
    'usuario_catalogo_preferencias',
    'catalogo_favoritos',
    'catalogo_avaliacoes',
    'tenant_catalogo_global_categorias',
    'catalogo_global_submissoes',
    'catalogo_treinamentos_globais',
    'platform_feature_flags',
    'notificacoes',
    'usuario_notificacoes_config'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_auditoria_%I ON public.%I',
        t,
        t
      );
      EXECUTE format(
        'CREATE TRIGGER trg_auditoria_%I
           AFTER INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.auditoria_trigger_fn()',
        t,
        t
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.auditoria_trigger_fn() IS
  'Registra INSERT/UPDATE/DELETE em auditoria_eventos (ator=auth.uid(), tenant inferido).';

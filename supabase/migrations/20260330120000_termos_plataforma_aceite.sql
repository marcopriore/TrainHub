-- Aceite de termos da plataforma (versão atual definida no app em lib/termos-plataforma.ts).
-- Atualização apenas via RPC (evita UPDATE amplo em usuarios pelo cliente).

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS termos_plataforma_versao text,
  ADD COLUMN IF NOT EXISTS termos_plataforma_aceitos_em timestamptz;

COMMENT ON COLUMN public.usuarios.termos_plataforma_versao IS 'Última versão dos termos/políticas aceite pelo usuário (string livre, alinhada ao front).';
COMMENT ON COLUMN public.usuarios.termos_plataforma_aceitos_em IS 'Quando o usuário aceitou essa versão.';

CREATE OR REPLACE FUNCTION public.aceitar_termos_plataforma(p_versao text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_versao IS NULL OR length(trim(p_versao)) = 0 THEN
    RAISE EXCEPTION 'versao obrigatoria';
  END IF;
  UPDATE public.usuarios
  SET termos_plataforma_versao = trim(p_versao),
      termos_plataforma_aceitos_em = now()
  WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'usuario_nao_encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.aceitar_termos_plataforma(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aceitar_termos_plataforma(text) TO authenticated;

COMMENT ON FUNCTION public.aceitar_termos_plataforma(text) IS 'Registra aceite dos termos/políticas da plataforma para auth.uid().';

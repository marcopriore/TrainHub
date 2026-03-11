-- Adiciona coluna email na tabela colaboradores para vincular ao usuário logado
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS email TEXT;

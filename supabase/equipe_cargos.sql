-- Execute uma vez no banco Supabase antes de publicar a versão que usa role_title.
-- O valor inicial preserva os cadastros existentes; o administrador poderá editá-lo.
ALTER TABLE public.platform_admin_members
  ADD COLUMN IF NOT EXISTS role_title text NOT NULL DEFAULT 'Cargo a definir';

-- Remove somente o segundo cadastro fictício original, caso ainda esteja intacto.
DELETE FROM public.platform_admin_members
WHERE display_name = 'Segunda pessoa (editar)'
  AND role_title = 'Cargo a definir'
  AND user_id IS NULL
  AND email IS NULL
  AND is_active = false
  AND permissions = '{"traffic":{"view":false,"manage_plans":false,"manage_leads":false,"manage_campaigns":false},"support":{"view":false,"edit":false,"delete":false},"providers":{"view":false,"edit":false,"delete":false},"finance":{"view":false,"edit":false,"delete":false}}'::jsonb;

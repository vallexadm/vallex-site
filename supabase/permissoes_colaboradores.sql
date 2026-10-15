-- Permissões por colaborador nos módulos operacionais.
-- A regra padrão preserva o acesso atual a Orçamentos e à Agenda atribuída,
-- mantendo Clientes, Serviços e Financeiro restritos ao proprietário.
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{
    "customers": {"view": false, "manage": false},
    "quotes": {"view": true, "create": true, "edit": true},
    "agenda": {"view": true, "updateAssigned": true, "manage": false},
    "services": {"view": false, "manage": false},
    "finance": {"view": false, "manage": false}
  }'::jsonb;

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_permissions_object;

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_permissions_object
  CHECK (jsonb_typeof(permissions) = 'object');

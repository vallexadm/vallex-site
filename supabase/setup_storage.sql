-- Buckets usados pela logo pública da Vitrine e pelos anexos privados de orçamento.
-- Os uploads e downloads passam pelas rotas autenticadas do servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'vallex-logos',
    'vallex-logos',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'vallex-orcamentos',
    'vallex-orcamentos',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Tokens aleatórios permitem compartilhar anexos sem expor a URL assinada extensa.
-- O endpoint público só redireciona enquanto expires_at ainda estiver válido.
create table if not exists public.quote_file_links (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{16}$'),
  organization_id uuid not null,
  quote_id uuid not null,
  storage_path text not null,
  download_name text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists quote_file_links_expires_at_idx
  on public.quote_file_links (expires_at);

alter table public.quote_file_links enable row level security;
revoke all on table public.quote_file_links from anon, authenticated;
grant all on table public.quote_file_links to service_role;

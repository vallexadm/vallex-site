-- Migração de produção para o módulo VALLEX de tráfego pago.
-- Preparada para revisão. Não executar até confirmar o projeto Supabase e fazer backup.
-- Cria somente estrutura e catálogo padrão; não insere leads nem usuários administrativos.

BEGIN;

CREATE TABLE IF NOT EXISTS public.traffic_service_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  price_label text NOT NULL DEFAULT 'Sob proposta',
  description text NOT NULL DEFAULT '',
  features text[] NOT NULL DEFAULT '{}',
  published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT traffic_service_plans_code_check CHECK (code IN ('local', 'crescimento', 'estrategico'))
);

-- Catálogo inicial necessário para a página pública. Não sobrescreve edições existentes.
INSERT INTO public.traffic_service_plans (code, name, tagline, price_label, description, features, sort_order)
VALUES
  ('local', 'Presença local', 'Para começar a aparecer para clientes da sua região.', 'Sob proposta', 'Estrutura inicial de campanha para divulgar seu negócio local.', ARRAY['Diagnóstico inicial', 'Configuração de campanha em um canal', 'Acompanhamento e resumo dos resultados'], 1),
  ('crescimento', 'Crescimento', 'Para ampliar a divulgação e acompanhar a evolução.', 'Sob proposta', 'Gestão contínua de campanhas com otimizações periódicas.', ARRAY['Planejamento de campanha', 'Acompanhamento e otimização periódicos', 'Relatório de desempenho'], 2),
  ('estrategico', 'Estratégia completa', 'Para negócios que precisam de uma gestão mais próxima.', 'Sob proposta', 'Estratégia de divulgação dimensionada conforme os objetivos do negócio.', ARRAY['Planejamento personalizado', 'Gestão de campanhas conforme escopo', 'Análise e apresentação dos resultados'], 3)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.traffic_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  audience text NOT NULL,
  organization_name text,
  plan_code text REFERENCES public.traffic_service_plans(code) ON UPDATE CASCADE ON DELETE SET NULL,
  need_description text NOT NULL,
  status text NOT NULL DEFAULT 'novo',
  service_value numeric(12,2),
  media_budget numeric(12,2),
  responsible_name text,
  source text NOT NULL DEFAULT 'pagina_trafego',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_path text,
  consent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT traffic_leads_audience_check CHECK (audience IN ('visitante', 'cliente', 'prestador')),
  CONSTRAINT traffic_leads_status_check CHECK (status IN ('novo', 'contato', 'proposta', 'negociacao', 'fechado', 'perdido')),
  CONSTRAINT traffic_leads_values_check CHECK ((service_value IS NULL OR service_value >= 0) AND (media_budget IS NULL OR media_budget >= 0))
);

ALTER TABLE public.traffic_leads
  ADD COLUMN IF NOT EXISTS responsible_name text;

CREATE TABLE IF NOT EXISTS public.traffic_lead_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.traffic_leads(id) ON DELETE CASCADE,
  actor_user_id uuid,
  event_type text NOT NULL DEFAULT 'nota',
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.traffic_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.traffic_leads(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'planejada',
  start_date date,
  end_date date,
  media_budget numeric(12,2) NOT NULL DEFAULT 0,
  amount_spent numeric(12,2) NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  leads_generated integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT traffic_campaigns_status_check CHECK (status IN ('planejada', 'ativa', 'pausada', 'concluida')),
  CONSTRAINT traffic_campaigns_metrics_check CHECK (media_budget >= 0 AND amount_spent >= 0 AND impressions >= 0 AND clicks >= 0 AND leads_generated >= 0 AND conversions >= 0)
);

-- Acesso administrativo delegado. A tabela começa vazia; o proprietário é validado
-- pelo SUPABASE_ADMIN_USER_ID e pode cadastrar pessoas pela tela de acessos.
CREATE TABLE IF NOT EXISTS public.platform_admin_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  role_title text NOT NULL DEFAULT 'Cargo a definir',
  email text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_admin_members_email_check CHECK (email IS NULL OR email = lower(email))
);

ALTER TABLE public.platform_admin_members
  ADD COLUMN IF NOT EXISTS role_title text NOT NULL DEFAULT 'Cargo a definir';

CREATE UNIQUE INDEX IF NOT EXISTS platform_admin_members_user_id_idx
  ON public.platform_admin_members (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS platform_admin_members_email_idx
  ON public.platform_admin_members (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS traffic_leads_created_at_idx ON public.traffic_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS traffic_leads_status_idx ON public.traffic_leads (status);
CREATE INDEX IF NOT EXISTS traffic_campaigns_lead_id_idx ON public.traffic_campaigns (lead_id);

ALTER TABLE public.traffic_service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_lead_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.traffic_leads, public.traffic_lead_activity, public.traffic_campaigns FROM anon, authenticated;
REVOKE ALL ON public.traffic_service_plans FROM anon, authenticated;
REVOKE ALL ON public.platform_admin_members FROM anon, authenticated;
GRANT ALL ON public.traffic_service_plans, public.traffic_leads, public.traffic_lead_activity, public.traffic_campaigns, public.platform_admin_members TO service_role;

COMMIT;

-- Add manual monthly payment methods (PIX and boleto) to VALLEX plan checkout.
-- Existing sessions keep the default CREDIT_CARD value.

alter table public.asaas_checkout_sessions
  add column if not exists billing_type text not null default 'CREDIT_CARD';

alter table public.asaas_checkout_sessions
  drop constraint if exists asaas_checkout_sessions_billing_type_check;

alter table public.asaas_checkout_sessions
  add constraint asaas_checkout_sessions_billing_type_check
  check (billing_type in ('CREDIT_CARD', 'PIX', 'BOLETO'));

comment on column public.asaas_checkout_sessions.billing_type is
  'Payment method selected for the Asaas plan checkout: CREDIT_CARD, PIX, or BOLETO.';

-- Aplicar no VALLEX-Teste antes de testar o novo registro de recebimento.
BEGIN;
CREATE TABLE IF NOT EXISTS public.organization_payment_requests (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  request_id uuid NOT NULL,
  payload jsonb NOT NULL,
  payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, request_id)
);
ALTER TABLE public.organization_payment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_payment_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_organization_service_payment_once(
  p_request_id uuid, p_organization_id uuid, p_service_record_id uuid,
  p_installment_number integer, p_installments_total integer, p_payment_method text,
  p_payment_date date, p_amount numeric, p_created_by uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payload jsonb;
  v_existing public.organization_payment_requests%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  v_payload := jsonb_build_array(p_service_record_id, p_installment_number,
    p_installments_total, p_payment_method, p_payment_date, p_amount, p_created_by);
  -- A chave única aguarda a transação concorrente; falhas desfazem também a reserva.
  INSERT INTO public.organization_payment_requests(organization_id,request_id,payload)
    VALUES(p_organization_id,p_request_id,v_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_existing FROM public.organization_payment_requests
    WHERE organization_id=p_organization_id AND request_id=p_request_id FOR UPDATE;
  IF v_existing.payload IS DISTINCT FROM v_payload THEN
    RAISE EXCEPTION 'REQUEST_PAYLOAD_CONFLICT';
  END IF;
  IF v_existing.payment_id IS NOT NULL THEN RETURN v_existing.payment_id; END IF;
  v_id := public.record_organization_service_payment(p_organization_id,
    p_service_record_id,p_installment_number,p_installments_total,p_payment_method,
    p_payment_date,p_amount,p_created_by);
  UPDATE public.organization_payment_requests SET payment_id=v_id
    WHERE organization_id=p_organization_id AND request_id=p_request_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_organization_service_payment_once(uuid,uuid,uuid,integer,integer,text,date,numeric,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_organization_service_payment_once(uuid,uuid,uuid,integer,integer,text,date,numeric,uuid) TO service_role;
COMMIT;

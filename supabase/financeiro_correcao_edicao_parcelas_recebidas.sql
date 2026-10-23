-- Correcao incremental para bancos com financeiro_edicao_historico.sql aplicado.
-- Nao altera tabelas nem registros; substitui somente a validacao da edicao.
-- Aplicar primeiro em homologacao e conferir backup antes de producao.
BEGIN;

CREATE OR REPLACE FUNCTION public.update_organization_service_record(
  p_organization_id uuid,
  p_service_record_id uuid,
  p_customer_id uuid,
  p_service_name text,
  p_service_date date,
  p_source text,
  p_amount_charged numeric,
  p_notes text,
  p_scheduled_installments jsonb,
  p_actor_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service public.organization_service_records%ROWTYPE;
  v_customer_name text;
  v_received numeric(12,2);
  v_received_outside_schedule numeric(12,2);
  v_scheduled_count integer;
  v_new_count integer;
  v_new_scheduled_total numeric(12,2);
  v_before_installments jsonb;
  v_after_installments jsonb;
  v_invalid boolean;
  v_actor_email text;
BEGIN
  IF p_service_name IS NULL OR char_length(btrim(p_service_name)) NOT BETWEEN 2 AND 200
     OR p_service_date IS NULL
     OR p_source NOT IN ('vallex', 'indicacao', 'redes_sociais', 'busca_web', 'recorrente', 'outros')
     OR p_amount_charged IS NULL OR p_amount_charged <= 0
     OR p_notes IS NOT NULL AND char_length(p_notes) > 2000
     OR p_scheduled_installments IS NULL
     OR jsonb_typeof(p_scheduled_installments) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_SERVICE_DATA';
  END IF;

  SELECT * INTO v_service
  FROM public.organization_service_records
  WHERE id = p_service_record_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND'; END IF;

  PERFORM 1 FROM public.customers
  WHERE id = p_customer_id AND organization_id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND'; END IF;

  -- Parcelas guardam o valor integral, inclusive a parte ja recebida.
  -- Somar novamente esses recebimentos duplicaria valores na validacao.
  -- Entradas e recebimentos sem parcela correspondente continuam consumindo saldo.
  SELECT COALESCE(sum(payment.amount), 0),
         COALESCE(sum(payment.amount) FILTER (WHERE NOT EXISTS (
           SELECT 1 FROM public.organization_service_installments installment
           WHERE installment.service_record_id = payment.service_record_id
             AND installment.installment_number = payment.installment_number
         )), 0)
  INTO v_received, v_received_outside_schedule
  FROM public.organization_service_payments payment
  WHERE payment.service_record_id = p_service_record_id;
  IF p_amount_charged < v_received THEN RAISE EXCEPTION 'CHARGE_BELOW_RECEIVED'; END IF;

  SELECT count(*) INTO v_scheduled_count
  FROM public.organization_service_installments
  WHERE service_record_id = p_service_record_id;
  v_new_count := jsonb_array_length(p_scheduled_installments);
  IF v_new_count <> v_scheduled_count OR v_new_count > 24 THEN
    RAISE EXCEPTION 'INSTALLMENT_COUNT_CHANGE_NOT_SUPPORTED';
  END IF;

  SELECT COALESCE(sum(item.amount), 0), COALESCE(bool_or(
    item.installment_number IS NULL OR item.installment_number < 1 OR item.installment_number > v_new_count
    OR item.amount IS NULL OR item.amount <= 0
    OR item.due_date IS NULL
  ), false)
  INTO v_new_scheduled_total, v_invalid
  FROM jsonb_to_recordset(p_scheduled_installments)
    AS item(installment_number integer, amount numeric, due_date date);
  IF v_invalid OR p_amount_charged < v_received_outside_schedule + v_new_scheduled_total THEN
    RAISE EXCEPTION 'INVALID_INSTALLMENTS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT item.installment_number, item.amount,
             row_number() OVER (ORDER BY raw.ordinality)::integer AS expected_number
      FROM jsonb_array_elements(p_scheduled_installments) WITH ORDINALITY AS raw(value, ordinality)
      CROSS JOIN LATERAL jsonb_to_record(raw.value)
        AS item(installment_number integer, amount numeric, due_date date)
    ) schedule
    LEFT JOIN LATERAL (
      SELECT COALESCE(sum(p.amount), 0) AS received
      FROM public.organization_service_payments p
      WHERE p.service_record_id = p_service_record_id
        AND p.installment_number = schedule.installment_number
    ) paid ON true
    WHERE schedule.installment_number <> schedule.expected_number
       OR paid.received > schedule.amount
  ) THEN
    RAISE EXCEPTION 'INVALID_INSTALLMENTS';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'installment_number', installment_number, 'amount', amount, 'due_date', due_date
  ) ORDER BY installment_number), '[]'::jsonb)
  INTO v_before_installments
  FROM public.organization_service_installments
  WHERE service_record_id = p_service_record_id;

  SELECT name INTO v_customer_name FROM public.customers
  WHERE id = p_customer_id AND organization_id = p_organization_id;
  SELECT email INTO v_actor_email FROM auth.users WHERE id = p_actor_user_id;

  UPDATE public.organization_service_records
  SET customer_id = p_customer_id,
      service_name = btrim(p_service_name),
      service_date = p_service_date,
      source = p_source,
      amount_charged = p_amount_charged,
      notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
      updated_at = now()
  WHERE id = p_service_record_id AND organization_id = p_organization_id;

  UPDATE public.organization_service_installments schedule
  SET amount = item.amount, due_date = item.due_date
  FROM jsonb_to_recordset(p_scheduled_installments)
    AS item(installment_number integer, amount numeric, due_date date)
  WHERE schedule.service_record_id = p_service_record_id
    AND schedule.installment_number = item.installment_number;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'installment_number', installment_number, 'amount', amount, 'due_date', due_date
  ) ORDER BY installment_number), '[]'::jsonb)
  INTO v_after_installments
  FROM public.organization_service_installments
  WHERE service_record_id = p_service_record_id;

  INSERT INTO public.organization_finance_audit_logs (
    organization_id, service_record_id, actor_user_id, actor_email, action, details
  ) VALUES (
    p_organization_id, p_service_record_id, p_actor_user_id, v_actor_email, 'updated',
    jsonb_build_object(
      'before', jsonb_build_object(
        'customer_name', (SELECT name FROM public.customers WHERE id = v_service.customer_id),
        'service_name', v_service.service_name,
        'service_date', v_service.service_date,
        'source', v_service.source,
        'amount_charged', v_service.amount_charged,
        'notes', v_service.notes,
        'installments', v_before_installments
      ),
      'after', jsonb_build_object(
        'customer_name', v_customer_name,
        'service_name', btrim(p_service_name),
        'service_date', p_service_date,
        'source', p_source,
        'amount_charged', p_amount_charged,
        'notes', NULLIF(btrim(COALESCE(p_notes, '')), ''),
        'installments', v_after_installments
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_organization_service_record(uuid, uuid, uuid, text, date, text, numeric, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_organization_service_record(uuid, uuid, uuid, text, date, text, numeric, text, jsonb, uuid) TO service_role;

COMMIT;

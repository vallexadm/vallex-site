BEGIN;
DO $$ DECLARE o uuid;c uuid;q uuid;v timestamptz;r jsonb;blocked boolean; BEGIN
SELECT id INTO o FROM organizations LIMIT 1;
INSERT INTO customers(organization_id,name) VALUES(o,'Teste transacional aprovação') RETURNING id INTO c;
INSERT INTO orcamentos(organization_id,customer_id,titulo,valor,status) VALUES(o,c,'Proposta de teste',125,'rascunho') RETURNING id,updated_at INTO q,v;
INSERT INTO quote_decision_links(token_hash,quote_id,organization_id,quote_version,expires_at) VALUES(repeat('c',64),q,o,v,now()+interval '1 day');
r:=respond_quote_link(repeat('c',64),NULL);IF r->>'amount'<>'125.00' OR r ? 'custos_internos' THEN RAISE EXCEPTION 'PUBLIC_DATA_FAILURE'; END IF;
r:=respond_quote_link(repeat('c',64),'aprovado');IF r->>'status'<>'aprovado' THEN RAISE EXCEPTION 'APPROVAL_FAILURE'; END IF;
blocked:=false;BEGIN PERFORM respond_quote_link(repeat('c',64),'recusado');EXCEPTION WHEN OTHERS THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'DOUBLE_RESPONSE';END IF;
r:=respond_quote_link(repeat('c',64),NULL);IF r->>'decision'<>'aprovado' THEN RAISE EXCEPTION 'TRACKING_FAILURE';END IF;
UPDATE orcamentos SET valor=200,updated_at=clock_timestamp() WHERE id=q;
blocked:=false;BEGIN PERFORM respond_quote_link(repeat('c',64),NULL);EXCEPTION WHEN OTHERS THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'EDITED_PROPOSAL_VISIBLE';END IF;
IF has_function_privilege('anon','public.respond_quote_link(text,text)','EXECUTE') THEN RAISE EXCEPTION 'PUBLIC_RPC_ACCESS';END IF;
END $$;
SELECT 'PASS: consulta, aprovação, resposta única, acompanhamento, alteração invalida link, RPC restrita' AS checks;
ROLLBACK;

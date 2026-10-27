-- Somente leitura. Executar ANTES da migracao da nova agenda.
SELECT a.organization_id, a.assigned_to, a.id AS atendimento_a, b.id AS atendimento_b,
       a.starts_at AS inicio_a, COALESCE(a.ends_at,a.starts_at+interval '1 hour') AS fim_a,
       b.starts_at AS inicio_b, COALESCE(b.ends_at,b.starts_at+interval '1 hour') AS fim_b
FROM public.organization_appointments a
JOIN public.organization_appointments b ON a.assigned_to=b.assigned_to AND a.id<b.id
WHERE a.status IN ('scheduled','on_way','arrived','in_progress')
  AND b.status IN ('scheduled','on_way','arrived','in_progress')
  AND tstzrange(a.starts_at,COALESCE(a.ends_at,a.starts_at+interval '1 hour'),'[)')
   && tstzrange(b.starts_at,COALESCE(b.ends_at,b.starts_at+interval '1 hour'),'[)')
ORDER BY a.starts_at;

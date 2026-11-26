-- Migración 013 · Editar el número de cotización a mano (26 nov 2026)
-- El folio se sigue asignando solo al crear la cotización, pero ahora se puede
-- cambiar después. No se permite repetir un folio dentro de la misma empresa.
-- Los consecutivos automáticos no se mueven. Se puede correr más de una vez.

create or replace function preparar_cotizacion() returns trigger language plpgsql as $$
declare pre text; con_anio boolean; dig int; esp boolean;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(new.empresa_id);
    select (new.serie = 'especial' and especial_prefijo is not null) into esp from empresas where id = new.empresa_id;
    if not esp then new.serie := 'general'; end if;
    select upper(case when esp then especial_prefijo else coalesce(prefijo, 'COT') end),
           case when esp then especial_con_anio else folio_con_anio end,
           case when esp then especial_digitos else folio_digitos end
      into pre, con_anio, dig from empresas where id = new.empresa_id;
    select coalesce(max(consecutivo), 0) + 1 into new.consecutivo from cotizaciones
     where empresa_id = new.empresa_id and serie = new.serie
       and (not con_anio or extract(year from fecha) = extract(year from new.fecha));
    loop
      new.folio := pre || '-' || lpad(new.consecutivo::text, dig, '0') || case when con_anio then '-' || to_char(new.fecha, 'YY') else '' end;
      exit when not exists (select 1 from cotizaciones where empresa_id = new.empresa_id and folio = new.folio);
      new.consecutivo := new.consecutivo + 1;
    end loop;
  else
    new.consecutivo := old.consecutivo; new.empresa_id := old.empresa_id; new.serie := old.serie;
    new.created_by := old.created_by; new.created_at := old.created_at; new.updated_at := now();
    -- Folio editable: sin espacios de más y en mayúsculas; vacío = se queda el anterior.
    new.folio := coalesce(nullif(upper(btrim(new.folio)), ''), old.folio);
    if length(new.folio) > 40 then raise exception 'El número de cotización es demasiado largo.'; end if;
  end if;
  select coalesce(round(sum((c->>'cantidad')::numeric * (c->>'precio')::numeric), 2), 0)
    into new.subtotal from jsonb_array_elements(new.conceptos) c;
  new.descuento := least(greatest(coalesce(new.descuento, 0), 0), new.subtotal);
  new.iva := round((new.subtotal - new.descuento) * new.iva_pct / 100, 2);
  new.total := new.subtotal - new.descuento + new.iva;
  return new;
end $$;

select 'Listo: el número de cotización ya se puede editar' as resultado;

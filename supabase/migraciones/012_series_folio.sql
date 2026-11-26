-- Migración 012 · Series de folio (26 nov 2026)
-- Cada empresa tiene su serie general (TXX-001, GCP-001…) y, opcionalmente,
-- una serie especial para un cliente como SEFIPLAN (SEF-01-26), que se elige
-- al capturar la cotización. Cada empresa lleva sus propios consecutivos.
-- Requiere la 010 y la 011. Se puede correr más de una vez.

alter table empresas add column if not exists folio_digitos          int  not null default 3 check (folio_digitos between 1 and 6);
alter table empresas add column if not exists especial_prefijo       text;          -- p. ej. SEF
alter table empresas add column if not exists especial_nombre        text;          -- p. ej. SEFIPLAN
alter table empresas add column if not exists especial_con_anio      boolean not null default true;
alter table empresas add column if not exists especial_digitos       int  not null default 2 check (especial_digitos between 1 and 6);
alter table cotizaciones add column if not exists serie text not null default 'general' check (serie in ('general', 'especial'));

-- El folio es único por empresa: TXX y Poiesis pueden tener cada una su SEF-01-26.
alter table cotizaciones drop constraint if exists cotizaciones_folio_key;
create unique index if not exists cotizaciones_empresa_folio_unico on cotizaciones (empresa_id, folio);
drop index if exists cotizaciones_empresa_idx;
create index if not exists cotizaciones_serie_idx on cotizaciones (empresa_id, serie, consecutivo desc);

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
    new.consecutivo := old.consecutivo; new.folio := old.folio; new.empresa_id := old.empresa_id; new.serie := old.serie;
    new.created_by := old.created_by; new.created_at := old.created_at; new.updated_at := now();
  end if;
  select coalesce(round(sum((c->>'cantidad')::numeric * (c->>'precio')::numeric), 2), 0)
    into new.subtotal from jsonb_array_elements(new.conceptos) c;
  new.descuento := least(greatest(coalesce(new.descuento, 0), 0), new.subtotal);
  new.iva := round((new.subtotal - new.descuento) * new.iva_pct / 100, 2);
  new.total := new.subtotal - new.descuento + new.iva;
  return new;
end $$;

-- TXX: general TXX-001; SEFIPLAN SEF-01-26 (reinicia cada año)
update empresas set prefijo = 'TXX', folio_con_anio = false, folio_digitos = 3,
       especial_prefijo = 'SEF', especial_nombre = 'SEFIPLAN', especial_con_anio = true, especial_digitos = 2
 where nombre = 'TXX';
-- Poiesis: general GCP-001; SEFIPLAN SEF-01-26 (su propio consecutivo)
update empresas set prefijo = 'GCP', folio_con_anio = false, folio_digitos = 3,
       especial_prefijo = 'SEF', especial_nombre = 'SEFIPLAN', especial_con_anio = true, especial_digitos = 2,
       numero_proveedor = '58629'
 where nombre = 'Poiesis';

select nombre,
       prefijo || '-' || lpad('1', folio_digitos, '0') as folio_general,
       coalesce(especial_prefijo || '-' || lpad('1', especial_digitos, '0') || case when especial_con_anio then '-' || to_char(now(), 'YY') else '' end, '—') as folio_especial,
       coalesce(especial_nombre, '—') as serie_especial,
       coalesce(numero_proveedor, '—') as no_proveedor
from empresas order by nombre;

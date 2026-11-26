-- Migración 011 · Formato propio de cotización por empresa (26 nov 2026)
-- Requiere la 010. Agrega los datos que llevan los formatos de Poiesis y TXX
-- y da de alta (o actualiza) esas dos empresas. Se puede correr más de una vez.

alter table empresas add column if not exists plantilla        text not null default 'sencilla'
  check (plantilla in ('sencilla', 'clasica'));         -- sencilla = Poiesis · clasica = TXX
alter table empresas add column if not exists logo             text;   -- ruta (/logos/x.png) o imagen subida
alter table empresas add column if not exists firmante_nombre  text;
alter table empresas add column if not exists firmante_cargo   text;
alter table empresas add column if not exists pie              text;   -- p. ej. la dirección al pie
alter table empresas add column if not exists numero_proveedor text;   -- p. ej. padrón de SEFIPLAN
alter table empresas add column if not exists folio_con_anio   boolean not null default false;

alter table cotizaciones add column if not exists cliente_direccion text;
alter table cotizaciones add column if not exists numero_proveedor  text;  -- opcional: solo si se cotiza a SEFIPLAN u otro padrón

-- Folio: PREFIJO-01 (Poiesis) o PREFIJO-17-26 con el año (TXX). Con año, el consecutivo reinicia cada año.
create or replace function preparar_cotizacion() returns trigger language plpgsql as $$
declare pre text; con_anio boolean;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(new.empresa_id);
    select upper(coalesce(prefijo, 'COT')), folio_con_anio into pre, con_anio from empresas where id = new.empresa_id;
    if con_anio then
      select coalesce(max(consecutivo), 0) + 1 into new.consecutivo from cotizaciones
       where empresa_id = new.empresa_id and extract(year from fecha) = extract(year from new.fecha);
      new.folio := pre || '-' || lpad(new.consecutivo::text, 2, '0') || '-' || to_char(new.fecha, 'YY');
    else
      select coalesce(max(consecutivo), 0) + 1 into new.consecutivo from cotizaciones where empresa_id = new.empresa_id;
      new.folio := pre || '-' || lpad(new.consecutivo::text, 2, '0');
    end if;
    -- Si el folio ya existe (p. ej. se cambió el prefijo), avanza hasta uno libre.
    while exists (select 1 from cotizaciones where folio = new.folio) loop
      new.consecutivo := new.consecutivo + 1;
      new.folio := pre || '-' || lpad(new.consecutivo::text, 2, '0') || case when con_anio then '-' || to_char(new.fecha, 'YY') else '' end;
    end loop;
  else
    new.consecutivo := old.consecutivo; new.folio := old.folio; new.empresa_id := old.empresa_id;
    new.created_by := old.created_by; new.created_at := old.created_at; new.updated_at := now();
  end if;
  select coalesce(round(sum((c->>'cantidad')::numeric * (c->>'precio')::numeric), 2), 0)
    into new.subtotal from jsonb_array_elements(new.conceptos) c;
  new.descuento := least(greatest(coalesce(new.descuento, 0), 0), new.subtotal);
  new.iva := round((new.subtotal - new.descuento) * new.iva_pct / 100, 2);
  new.total := new.subtotal - new.descuento + new.iva;
  return new;
end $$;

-- Empresas de los formatos recibidos
insert into empresas (nombre, razon_social, telefono, correo, direccion, prefijo, color, plantilla, logo,
                      firmante_nombre, firmante_cargo, pie, condiciones, folio_con_anio)
values ('Poiesis', 'Grupo Constructor Poiesis', null, null,
        'Bv. Adolfo Ruiz Cortinez #525, Costa Verde, Boca del Río, Veracruz.  C.P. 94294',
        'COT', '#3a3a3a', 'sencilla', '/logos/poiesis.png',
        'MIGUEL COELLO SÁNCHEZ', 'DIRECTOR COMERCIAL',
        'Bv. Adolfo Ruiz Cortinez #525, Costa Verde, Boca del Río, Veracruz.   C.P. 94294',
        E'EL PAGO SERÁ DE CONTADO\nPLAZO DE ENTREGA DE 2 A 3 DÍAS HÁBILES\nEL PRECIO ES FIJO', false)
on conflict (nombre) do update set
  razon_social = excluded.razon_social, direccion = excluded.direccion, color = excluded.color,
  plantilla = excluded.plantilla, logo = excluded.logo, firmante_nombre = excluded.firmante_nombre,
  firmante_cargo = excluded.firmante_cargo, pie = excluded.pie,
  condiciones = coalesce(empresas.condiciones, excluded.condiciones);

insert into empresas (nombre, razon_social, rfc, telefono, correo, prefijo, color, plantilla, logo,
                      firmante_nombre, firmante_cargo, numero_proveedor, condiciones, folio_con_anio)
values ('TXX', 'TXX Conveniencia, S.A. de C.V.', 'TCO2411265I4', '2281948008 / 2291464776',
        'txxconveniencia@hotmail.com', 'SEF', '#04143a', 'clasica', '/logos/txx.png',
        'RAFAEL LINALDI CHIPULI', 'DIRECTOR TXX CONVENIENCIA, S.A. DE C.V.', '54157',
        E'Tiempo de entrega: 20 días hábiles a partir de la confirmación\nLugar de entrega: De acuerdo al anexo indicado por SEFIPLAN\nTipo de entrega: Total\nVigencia: 60 días\nCondición de Pago: 30 días posterior a la recepción de la factura\nRégimen Fiscal Inscrito: Régimen Simplificado de Confianza\nPrecio Fijo',
        true)
on conflict (nombre) do update set
  razon_social = excluded.razon_social, rfc = excluded.rfc, telefono = excluded.telefono,
  correo = excluded.correo, color = excluded.color, plantilla = excluded.plantilla, logo = excluded.logo,
  firmante_nombre = excluded.firmante_nombre, firmante_cargo = excluded.firmante_cargo,
  numero_proveedor = excluded.numero_proveedor, folio_con_anio = excluded.folio_con_anio,
  condiciones = coalesce(empresas.condiciones, excluded.condiciones);

select nombre, prefijo, plantilla, firmante_nombre, numero_proveedor from empresas order by nombre;

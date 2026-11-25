-- Migración 010 · Generador de cotizaciones (24 nov 2026)
-- Empresas emisoras y cotizaciones con folio automático por empresa.
-- Lo usan Zaida, Rafael y Ricardo (roles admin, administrativo y desarrollo).
-- Se puede correr más de una vez.

create or replace function es_equipo_cotiza() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo
                 and rol in ('admin', 'administrativo', 'desarrollo'));
$$;

-- ---------------------------------------------------------------- Empresas
create table if not exists empresas (
  id            serial primary key,
  nombre        text not null unique,        -- nombre corto, p. ej. "Poiesis"
  razon_social  text,
  rfc           text,
  direccion     text,
  telefono      text,
  correo        text,
  prefijo       text not null default 'COT', -- para el folio: POI-0001
  color         text not null default '#2f3a30',
  condiciones   text,                        -- texto por omisión al pie
  activa        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- Cotizaciones
create table if not exists cotizaciones (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     int not null references empresas(id),
  consecutivo    int not null,
  folio          text not null unique,
  fecha          date not null default (now() at time zone 'America/Mexico_City')::date,
  vigencia_dias  int not null default 15,
  cliente        text not null,
  atencion       text,
  cliente_correo text,
  cliente_tel    text,
  moneda         text not null default 'MXN',
  conceptos      jsonb not null default '[]',  -- [{descripcion, unidad, cantidad, precio}]
  iva_pct        numeric(5,2) not null default 16,
  descuento      numeric(14,2) not null default 0,
  subtotal       numeric(14,2) not null default 0,
  iva            numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  notas          text,
  condiciones    text,
  estado         text not null default 'borrador' check (estado in ('borrador', 'enviada', 'aceptada', 'rechazada')),
  created_by     uuid not null default auth.uid() references perfiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists cotizaciones_empresa_idx on cotizaciones (empresa_id, consecutivo desc);

-- Folio consecutivo por empresa (POI-0001, POI-0002…) y totales calculados en la base.
create or replace function preparar_cotizacion() returns trigger language plpgsql as $$
declare pre text;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(new.empresa_id);
    select coalesce(max(consecutivo), 0) + 1 into new.consecutivo from cotizaciones where empresa_id = new.empresa_id;
    select prefijo into pre from empresas where id = new.empresa_id;
    new.folio := upper(coalesce(pre, 'COT')) || '-' || lpad(new.consecutivo::text, 4, '0');
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
drop trigger if exists t_preparar on cotizaciones;
create trigger t_preparar before insert or update on cotizaciones for each row execute function preparar_cotizacion();
drop trigger if exists t_hist on cotizaciones;
create trigger t_hist after insert or update or delete on cotizaciones for each row execute function registrar_historial();

-- ---------------------------------------------------------------- Permisos
alter table empresas enable row level security;
alter table cotizaciones enable row level security;
drop policy if exists ver on empresas;      drop policy if exists capturar on empresas;
drop policy if exists editar on empresas;   drop policy if exists admin_borra on empresas;
create policy ver on empresas for select to authenticated using (es_equipo_cotiza());
create policy capturar on empresas for insert to authenticated with check (es_equipo_cotiza());
create policy editar on empresas for update to authenticated using (es_equipo_cotiza());
create policy admin_borra on empresas for delete to authenticated using (es_admin());

drop policy if exists ver on cotizaciones;    drop policy if exists capturar on cotizaciones;
drop policy if exists editar on cotizaciones; drop policy if exists admin_borra on cotizaciones;
create policy ver on cotizaciones for select to authenticated using (es_equipo_cotiza());
create policy capturar on cotizaciones for insert to authenticated with check (es_equipo_cotiza() and created_by = auth.uid());
create policy editar on cotizaciones for update to authenticated using (es_equipo_cotiza());
create policy admin_borra on cotizaciones for delete to authenticated using (es_admin());
grant all on empresas, cotizaciones to authenticated;
grant usage on sequence empresas_id_seq to authenticated;

-- El historial guarda copias: las de cotizaciones solo las ve el mismo equipo.
drop policy if exists ver on historial;
create policy ver on historial for select to authenticated
  using (
    (tabla not in ('tareas', 'agenda', 'cotizaciones'))
    or (tabla = 'cotizaciones' and es_equipo_cotiza())
    or es_admin()
    or usuario_id = auth.uid()
    or despues->>'responsable_id' = auth.uid()::text
    or antes->>'responsable_id'   = auth.uid()::text
  );

select 'Listo: generador de cotizaciones habilitado' as resultado;

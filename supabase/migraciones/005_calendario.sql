-- Migración 005 · Calendario: días inhábiles y agenda diaria (24 nov 2026)
-- Se puede correr más de una vez.

-- ---------------------------------------------------------------- Días inhábiles
-- Fechas en que no corren los plazos (además de sábados y domingos).
-- autoridad vacía = aplica a todos los tribunales.
create table if not exists dias_inhabiles (
  id          serial primary key,
  fecha       date not null,
  descripcion text not null,
  autoridad   text,
  created_by  uuid default auth.uid() references perfiles(id),
  created_at  timestamptz not null default now()
);
create unique index if not exists dias_inhabiles_unico on dias_inhabiles (fecha, coalesce(autoridad, ''));

-- Ley de Amparo, art. 19: 1 ene, 5 feb, 21 mar, 1 y 5 may, 14 y 16 sep,
-- 12 oct, 20 nov y 25 dic. Las vacaciones y suspensiones de labores de cada
-- tribunal se agregan desde la pestaña Calendario cuando se publiquen.
insert into dias_inhabiles (fecha, descripcion)
select make_date(a, m, d), 'Inhábil · Ley de Amparo, art. 19'
from generate_series(2026, 2027) a,
     (values (1,1),(2,5),(3,21),(5,1),(5,5),(9,14),(9,16),(10,12),(11,20),(12,25)) f(m, d)
on conflict do nothing;

alter table dias_inhabiles enable row level security;
drop policy if exists ver on dias_inhabiles;
drop policy if exists capturar on dias_inhabiles;
drop policy if exists admin_borra on dias_inhabiles;
create policy ver on dias_inhabiles for select to authenticated using (true);
create policy capturar on dias_inhabiles for insert to authenticated with check (true);
create policy admin_borra on dias_inhabiles for delete to authenticated using (es_admin());
grant all on dias_inhabiles to authenticated;
grant usage on sequence dias_inhabiles_id_seq to authenticated;

-- ---------------------------------------------------------------- Agenda
do $$ begin
  create type tipo_agenda as enum ('diaria', 'secundaria', 'cita');
exception when duplicate_object then null; end $$;

create table if not exists agenda (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null,
  hora            time,
  titulo          text not null,
  detalle         text,
  tipo            tipo_agenda not null default 'diaria',
  hecho           boolean not null default false,
  hecho_at        timestamptz,
  responsable_id  uuid not null default auth.uid() references perfiles(id),
  created_by      uuid not null default auth.uid() references perfiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists agenda_fecha_idx on agenda (fecha);

create or replace function sellar_agenda() returns trigger language plpgsql as $$
begin
  if new.hecho and (tg_op = 'INSERT' or not old.hecho) then new.hecho_at := now(); end if;
  if not new.hecho then new.hecho_at := null; end if;
  return new;
end $$;

drop trigger if exists t_sello on agenda;
create trigger t_sello before insert or update on agenda for each row execute function sellar_agenda();
drop trigger if exists t_upd on agenda;
create trigger t_upd before update on agenda for each row execute function tocar_updated_at();
drop trigger if exists t_autoria on agenda;
create trigger t_autoria before update on agenda for each row execute function proteger_autoria();
drop trigger if exists t_hist on agenda;
create trigger t_hist after insert or update or delete on agenda for each row execute function registrar_historial();

alter table agenda enable row level security;
drop policy if exists ver on agenda;
drop policy if exists capturar on agenda;
drop policy if exists editar on agenda;
drop policy if exists borrar on agenda;
create policy ver on agenda for select to authenticated using (true);
create policy capturar on agenda for insert to authenticated
  with check (created_by = auth.uid() and (responsable_id = auth.uid() or es_admin()));
create policy editar on agenda for update to authenticated
  using (es_admin() or responsable_id = auth.uid())
  with check (es_admin() or responsable_id = auth.uid());
-- En la agenda cada quien puede borrar lo suyo (no son registros del expediente).
create policy borrar on agenda for delete to authenticated
  using (es_admin() or created_by = auth.uid());
grant all on agenda to authenticated;

select count(*) as dias_inhabiles_cargados from dias_inhabiles;

-- Migración 004 · Tareas de Ricardo y Rafael (17 nov 2026)
-- Cada uno lleva su lista de tareas: pendiente → en proceso → terminada.
-- Todos ven todo; cada quien agrega y mueve sus propias tareas; Zaida puede
-- agregar, mover y borrar las de cualquiera. Se puede correr más de una vez.

do $$ begin
  create type estado_tarea as enum ('pendiente', 'en_proceso', 'terminada');
exception when duplicate_object then null; end $$;

create table if not exists tareas (
  id              uuid primary key default gen_random_uuid(),
  responsable_id  uuid not null references perfiles(id),
  titulo          text not null,
  descripcion     text,
  fecha_limite    date,
  estado          estado_tarea not null default 'pendiente',
  iniciada_at     timestamptz,
  terminada_at    timestamptz,
  created_by      uuid not null default auth.uid() references perfiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists tareas_responsable_idx on tareas (responsable_id, estado);

-- Sella cuándo empezó y cuándo terminó cada tarea.
create or replace function sellar_tarea() returns trigger language plpgsql as $$
begin
  if new.estado = 'en_proceso' and new.iniciada_at is null then new.iniciada_at := now(); end if;
  if new.estado = 'terminada' and (tg_op = 'INSERT' or old.estado <> 'terminada') then new.terminada_at := now(); end if;
  if new.estado <> 'terminada' then new.terminada_at := null; end if;
  return new;
end $$;

drop trigger if exists t_sello on tareas;
create trigger t_sello before insert or update on tareas for each row execute function sellar_tarea();
drop trigger if exists t_upd on tareas;
create trigger t_upd before update on tareas for each row execute function tocar_updated_at();
drop trigger if exists t_autoria on tareas;
create trigger t_autoria before update on tareas for each row execute function proteger_autoria();
drop trigger if exists t_hist on tareas;
create trigger t_hist after insert or update or delete on tareas for each row execute function registrar_historial();

alter table tareas enable row level security;
drop policy if exists ver on tareas;
drop policy if exists capturar on tareas;
drop policy if exists editar on tareas;
drop policy if exists admin_borra on tareas;
create policy ver on tareas for select to authenticated using (true);
create policy capturar on tareas for insert to authenticated
  with check (created_by = auth.uid() and (responsable_id = auth.uid() or es_admin()));
create policy editar on tareas for update to authenticated
  using (es_admin() or responsable_id = auth.uid())
  with check (es_admin() or responsable_id = auth.uid());
create policy admin_borra on tareas for delete to authenticated using (es_admin());

grant all on tareas to authenticated;

-- Nombres completos como se verán en la pestaña Tareas.
update perfiles set nombre = 'Ricardo Coello' where nombre = 'Ricardo';
update perfiles set nombre = 'Rafael Linaldi' where nombre = 'Rafael';

select nombre, rol from perfiles order by nombre;

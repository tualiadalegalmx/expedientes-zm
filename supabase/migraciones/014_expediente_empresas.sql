-- Migración 014 · Expediente de empresas y personas (26 nov 2026)
-- Repositorio mensual de constancias (situación fiscal, cumplimiento, etc.).
-- Todos consultan y descargan; Zaida, Rafael y Ricardo suben y eliminan.
-- Se puede correr más de una vez.

create or replace function es_equipo_docs() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo
                 and rol in ('admin', 'administrativo', 'desarrollo'));
$$;

-- ---------------------------------------------------------------- Personas y empresas
create table if not exists entidades (
  id         serial primary key,
  nombre     text not null unique,
  tipo       text not null check (tipo in ('fisica', 'moral')),
  color      text not null default '#2f3a30',
  rfc        text,
  orden      int  not null default 100,
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);

insert into entidades (nombre, tipo, color, orden) values
  ('ZAIDA MERITH MARIN MENES',                 'fisica', '#6b7a2e', 1),
  ('RAFAEL LINALDI CHIPULI',                   'fisica', '#7a4a2a', 2),
  ('TXX CONVENIENCIA, S.A. DE C.V.',           'moral',  '#0b1f4d', 1),
  ('GRUPO CONSTRUCTOR POIESIS, S.A. DE C.V.',  'moral',  '#4a9fd8', 2),
  ('PROYECTA AM EMPRESARIAL S.A. DE C.V.',     'moral',  '#e3b21f', 3)
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------- Documentos
create table if not exists documentos_entidad (
  id          uuid primary key default gen_random_uuid(),
  entidad_id  int  not null references entidades(id) on delete cascade,
  categoria   text not null,
  periodo     date not null,                 -- primer día del mes al que corresponde
  nombre      text not null,                 -- nombre original del archivo
  ruta        text not null unique,          -- ruta en el almacenamiento
  tipo_mime   text,
  bytes       bigint,
  notas       text,
  created_by  uuid not null default auth.uid() references perfiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists documentos_entidad_idx on documentos_entidad (entidad_id, periodo desc, categoria);

drop trigger if exists t_hist on documentos_entidad;
create trigger t_hist after insert or update or delete on documentos_entidad
for each row execute function registrar_historial();

-- ---------------------------------------------------------------- Permisos
alter table entidades enable row level security;
alter table documentos_entidad enable row level security;

drop policy if exists ver on entidades;       drop policy if exists capturar on entidades;
drop policy if exists editar on entidades;    drop policy if exists admin_borra on entidades;
create policy ver on entidades for select to authenticated using (true);
create policy capturar on entidades for insert to authenticated with check (es_equipo_docs());
create policy editar on entidades for update to authenticated using (es_equipo_docs());
create policy admin_borra on entidades for delete to authenticated using (es_admin());

drop policy if exists ver on documentos_entidad;     drop policy if exists capturar on documentos_entidad;
drop policy if exists editar on documentos_entidad;  drop policy if exists borrar on documentos_entidad;
create policy ver on documentos_entidad for select to authenticated using (true);
create policy capturar on documentos_entidad for insert to authenticated
  with check (es_equipo_docs() and created_by = auth.uid());
create policy editar on documentos_entidad for update to authenticated using (es_equipo_docs());
create policy borrar on documentos_entidad for delete to authenticated using (es_equipo_docs());
grant all on entidades, documentos_entidad to authenticated;
grant usage on sequence entidades_id_seq to authenticated;

-- ---------------------------------------------------------------- Archivos (privados)
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos-empresas', 'documentos-empresas', false, 26214400)   -- 25 MB por archivo
on conflict (id) do nothing;

drop policy if exists docs_emp_ver on storage.objects;
drop policy if exists docs_emp_subir on storage.objects;
drop policy if exists docs_emp_borrar on storage.objects;
create policy docs_emp_ver on storage.objects for select to authenticated
  using (bucket_id = 'documentos-empresas');
create policy docs_emp_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-empresas' and es_equipo_docs());
create policy docs_emp_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'documentos-empresas' and es_equipo_docs());

select tipo, nombre, color from entidades order by tipo, orden;

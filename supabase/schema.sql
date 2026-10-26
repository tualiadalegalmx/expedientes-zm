-- =====================================================================
-- Zaida Marmen | Tu aliada legal — Seguimiento de expedientes
-- Esquema Fase 1: usuarios, expedientes, bitácora, plazos, archivos,
-- historial de cambios imborrable y permisos por fila (RLS).
--
-- Cómo usarlo: Supabase → SQL Editor → pegar todo este archivo → Run.
-- Se puede ejecutar una sola vez sobre un proyecto nuevo.
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type rol_usuario as enum ('admin', 'abogado', 'administrativo', 'desarrollo');
create type estado_expediente as enum ('activo', 'suspendido', 'concluido', 'archivado');
create type tipo_registro as enum (
  'promocion',      -- Promoción presentada
  'acuerdo',        -- Acuerdo o notificación recibida
  'audiencia',
  'visita',         -- Visita al juzgado
  'cliente',        -- Llamada o reunión con cliente
  'estudio',        -- Atención o estudio del asunto
  'pendiente'       -- Pendiente / acción inmediata
);
create type unidad_plazo as enum ('dias', 'horas');
create type tipo_dias as enum ('habiles', 'naturales');
create type estado_plazo as enum ('abierto', 'cumplido', 'sin_efecto');

-- ---------------------------------------------------------------------
-- Perfiles (uno por cada usuario de Supabase Auth)
-- ---------------------------------------------------------------------
create table perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  email      text not null,
  rol        rol_usuario not null default 'abogado',
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Crea el perfil automáticamente al invitar a un usuario.
create or replace function crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
          new.email);
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
for each row execute function crear_perfil();

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin' and activo);
$$;

-- ---------------------------------------------------------------------
-- Catálogos abiertos (cualquiera agrega; solo Zaida edita o borra)
-- ---------------------------------------------------------------------
create table materias (
  id     serial primary key,
  nombre text not null unique,
  orden  int not null default 100
);
insert into materias (nombre, orden) values
  ('Amparo', 1), ('Constitucional', 2), ('Penal', 3), ('Civil', 4), ('Familiar', 5),
  ('Laboral', 6), ('Mercantil', 7), ('Fiscal', 8), ('Administrativo', 9),
  ('Municipal', 10), ('Licitaciones', 11), ('Consultoría', 12);

create table etapas (
  id     serial primary key,
  nombre text not null unique,
  orden  int not null default 100
);
insert into etapas (nombre, orden) values
  ('Demanda / inicio', 1), ('Admisión', 2), ('Informes previo y justificado', 3),
  ('Suspensión', 4), ('Pruebas', 5), ('Alegatos', 6), ('Audiencia constitucional', 7),
  ('Sentencia', 8), ('Recurso', 9), ('Cumplimiento de ejecutoria', 10), ('Ejecución', 11),
  ('Por definir', 99);

-- ---------------------------------------------------------------------
-- Expedientes (Módulo 1)
-- ---------------------------------------------------------------------
create table expedientes (
  id                 uuid primary key default gen_random_uuid(),
  numero             text not null,
  juzgado            text not null,
  autoridad          text not null,
  lugar              text not null,
  cliente            text not null,
  contraparte        text,
  materia_id         int not null references materias(id),
  tipo_juicio        text,
  responsable_id     uuid not null references perfiles(id),
  etapa_id           int not null references etapas(id),
  estado             estado_expediente not null default 'activo',
  ultimo_movimiento  timestamptz not null default now(),
  notas              text,
  created_by         uuid not null default auth.uid() references perfiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index expedientes_busqueda_idx on expedientes
  using gin ((numero || ' ' || cliente || ' ' || coalesce(contraparte,'') || ' ' || autoridad || ' ' || lugar || ' ' || juzgado) gin_trgm_ops);
create index expedientes_responsable_idx on expedientes (responsable_id);

-- ---------------------------------------------------------------------
-- Bitácora (Módulo 2)
-- ---------------------------------------------------------------------
create table bitacora (
  id                uuid primary key default gen_random_uuid(),
  expediente_id     uuid not null references expedientes(id) on delete cascade,
  tipo              tipo_registro not null,
  fecha             date not null default (now() at time zone 'America/Mexico_City')::date,
  hora              time,
  descripcion       text not null,
  resultado         text,           -- audiencia / visita
  duracion_min      int,            -- llamada o reunión
  acuerdos          text,           -- llamada o reunión
  genera_plazo      boolean,        -- acuerdo o notificación
  -- Pendientes / acciones inmediatas
  responsable_id    uuid references perfiles(id),
  fecha_compromiso  date,
  cumplido          boolean not null default false,
  cumplido_at       timestamptz,
  cumplido_por      uuid references perfiles(id),
  created_by        uuid not null default auth.uid() references perfiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index bitacora_expediente_idx on bitacora (expediente_id, fecha desc);
create index bitacora_autor_idx on bitacora (created_by, created_at desc);

-- ---------------------------------------------------------------------
-- Plazos (Módulo 3; el cálculo con días inhábiles llega en la Fase 2)
-- ---------------------------------------------------------------------
create table plazos (
  id                    uuid primary key default gen_random_uuid(),
  expediente_id         uuid not null references expedientes(id) on delete cascade,
  acuerdo_id            uuid references bitacora(id) on delete set null,
  fecha_surte_efectos   date not null,
  cantidad              int not null check (cantidad > 0),
  unidad                unidad_plazo not null default 'dias',
  tipo_dias             tipo_dias not null default 'habiles',
  actuacion             text not null,
  fundamento            text,
  vencimiento           date not null,
  estado                estado_plazo not null default 'abierto',
  cumplido_con          uuid references bitacora(id) on delete set null,
  cumplido_fecha        date,
  folio                 text,
  created_by            uuid not null default auth.uid() references perfiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index plazos_abiertos_idx on plazos (vencimiento) where estado = 'abierto';
create index plazos_expediente_idx on plazos (expediente_id);

-- ---------------------------------------------------------------------
-- Archivos adjuntos (se guardan en Supabase Storage, bucket "adjuntos")
-- ---------------------------------------------------------------------
create table adjuntos (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid not null references expedientes(id) on delete cascade,
  bitacora_id    uuid references bitacora(id) on delete cascade,
  ruta           text not null unique,
  nombre         text not null,
  tipo_mime      text,
  bytes          bigint,
  created_by     uuid not null default auth.uid() references perfiles(id),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Reglas automáticas
-- ---------------------------------------------------------------------

-- updated_at
create or replace function tocar_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger t_upd before update on expedientes for each row execute function tocar_updated_at();
create trigger t_upd before update on bitacora    for each row execute function tocar_updated_at();
create trigger t_upd before update on plazos      for each row execute function tocar_updated_at();

-- Nadie cambia el autor ni la fecha de captura de un registro.
create or replace function proteger_autoria() returns trigger language plpgsql as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end $$;
create trigger t_autoria before update on expedientes for each row execute function proteger_autoria();
create trigger t_autoria before update on bitacora    for each row execute function proteger_autoria();
create trigger t_autoria before update on plazos      for each row execute function proteger_autoria();

-- Solo Zaida cierra, archiva o reasigna expedientes.
create or replace function reglas_expediente() returns trigger language plpgsql as $$
begin
  if not es_admin() and auth.uid() is not null then
    if new.responsable_id is distinct from old.responsable_id then
      raise exception 'Solo la administradora puede reasignar un expediente.';
    end if;
    if new.estado is distinct from old.estado and new.estado in ('concluido', 'archivado') then
      raise exception 'Solo la administradora puede cerrar o archivar un expediente.';
    end if;
  end if;
  return new;
end $$;
create trigger t_reglas before update on expedientes for each row execute function reglas_expediente();

-- Cualquier registro nuevo en la bitácora actualiza el último movimiento.
create or replace function marcar_movimiento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update expedientes set ultimo_movimiento = now() where id = new.expediente_id;
  return new;
end $$;
create trigger t_movimiento after insert on bitacora for each row execute function marcar_movimiento();
create trigger t_movimiento after insert on plazos   for each row execute function marcar_movimiento();

-- Marcar un pendiente como cumplido: guarda quién y cuándo.
create or replace function sellar_cumplido() returns trigger language plpgsql as $$
begin
  if new.cumplido and not old.cumplido then
    new.cumplido_at := now(); new.cumplido_por := auth.uid();
  elsif not new.cumplido then
    new.cumplido_at := null; new.cumplido_por := null;
  end if;
  return new;
end $$;
create trigger t_cumplido before update on bitacora for each row execute function sellar_cumplido();

-- ---------------------------------------------------------------------
-- Historial de cambios (no se puede editar ni borrar, ni por Zaida)
-- ---------------------------------------------------------------------
create table historial (
  id          bigserial primary key,
  tabla       text not null,
  registro_id uuid not null,
  accion      text not null,           -- alta / cambio / baja
  antes       jsonb,
  despues     jsonb,
  usuario_id  uuid,
  momento     timestamptz not null default now()
);
create index historial_registro_idx on historial (registro_id, momento desc);

create or replace function registrar_historial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into historial (tabla, registro_id, accion, antes, despues, usuario_id)
  values (tg_table_name,
          coalesce(new.id, old.id),
          case tg_op when 'INSERT' then 'alta' when 'UPDATE' then 'cambio' else 'baja' end,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
          auth.uid());
  return coalesce(new, old);
end $$;
create trigger t_hist after insert or update or delete on expedientes for each row execute function registrar_historial();
create trigger t_hist after insert or update or delete on bitacora    for each row execute function registrar_historial();
create trigger t_hist after insert or update or delete on plazos      for each row execute function registrar_historial();
create trigger t_hist after insert or update or delete on adjuntos    for each row execute function registrar_historial();

create or replace function historial_inmutable() returns trigger language plpgsql as $$
begin raise exception 'El historial de cambios no se puede modificar ni borrar.'; end $$;
create trigger t_inmutable before update or delete on historial
for each row execute function historial_inmutable();
create trigger t_inmutable_trunc before truncate on historial
for each statement execute function historial_inmutable();

-- ---------------------------------------------------------------------
-- Permisos por fila: todos ven todo; cada quien edita lo suyo;
-- solo Zaida borra.
-- ---------------------------------------------------------------------
alter table perfiles    enable row level security;
alter table materias    enable row level security;
alter table etapas      enable row level security;
alter table expedientes enable row level security;
alter table bitacora    enable row level security;
alter table plazos      enable row level security;
alter table adjuntos    enable row level security;
alter table historial   enable row level security;

create policy ver on perfiles for select to authenticated using (true);
create policy admin_edita on perfiles for update to authenticated using (es_admin());

create policy ver on materias for select to authenticated using (true);
create policy agregar on materias for insert to authenticated with check (true);
create policy admin_edita on materias for update to authenticated using (es_admin());
create policy admin_borra on materias for delete to authenticated using (es_admin());

create policy ver on etapas for select to authenticated using (true);
create policy agregar on etapas for insert to authenticated with check (true);
create policy admin_edita on etapas for update to authenticated using (es_admin());
create policy admin_borra on etapas for delete to authenticated using (es_admin());

create policy ver on expedientes for select to authenticated using (true);
create policy capturar on expedientes for insert to authenticated with check (created_by = auth.uid());
create policy editar on expedientes for update to authenticated
  using (es_admin() or created_by = auth.uid() or responsable_id = auth.uid());
create policy admin_borra on expedientes for delete to authenticated using (es_admin());

create policy ver on bitacora for select to authenticated using (true);
create policy capturar on bitacora for insert to authenticated with check (created_by = auth.uid());
-- El autor corrige su registro; el responsable de un pendiente puede marcarlo cumplido.
create policy editar on bitacora for update to authenticated
  using (es_admin() or created_by = auth.uid() or responsable_id = auth.uid());
create policy admin_borra on bitacora for delete to authenticated using (es_admin());

create policy ver on plazos for select to authenticated using (true);
create policy capturar on plazos for insert to authenticated with check (created_by = auth.uid());
create policy editar on plazos for update to authenticated
  using (es_admin() or created_by = auth.uid()
         or exists (select 1 from expedientes e where e.id = expediente_id and e.responsable_id = auth.uid()));
create policy admin_borra on plazos for delete to authenticated using (es_admin());

create policy ver on adjuntos for select to authenticated using (true);
create policy capturar on adjuntos for insert to authenticated with check (created_by = auth.uid());
create policy admin_borra on adjuntos for delete to authenticated using (es_admin());

create policy ver on historial for select to authenticated using (true);
-- Sin políticas de insert/update/delete: solo los triggers escriben aquí.

-- ---------------------------------------------------------------------
-- Almacenamiento de archivos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('adjuntos', 'adjuntos', false, 26214400)   -- 25 MB por archivo
on conflict (id) do nothing;

create policy adjuntos_ver on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos');
create policy adjuntos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos');
create policy adjuntos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'adjuntos' and es_admin());

-- ---------------------------------------------------------------------
-- Vista para la lista de expedientes
-- ---------------------------------------------------------------------
create or replace view v_expedientes with (security_invoker = true) as
select e.*,
       m.nombre  as materia,
       et.nombre as etapa,
       p.nombre  as responsable,
       (select min(pl.vencimiento) from plazos pl
         where pl.expediente_id = e.id and pl.estado = 'abierto') as proximo_vencimiento,
       (select count(*) from plazos pl
         where pl.expediente_id = e.id and pl.estado = 'abierto') as plazos_abiertos,
       (select count(*) from bitacora b
         where b.expediente_id = e.id and b.tipo = 'pendiente' and not b.cumplido) as pendientes_abiertos
from expedientes e
join materias m  on m.id = e.materia_id
join etapas  et  on et.id = e.etapa_id
join perfiles p  on p.id = e.responsable_id;

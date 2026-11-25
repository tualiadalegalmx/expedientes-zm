-- Migración 008 · Solo Zaida, Rafael y Ricardo dejan un plazo "sin efecto" (24 nov 2026)
-- (roles admin, administrativo y desarrollo). Se puede correr más de una vez.

create or replace function puede_anular_plazo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo
                 and rol in ('admin', 'administrativo', 'desarrollo'));
$$;

-- Nadie más puede cambiar un plazo a "sin efecto", ni desde la app ni por fuera.
create or replace function reglas_plazo() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and new.estado = 'sin_efecto' and old.estado <> 'sin_efecto'
     and not puede_anular_plazo() then
    raise exception 'Solo Zaida, Rafael y Ricardo pueden dejar un plazo sin efecto.';
  end if;
  return new;
end $$;
drop trigger if exists t_reglas on plazos;
create trigger t_reglas before update on plazos for each row execute function reglas_plazo();

-- Rafael y Ricardo no son responsables de los expedientes, así que lo hacen
-- con esta función (que solo cambia el estado; no les abre otros cambios).
create or replace function anular_plazo(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede_anular_plazo() then
    raise exception 'Solo Zaida, Rafael y Ricardo pueden dejar un plazo sin efecto.';
  end if;
  update plazos set estado = 'sin_efecto' where id = p_id and estado = 'abierto';
end $$;
revoke all on function anular_plazo(uuid) from public;
grant execute on function anular_plazo(uuid) to authenticated;

select 'Listo: solo admin, administrativo y desarrollo pueden dejar plazos sin efecto' as resultado;

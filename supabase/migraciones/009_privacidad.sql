-- Migración 009 · Tareas y agenda personales (24 nov 2026)
-- Cada quien ve solo sus tareas y sus actividades de agenda; Zaida (admin)
-- ve las de todos. Lo legal (expedientes, plazos, audiencias, pendientes)
-- sigue siendo común para todo el despacho. Se puede correr más de una vez.

-- Tareas: solo su responsable, quien la creó (p. ej. Zaida al asignarla) y Zaida.
drop policy if exists ver on tareas;
create policy ver on tareas for select to authenticated
  using (es_admin() or responsable_id = auth.uid() or created_by = auth.uid());

-- Agenda del calendario: igual.
drop policy if exists ver on agenda;
create policy ver on agenda for select to authenticated
  using (es_admin() or responsable_id = auth.uid() or created_by = auth.uid());

-- El historial de cambios guarda copias de cada registro: las de tareas y
-- agenda tampoco las ven los demás.
drop policy if exists ver on historial;
create policy ver on historial for select to authenticated
  using (
    tabla not in ('tareas', 'agenda')
    or es_admin()
    or usuario_id = auth.uid()
    or despues->>'responsable_id' = auth.uid()::text
    or antes->>'responsable_id'   = auth.uid()::text
  );

select 'Listo: tareas y agenda ahora son personales' as resultado;

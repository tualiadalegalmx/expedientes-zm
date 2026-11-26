-- Migración 016 · Zaida, Rafael y Ricardo pueden eliminar expedientes (26 nov 2026)
-- Al eliminar un expediente se borran también su bitácora, plazos y archivos.
-- El historial de cambios conserva una copia. Requiere la 014. Se puede correr más de una vez.

drop policy if exists admin_borra on expedientes;
drop policy if exists equipo_borra on expedientes;
create policy equipo_borra on expedientes for delete to authenticated using (es_equipo_docs());

-- Para poder borrar también los archivos adjuntos del expediente.
drop policy if exists adjuntos_borrar on storage.objects;
create policy adjuntos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'adjuntos' and es_equipo_docs());

select 'Listo: Zaida, Rafael y Ricardo pueden eliminar expedientes' as resultado;

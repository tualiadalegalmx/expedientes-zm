-- Migración 006 · Recordatorios (24 nov 2026)
-- "Recordarme N días antes" para la agenda y para los plazos.
-- Vacío = sin recordatorio adicional (los plazos igual avisan en rojo a 2 días).
-- Se puede correr más de una vez.
alter table agenda add column if not exists recordar_dias int check (recordar_dias between 0 and 30);
alter table plazos add column if not exists recordar_dias int check (recordar_dias between 0 and 30);
select 'Recordatorios habilitados' as resultado;

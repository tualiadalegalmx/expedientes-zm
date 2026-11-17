-- Migración 002 · Etapas procesales (17 nov 2026)
-- Deja visibles solo: Inicio, Admisión, Informe previo, Informe justificado,
-- Sentencia y Recurso. Las demás se ocultan del menú, pero no se borran:
-- los expedientes que ya las usan las conservan hasta que alguien los edite.
-- Se puede correr más de una vez sin problema.

alter table etapas add column if not exists activa boolean not null default true;

update etapas set nombre = 'Inicio'         where nombre = 'Demanda / inicio';
update etapas set nombre = 'Informe previo' where nombre = 'Informes previo y justificado';
insert into etapas (nombre) values ('Inicio'), ('Admisión'), ('Informe previo'),
  ('Informe justificado'), ('Sentencia'), ('Recurso')
on conflict (nombre) do nothing;

update etapas set activa = nombre in
  ('Inicio', 'Admisión', 'Informe previo', 'Informe justificado', 'Sentencia', 'Recurso');

update etapas set orden = case nombre
  when 'Inicio' then 1 when 'Admisión' then 2 when 'Informe previo' then 3
  when 'Informe justificado' then 4 when 'Sentencia' then 5 when 'Recurso' then 6
  else orden end;

select nombre, activa, orden from etapas order by activa desc, orden;

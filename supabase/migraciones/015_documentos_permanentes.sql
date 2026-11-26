-- Migración 015 · Documentos permanentes en el expediente de empresas (26 nov 2026)
-- Los permanentes (poder notarial, acta constitutiva, currículum…) no pertenecen
-- a un mes: siempre se muestran y no se borran al limpiar un mes.
-- Requiere la 014. Se puede correr más de una vez.

alter table documentos_entidad add column if not exists permanente boolean not null default false;
create index if not exists documentos_entidad_perm_idx on documentos_entidad (entidad_id, permanente);

-- Lo que ya se haya subido de estos tipos pasa a permanentes.
update documentos_entidad set permanente = true
 where not permanente and categoria in ('Acta constitutiva', 'Poder notarial', 'Identificación oficial', 'Currículum');

select 'Listo: documentos permanentes habilitados' as resultado;

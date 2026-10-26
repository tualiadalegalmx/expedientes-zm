-- Prueba de reglas de permisos. Correr después de stub_supabase.sql y schema.sql.
\set ON_ERROR_STOP 0
grant usage on schema public, auth to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema auth to authenticated;

insert into auth.users(id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'zaida@x.mx', '{"nombre":"Zaida"}'),
 ('00000000-0000-0000-0000-00000000000b', 'uriel@x.mx', '{"nombre":"Uriel"}'),
 ('00000000-0000-0000-0000-00000000000c', 'diego@x.mx', '{"nombre":"Diego"}');
update perfiles set rol = 'admin' where nombre = 'Zaida';

set role authenticated;
-- Uriel captura un expediente y un registro
select set_config('request.uid', '00000000-0000-0000-0000-00000000000b', false);
insert into expedientes (id, numero, juzgado, autoridad, lugar, cliente, materia_id, responsable_id, etapa_id)
values ('11111111-1111-1111-1111-111111111111', '850/2023', 'Cuarto', 'Juzgado Cuarto de Distrito', 'Veracruz', 'Grupo MAS', 1,
        '00000000-0000-0000-0000-00000000000b', 1);
insert into bitacora (id, expediente_id, tipo, descripcion)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'estudio', 'Revisión del expediente');
\echo 'Esperado: Uriel no puede reasignar (error)'
update expedientes set responsable_id = '00000000-0000-0000-0000-00000000000c' where numero = '850/2023';
\echo 'Esperado: Uriel no puede borrar su registro (0 filas)'
delete from bitacora where id = '22222222-2222-2222-2222-222222222222';

-- Diego intenta tocar lo de Uriel
select set_config('request.uid', '00000000-0000-0000-0000-00000000000c', false);
\echo 'Esperado: Diego ve el registro (1)'
select count(*) from bitacora;
\echo 'Esperado: Diego no edita registro ajeno (UPDATE 0)'
update bitacora set descripcion = 'cambio' where id = '22222222-2222-2222-2222-222222222222';
\echo 'Esperado: Diego no puede capturar a nombre de otro (error RLS)'
insert into bitacora (expediente_id, tipo, descripcion, created_by)
values ('11111111-1111-1111-1111-111111111111', 'estudio', 'x', '00000000-0000-0000-0000-00000000000b');

-- Zaida
select set_config('request.uid', '00000000-0000-0000-0000-00000000000a', false);
\echo 'Esperado: Zaida reasigna (UPDATE 1)'
update expedientes set responsable_id = '00000000-0000-0000-0000-00000000000c' where numero = '850/2023';
\echo 'Esperado: Zaida borra (DELETE 1)'
delete from bitacora where id = '22222222-2222-2222-2222-222222222222';
\echo 'Esperado: nadie borra el historial (error)'
reset role;
delete from historial;
\echo 'Historial registrado:'
select tabla, accion, (select nombre from perfiles where id = usuario_id) as usuario from historial order by id;
select numero, ultimo_movimiento is not null as mov from expedientes;

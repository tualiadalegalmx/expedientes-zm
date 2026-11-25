-- Migración 007 · Tipo de registro "Término" en la bitácora (24 nov 2026)
-- Se puede correr más de una vez.
alter type tipo_registro add value if not exists 'termino';

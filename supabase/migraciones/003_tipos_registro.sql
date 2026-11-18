-- Migración 003 · Nuevos tipos de registro en la bitácora (17 nov 2026)
-- Gestiones, Retroalimentación y Atendido. Se puede correr más de una vez.
alter type tipo_registro add value if not exists 'gestion';
alter type tipo_registro add value if not exists 'retroalimentacion';
alter type tipo_registro add value if not exists 'atendido';

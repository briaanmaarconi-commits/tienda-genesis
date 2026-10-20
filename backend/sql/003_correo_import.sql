-- Estado de la importación automática del envío a MiCorreo (Correo Argentino).
-- NULL = nunca intentado / no aplica; importando | importado | error.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS correo_import_status text,
  ADD COLUMN IF NOT EXISTS correo_import_error text,
  ADD COLUMN IF NOT EXISTS correo_imported_at timestamptz;

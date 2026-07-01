-- Color / tema del menú elegible desde Configuración (por organización).
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS tema text;
NOTIFY pgrst, 'reload schema';

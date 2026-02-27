-- ============================================================
-- SETUP SUPERADMIN — PulsoElectoral v3.0
-- ============================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Prerrequisito: 02_organizaciones.sql ya ejecutado
--
-- INSTRUCCIONES:
--   1. Ve a Supabase Dashboard → Authentication → Users
--   2. Copia el UID del superadmin
--   3. Reemplaza <UUID-SUPERADMIN> con ese UID
--   4. Reemplaza <EMAIL-SUPERADMIN> con el email del superadmin
--   5. Ejecuta este script
-- ============================================================

-- Paso 1: Actualizar nombre real de la organización principal
UPDATE organizaciones
SET
  nombre          = 'PulsoElectoral — Organización Principal',
  contacto_email  = '<EMAIL-SUPERADMIN>'
WHERE id = '00000000-0000-0000-0000-000000000001'::UUID;

-- Paso 2: Registrar al superadmin como miembro de la organización
INSERT INTO organizacion_miembros (organizacion_id, user_id, rol, activo)
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  '<UUID-SUPERADMIN>'::UUID,
  'superadmin',
  true
)
ON CONFLICT (organizacion_id, user_id)
DO UPDATE SET rol = 'superadmin', activo = true;

-- Paso 3: Verificación — debe regresar 1 fila con rol superadmin
SELECT
  au.email,
  om.rol,
  om.activo,
  o.nombre  AS organizacion,
  o.plan
FROM organizacion_miembros om
JOIN auth.users      au ON au.id = om.user_id
JOIN organizaciones   o ON  o.id = om.organizacion_id
WHERE om.user_id = '<UUID-SUPERADMIN>'::UUID;

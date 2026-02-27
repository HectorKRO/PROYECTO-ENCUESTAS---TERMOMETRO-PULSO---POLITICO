-- ============================================================
-- SETUP SUPERADMIN — PulsoElectoral v3.0
-- ============================================================
-- Superadmin: Héctor Kevin Rosas Ovando
-- Email:      lae.kevin.rosas@gmail.com
-- UUID:       02b564a1-d84c-4cf3-ab64-5216aeb2b96c
-- ============================================================

-- Paso 1: Actualizar nombre real de la organización principal
UPDATE organizaciones
SET
  nombre          = 'PulsoElectoral',
  contacto_email  = 'lae.kevin.rosas@gmail.com'
WHERE id = '00000000-0000-0000-0000-000000000001'::UUID;

-- Paso 2: Registrar al superadmin como miembro de la organización
INSERT INTO organizacion_miembros (organizacion_id, user_id, rol, activo)
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  '02b564a1-d84c-4cf3-ab64-5216aeb2b96c'::UUID,
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
WHERE om.user_id = '02b564a1-d84c-4cf3-ab64-5216aeb2b96c'::UUID;

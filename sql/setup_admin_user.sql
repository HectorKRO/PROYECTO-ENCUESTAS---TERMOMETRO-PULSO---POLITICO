-- ============================================================
-- SETUP: Crear usuario administrador inicial
-- ============================================================
-- Ejecutar ESTE script DESPUÉS de haber creado el usuario 
-- en Supabase Authentication (paso 1 manual)
-- ============================================================

-- ============================================================
-- PASO 1: Crear usuario en Supabase Authentication (MANUAL)
-- ============================================================
-- Ve a: Supabase Dashboard → Authentication → Users → "Add user"
-- Email: Lae.kevin.rosas@gmail.com
-- Password: (genera cualquiera, no se usará para login)

-- ============================================================
-- PASO 2: Crear candidato (EJECUTAR ESTO en SQL Editor)
-- ============================================================

-- Insertar candidato vinculado al usuario auth
INSERT INTO candidatos (
  nombre, 
  cargo, 
  partido, 
  municipio, 
  estado, 
  color_primario,
  color_secundario,
  auth_user_id, 
  activo
)
SELECT 
  'Hector Kevin Rosas Ovando',
  'Presidente Municipal',
  'MORENA',
  'Atlixco',
  'Puebla',
  '#1a3a5c',  -- Color primario
  '#c9a227',  -- Color secundario (dorado)
  id,         -- auth_user_id del usuario creado
  true
FROM auth.users 
WHERE email = 'Lae.kevin.rosas@gmail.com'
ON CONFLICT (auth_user_id) DO NOTHING
RETURNING id;

-- ============================================================
-- PASO 3: Crear campaña inicial
-- ============================================================

INSERT INTO campanas (
  candidato_id,
  nombre,
  fecha_inicio,
  fecha_fin,
  meta_encuestas,
  activa
)
SELECT 
  c.id,
  'Campaña Atlixco 2024 - Paco García',
  '2024-01-01',
  '2024-06-30',
  400,
  true
FROM candidatos c
JOIN auth.users u ON c.auth_user_id = u.id
WHERE u.email = 'Lae.kevin.rosas@gmail.com'
ON CONFLICT DO NOTHING
RETURNING id;

-- ============================================================
-- PASO 4: Configurar alertas (opcional)
-- ============================================================

INSERT INTO config_alertas (
  campana_id,
  milestones_activo,
  seccion_baja_activo,
  pico_activo,
  email_destino
)
SELECT 
  cp.id,
  true,
  true,
  true,
  'Lae.kevin.rosas@gmail.com'
FROM campanas cp
JOIN candidatos c ON cp.candidato_id = c.id
JOIN auth.users u ON c.auth_user_id = u.id
WHERE u.email = 'Lae.kevin.rosas@gmail.com'
ON CONFLICT (campana_id) DO NOTHING;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
DO $$
DECLARE
  v_user_exists boolean;
  v_candidato_exists boolean;
  v_campana_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'Lae.kevin.rosas@gmail.com') INTO v_user_exists;
  SELECT EXISTS(SELECT 1 FROM candidatos c JOIN auth.users u ON c.auth_user_id = u.id WHERE u.email = 'Lae.kevin.rosas@gmail.com') INTO v_candidato_exists;
  SELECT EXISTS(SELECT 1 FROM campanas cp JOIN candidatos c ON cp.candidato_id = c.id JOIN auth.users u ON c.auth_user_id = u.id WHERE u.email = 'Lae.kevin.rosas@gmail.com') INTO v_campana_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN DE SETUP';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Usuario auth: %', CASE WHEN v_user_exists THEN '✅ OK' ELSE '❌ NO EXISTE - Crea el usuario en Authentication primero' END;
  RAISE NOTICE 'Candidato: %', CASE WHEN v_candidato_exists THEN '✅ OK' ELSE '❌ NO CREADO' END;
  RAISE NOTICE 'Campaña: %', CASE WHEN v_campana_exists THEN '✅ OK' ELSE '❌ NO CREADA' END;
  RAISE NOTICE '========================================';
  
  IF v_user_exists AND v_candidato_exists AND v_campana_exists THEN
    RAISE NOTICE '✅ Setup completo. Puedes acceder al sistema.';
  ELSE
    RAISE NOTICE '⚠️  Revisa los pasos anteriores.';
  END IF;
END $$;

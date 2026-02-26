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
-- Primero verificar si ya existe
DO $$
DECLARE
  v_auth_user_id UUID;
  v_candidato_id UUID;
BEGIN
  -- Obtener el auth_user_id
  SELECT id INTO v_auth_user_id
  FROM auth.users 
  WHERE email = 'Lae.kevin.rosas@gmail.com';
  
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado en auth.users. Crea el usuario primero en Authentication.';
  END IF;
  
  -- Verificar si candidato ya existe
  SELECT id INTO v_candidato_id
  FROM candidatos
  WHERE auth_user_id = v_auth_user_id;
  
  IF v_candidato_id IS NULL THEN
    INSERT INTO candidatos (
      nombre, cargo, partido, municipio, estado, 
      color_primario, color_secundario, auth_user_id, activo
    ) VALUES (
      'Hector Kevin Rosas Ovando',
      'Presidente Municipal',
      'MORENA',
      'Atlixco',
      'Puebla',
      '#1a3a5c',
      '#c9a227',
      v_auth_user_id,
      true
    )
    RETURNING id INTO v_candidato_id;
    
    RAISE NOTICE '✅ Candidato creado con ID: %', v_candidato_id;
  ELSE
    RAISE NOTICE 'ℹ️ Candidato ya existe con ID: %', v_candidato_id;
  END IF;
END $$;

-- ============================================================
-- PASO 3: Crear campaña inicial
-- ============================================================

DO $$
DECLARE
  v_candidato_id UUID;
  v_campana_id UUID;
BEGIN
  -- Obtener el candidato_id
  SELECT c.id INTO v_candidato_id
  FROM candidatos c
  JOIN auth.users u ON c.auth_user_id = u.id
  WHERE u.email = 'Lae.kevin.rosas@gmail.com';
  
  IF v_candidato_id IS NULL THEN
    RAISE EXCEPTION 'Candidato no encontrado. Ejecuta el Paso 2 primero.';
  END IF;
  
  -- Verificar si ya existe una campaña para este candidato
  SELECT id INTO v_campana_id
  FROM campanas
  WHERE candidato_id = v_candidato_id
    AND nombre = 'Campaña Atlixco 2024 - Paco García';
  
  IF v_campana_id IS NULL THEN
    INSERT INTO campanas (
      candidato_id, nombre, fecha_inicio, fecha_fin, meta_encuestas, activa
    ) VALUES (
      v_candidato_id,
      'Campaña Atlixco 2024 - Paco García',
      '2024-01-01',
      '2024-06-30',
      400,
      true
    )
    RETURNING id INTO v_campana_id;
    
    RAISE NOTICE '✅ Campaña creada con ID: %', v_campana_id;
  ELSE
    RAISE NOTICE 'ℹ️ Campaña ya existe con ID: %', v_campana_id;
  END IF;
END $$;

-- ============================================================
-- PASO 4: Configurar alertas (opcional)
-- ============================================================

DO $$
DECLARE
  v_campana_id UUID;
  v_config_exists boolean;
BEGIN
  -- Obtener el campana_id
  SELECT cp.id INTO v_campana_id
  FROM campanas cp
  JOIN candidatos c ON cp.candidato_id = c.id
  JOIN auth.users u ON c.auth_user_id = u.id
  WHERE u.email = 'Lae.kevin.rosas@gmail.com'
  LIMIT 1;
  
  IF v_campana_id IS NULL THEN
    RAISE EXCEPTION 'Campaña no encontrada. Ejecuta el Paso 3 primero.';
  END IF;
  
  -- Verificar si ya existe config
  SELECT EXISTS(SELECT 1 FROM config_alertas WHERE campana_id = v_campana_id) INTO v_config_exists;
  
  IF NOT v_config_exists THEN
    INSERT INTO config_alertas (
      campana_id, milestones_activo, seccion_baja_activo, pico_activo, email_destino
    ) VALUES (
      v_campana_id,
      true,
      true,
      true,
      'Lae.kevin.rosas@gmail.com'
    );
    
    RAISE NOTICE '✅ Configuración de alertas creada';
  ELSE
    RAISE NOTICE 'ℹ️ Configuración de alertas ya existe';
  END IF;
END $$;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
DO $$
DECLARE
  v_user_exists boolean;
  v_candidato_exists boolean;
  v_campana_exists boolean;
  v_campana_id UUID;
BEGIN
  -- Verificar usuario auth
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'Lae.kevin.rosas@gmail.com') INTO v_user_exists;
  
  -- Verificar candidato
  SELECT EXISTS(
    SELECT 1 FROM candidatos c 
    JOIN auth.users u ON c.auth_user_id = u.id 
    WHERE u.email = 'Lae.kevin.rosas@gmail.com'
  ) INTO v_candidato_exists;
  
  -- Verificar campaña y obtener ID
  SELECT cp.id INTO v_campana_id
  FROM campanas cp
  JOIN candidatos c ON cp.candidato_id = c.id
  JOIN auth.users u ON c.auth_user_id = u.id
  WHERE u.email = 'Lae.kevin.rosas@gmail.com'
  LIMIT 1;
  
  v_campana_exists := (v_campana_id IS NOT NULL);
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN DE SETUP';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Usuario auth: %', CASE WHEN v_user_exists THEN '✅ OK' ELSE '❌ NO EXISTE - Crea el usuario en Authentication primero' END;
  RAISE NOTICE 'Candidato: %', CASE WHEN v_candidato_exists THEN '✅ OK' ELSE '❌ NO CREADO' END;
  RAISE NOTICE 'Campaña: %', CASE WHEN v_campana_exists THEN '✅ OK' ELSE '❌ NO CREADA' END;
  RAISE NOTICE '========================================';
  
  IF v_user_exists AND v_candidato_exists AND v_campana_exists THEN
    RAISE NOTICE '✅ Setup completo. Puedes acceder al sistema.';
    RAISE NOTICE '';
    RAISE NOTICE 'URLs de acceso:';
    RAISE NOTICE '  Dashboard: /dashboard?campana=%', v_campana_id;
    RAISE NOTICE '  Admin: /admin';
    RAISE NOTICE '  War Room: /war-room?campana=%', v_campana_id;
  ELSE
    RAISE NOTICE '⚠️  Revisa los pasos anteriores.';
  END IF;
END $$;

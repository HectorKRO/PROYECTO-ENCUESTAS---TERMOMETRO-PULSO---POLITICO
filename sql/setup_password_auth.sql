-- ============================================================================
-- SETUP: Autenticación con Contraseña para Usuario Existente
-- ============================================================================
-- Este script establece una contraseña para un usuario existente en Supabase Auth
-- 
-- INSTRUCCIONES:
-- 1. Ejecutar en Supabase Dashboard → SQL Editor
-- 2. Cambiar 'TU_CONTRASEÑA_SEGURA' por la contraseña deseada
-- 3. El email debe coincidir con el usuario ya creado en auth.users
-- ============================================================================

-- Configurar la contraseña para el usuario administrador
-- Nota: Supabase hashea automáticamente la contraseña

DO $$
DECLARE
  v_email TEXT := 'lae.kevin.rosas@gmail.com';
  v_new_password TEXT := 'PacoGarcia2024!';  -- ⚠️ CAMBIA ESTA CONTRASEÑA
  v_user_id UUID;
BEGIN
  -- Buscar el usuario
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario con email % no encontrado en auth.users', v_email;
  END IF;
  
  -- Actualizar la contraseña usando la función de Supabase
  UPDATE auth.users 
  SET encrypted_password = crypt(v_new_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),  -- Confirmar email si no lo está
      updated_at = NOW()
  WHERE id = v_user_id;
  
  RAISE NOTICE '✅ Contraseña actualizada exitosamente para: %', v_email;
  RAISE NOTICE '   User ID: %', v_user_id;
  RAISE NOTICE '';
  RAISE NOTICE '🔐 Credenciales de acceso:';
  RAISE NOTICE '   Email: %', v_email;
  RAISE NOTICE '   Contraseña: %', v_new_password;
  
END $$;

-- ============================================================================
-- VERIFICACIÓN: Confirmar que el usuario tiene contraseña configurada
-- ============================================================================
SELECT 
  id,
  email,
  CASE 
    WHEN encrypted_password IS NOT NULL THEN '✅ Configurada'
    ELSE '❌ No configurada'
  END as password_status,
  email_confirmed_at,
  last_sign_in_at,
  created_at
FROM auth.users 
WHERE email = 'lae.kevin.rosas@gmail.com';

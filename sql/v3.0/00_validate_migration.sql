-- ============================================================
-- VALIDACIÓN POST-MIGRACIÓN v3.0
-- ============================================================
-- Ejecutar DESPUÉS de todos los scripts de migración
-- para verificar que todo se aplicó correctamente
-- ============================================================

DO $$
DECLARE
  -- Contadores
  v_estados INT;
  v_municipios INT;
  v_secciones_sin_mun INT;
  v_colonias_sin_mun INT;
  v_org_legacy INT;
  v_mun_access INT;
  v_cand_sin_org INT;
  v_campanas_sin_org INT;
  v_campanas_sin_mun INT;
  v_resp_sin_org INT;
  v_resp_sin_mun INT;
  v_policies_count INT;
  v_errores INT := 0;
BEGIN
  RAISE NOTICE E'\n========================================';
  RAISE NOTICE 'VALIDACIÓN POST-MIGRACIÓN v3.0';
  RAISE NOTICE '========================================\n';

  -- 1. Validar catálogo geográfico
  SELECT COUNT(*) INTO v_estados FROM estados;
  SELECT COUNT(*) INTO v_municipios FROM municipios;
  
  RAISE NOTICE '1. Catálogo Geográfico: % estados, % municipios', v_estados, v_municipios;
  
  IF v_municipios = 0 THEN
    RAISE NOTICE '   ❌ ERROR: No hay municipios';
    v_errores := v_errores + 1;
  ELSE
    RAISE NOTICE '   ✅ OK';
  END IF;

  -- 2. Validar secciones
  SELECT COUNT(*) INTO v_secciones_sin_mun
  FROM secciones_electorales WHERE municipio_id IS NULL;
  
  RAISE NOTICE '2. Secciones sin municipio_id: %', v_secciones_sin_mun;
  
  IF v_secciones_sin_mun > 0 THEN
    RAISE NOTICE '   ❌ ERROR: % secciones sin municipio', v_secciones_sin_mun;
    v_errores := v_errores + 1;
  ELSE
    RAISE NOTICE '   ✅ OK';
  END IF;

  -- 3. Validar colonias
  SELECT COUNT(*) INTO v_colonias_sin_mun
  FROM colonias WHERE municipio_id IS NULL;
  
  RAISE NOTICE '3. Colonias sin municipio_id: %', v_colonias_sin_mun;
  
  IF v_colonias_sin_mun > 0 THEN
    RAISE NOTICE '   ❌ ERROR: % colonias sin municipio', v_colonias_sin_mun;
    v_errores := v_errores + 1;
  ELSE
    RAISE NOTICE '   ✅ OK';
  END IF;

  -- 4. Validar organización legacy
  SELECT COUNT(*) INTO v_org_legacy
  FROM organizaciones
  WHERE id = '00000000-0000-0000-0000-000000000001'::UUID;
  
  RAISE NOTICE '4. Organización legacy: %', v_org_legacy;
  
  IF v_org_legacy = 0 THEN
    RAISE NOTICE '   ❌ ERROR: No existe organización legacy';
    v_errores := v_errores + 1;
  ELSE
    RAISE NOTICE '   ✅ OK';
  END IF;

  -- 5. Validar acceso a Atlixco
  SELECT COUNT(*) INTO v_mun_access
  FROM organizacion_municipios
  WHERE organizacion_id = '00000000-0000-0000-0000-000000000001'::UUID
    AND municipio_id = 1;
  
  RAISE NOTICE '5. Acceso org legacy a Atlixco: %', v_mun_access;
  
  IF v_mun_access = 0 THEN
    RAISE NOTICE '   ❌ ERROR: Org legacy sin acceso a Atlixco';
    v_errores := v_errores + 1;
  ELSE
    RAISE NOTICE '   ✅ OK';
  END IF;

  -- 6. Validar candidatos
  SELECT COUNT(*) INTO v_cand_sin_org
  FROM candidatos WHERE organizacion_id IS NULL;
  
  RAISE NOTICE '6. Candidatos sin organizacion_id: %', v_cand_sin_org;
  
  IF v_cand_sin_org > 0 THEN
    RAISE NOTICE '   ❌ ERROR: % candidatos sin org', v_cand_sin_org;
    v_errores := v_errores + 1;
  ELSE
    RAISE NOTICE '   ✅ OK';
  END IF;

  -- 7. Validar campanas
  SELECT COUNT(*) INTO v_campanas_sin_org
  FROM campanas WHERE organizacion_id IS NULL;
  
  SELECT COUNT(*) INTO v_campanas_sin_mun
  FROM campanas WHERE municipio_id IS NULL;
  
  RAISE NOTICE '7. Campanas sin org: %, sin mun: %', v_campanas_sin_org, v_campanas_sin_mun;
  
  IF v_campanas_sin_org > 0 OR v_campanas_sin_mun > 0 THEN
    RAISE NOTICE '   ❌ ERROR: Campanas incompletas';
    v_errores := v_errores + 1;
  ELSE
    RAISE NOTICE '   ✅ OK';
  END IF;

  -- 8. Validar respuestas
  SELECT COUNT(*) INTO v_resp_sin_org
  FROM respuestas WHERE organizacion_id IS NULL;
  
  SELECT COUNT(*) INTO v_resp_sin_mun
  FROM respuestas WHERE municipio_id IS NULL;
  
  RAISE NOTICE '8. Respuestas sin org: %, sin mun: %', v_resp_sin_org, v_resp_sin_mun;
  
  IF v_resp_sin_org > 0 OR v_resp_sin_mun > 0 THEN
    RAISE NOTICE '   ❌ ERROR: Respuestas incompletas';
    v_errores := v_errores + 1;
  ELSE
    RAISE NOTICE '   ✅ OK';
  END IF;

  -- 9. Validar RLS — verificar políticas críticas por nombre (BugAudit-G1, G3)
  SELECT COUNT(*) INTO v_policies_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE '9. Políticas RLS creadas: %', v_policies_count;

  -- BugAudit-G3: Verificar política anon INSERT (crítica — sin ella las encuestas no se envían)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'respuestas'
      AND policyname = 'encuesta_publica_insertar_v3'
  ) THEN
    RAISE NOTICE '   ❌ ERROR: Falta encuesta_publica_insertar_v3 — encuestas anónimas BLOQUEADAS';
    v_errores := v_errores + 1;
  ELSE
    RAISE NOTICE '   ✅ Política anon INSERT en respuestas: OK';
  END IF;

  -- BugAudit-G1: Verificar política unificada AND (aislamiento multi-tenant)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'respuestas'
      AND policyname = 'respuestas_isolation_completa'
  ) THEN
    RAISE NOTICE '   ❌ ERROR: Falta respuestas_isolation_completa — sin aislamiento de datos';
    v_errores := v_errores + 1;
  ELSE
    RAISE NOTICE '   ✅ Política aislamiento respuestas: OK';
  END IF;

  -- Verificar que RLS está habilitado en tablas nuevas
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'organizaciones' AND c.relrowsecurity = true
  ) THEN
    RAISE NOTICE '   ❌ ERROR: RLS no habilitado en organizaciones — datos de tenants expuestos';
    v_errores := v_errores + 1;
  ELSE
    RAISE NOTICE '   ✅ RLS en organizaciones: OK';
  END IF;

  -- RESUMEN FINAL
  RAISE NOTICE E'\n========================================';
  IF v_errores = 0 THEN
    RAISE NOTICE '✅ VALIDACIÓN EXITOSA: Todo listo para v3.0';
  ELSE
    RAISE EXCEPTION '❌ VALIDACIÓN FALLÓ: % errores encontrados', v_errores;
  END IF;
  RAISE NOTICE '========================================\n';

END $$;

-- ============================================================================
-- VERIFICACIÓN POST-DEPLOY v3.0
-- Ejecutar después de completar el deploy para validar todo funciona
-- ============================================================================

\echo '========================================'
\echo 'VERIFICACIÓN POST-DEPLOY v3.0'
\echo '========================================'

DO $$
DECLARE
    v_passed INT := 0;
    v_total INT := 10;
    v_count INT;
BEGIN

-- Test 1: RLS habilitado en tablas críticas
SELECT COUNT(*) INTO v_count 
FROM pg_tables t
JOIN pg_class c ON t.tablename = c.relname
WHERE t.schemaname = 'public' 
AND t.tablename IN ('respuestas', 'campanas', 'encuestadores')
AND c.relrowsecurity = true;

IF v_count >= 3 THEN
    RAISE NOTICE '[✓] RLS habilitado en tablas críticas';
    v_passed := v_passed + 1;
ELSE
    RAISE NOTICE '[✗] RLS no habilitado en todas las tablas';
END IF;

-- Test 2: Columnas multi-tenant existen
SELECT COUNT(*) INTO v_count 
FROM information_schema.columns 
WHERE table_name = 'respuestas' 
AND column_name IN ('organizacion_id', 'municipio_id');

IF v_count = 2 THEN
    RAISE NOTICE '[✓] Columnas multi-tenant en respuestas';
    v_passed := v_passed + 1;
ELSE
    RAISE NOTICE '[✗] Faltan columnas multi-tenant';
END IF;

-- Test 3: Política de duración usa 30s (no 45s)
-- F4-BUG-04 FIX: Usar with_check en lugar de qual para políticas INSERT
SELECT COUNT(*) INTO v_count 
FROM pg_policies 
WHERE tablename = 'respuestas' 
AND policyname = 'encuesta_publica_insertar_v3'
AND (pg_get_expr(qual, 'respuestas'::regclass) LIKE '%30%' 
     OR pg_get_expr(with_check, 'respuestas'::regclass) LIKE '%30%');

IF v_count > 0 THEN
    RAISE NOTICE '[✓] Umbral de duración es 30s (corregido)';
    v_passed := v_passed + 1;
ELSE
    RAISE NOTICE '[✗] Umbral de duración no es 30s';
END IF;

-- Test 4: Organizaciones creadas
SELECT COUNT(*) INTO v_count FROM organizaciones WHERE activa = true;

IF v_count >= 1 THEN
    RAISE NOTICE '[✓] Organizaciones activas: %', v_count;
    v_passed := v_passed + 1;
ELSE
    RAISE NOTICE '[✗] No hay organizaciones activas';
END IF;

-- Test 5: Municipios con datos
SELECT COUNT(*) INTO v_count FROM municipios;

IF v_count >= 1 THEN
    RAISE NOTICE '[✓] Municipios disponibles: %', v_count;
    v_passed := v_passed + 1;
ELSE
    RAISE NOTICE '[✗] No hay municipios';
END IF;

-- Test 6: Secciones geográficas cargadas
SELECT COUNT(*) INTO v_count FROM secciones_electorales;

IF v_count >= 60 THEN
    RAISE NOTICE '[✓] Secciones cargadas: %', v_count;
    v_passed := v_passed + 1;
ELSE
    RAISE NOTICE '[✗] Pocas secciones cargadas';
END IF;

-- Test 7: Colonias cargadas
SELECT COUNT(*) INTO v_count FROM colonias WHERE activa = true;

IF v_count >= 400 THEN
    RAISE NOTICE '[✓] Colonias activas: %', v_count;
    v_passed := v_passed + 1;
ELSE
    RAISE NOTICE '[✗] Pocas colonias activas';
END IF;

-- Test 8: Vistas v3.0 creadas
SELECT COUNT(*) INTO v_count 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name LIKE 'v_metricas_%';

IF v_count >= 4 THEN
    RAISE NOTICE '[✓] Vistas v3.0 creadas: %', v_count;
    v_passed := v_passed + 1;
ELSE
    RAISE NOTICE '[✗] Faltan vistas v3.0';
END IF;

-- Test 9: Políticas RLS específicas de aislamiento (F4-BUG-05 FIX)
-- Verificar que existen las políticas críticas de aislamiento multi-tenant
SELECT COUNT(*) INTO v_count 
FROM pg_policies 
WHERE tablename = 'respuestas' 
AND policyname IN ('respuestas_isolation_completa', 'encuesta_publica_insertar_v3');

IF v_count >= 2 THEN
    RAISE NOTICE '[✓] Políticas de aislamiento configuradas';
    v_passed := v_passed + 1;
ELSE
    RAISE NOTICE '[✗] Faltan políticas de aislamiento';
END IF;

-- Test 10: Índices de performance en respuestas (creados por 03_respuestas_contexto.sql)
SELECT COUNT(*) INTO v_count
FROM pg_indexes
WHERE tablename = 'respuestas'
AND indexname LIKE '%municipio%';

IF v_count >= 1 THEN
    RAISE NOTICE '[✓] Índices de municipio presentes en respuestas: %', v_count;
    v_passed := v_passed + 1;
ELSE
    RAISE NOTICE '[✗] Faltan índices de municipio en respuestas';
END IF;

-- Resumen (F4-BUG-06 FIX: Reemplazar \echo con RAISE NOTICE dentro del bloque DO)
RAISE NOTICE '';
RAISE NOTICE '========================================';
RAISE NOTICE 'RESULTADO: %/% tests pasaron', v_passed, v_total;
IF v_passed = v_total THEN
    RAISE NOTICE '✅ DEPLOY EXITOSO — Todo verificado';
ELSE
    RAISE NOTICE '⚠️  REVISAR — Algunos tests fallaron';
END IF;
RAISE NOTICE '========================================';

END $$;

-- Verificación adicional: Últimas encuestas con contexto
\echo ''
\echo '--- Muestra de últimas encuestas (si existen) ---'
SELECT 
    id,
    campana_id,
    organizacion_id,
    municipio_id,
    created_at
FROM respuestas 
ORDER BY created_at DESC 
LIMIT 5;

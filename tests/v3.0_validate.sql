-- ============================================================================
-- TESTS DE VALIDACIÓN MIGRACIÓN v3.0 (Multi-municipio/Multi-tenant)
-- Ejecutar después de aplicar todos los scripts SQL v3.0
-- Resultado: Todos los tests deben pasar (✓) antes de deploy a producción
-- ============================================================================

-- ============================================================================
-- TESTS DENTRO DE UN BLOQUE DO ANÓNIMO
-- ============================================================================
DO $$
DECLARE
    v_failures INT := 0;
    v_total INT := 11;
    v_count INT;
    v_expected INT;
BEGIN

-- ============================================================================
-- TEST 1: Columnas organizacion_id existen en tablas críticas
-- ============================================================================
BEGIN
    SELECT COUNT(*) INTO v_count FROM information_schema.columns 
    WHERE table_name IN ('respuestas', 'campanas') 
    AND column_name = 'organizacion_id';
    
    -- Solo respuestas y campanas tienen organizacion_id (encuestadores NO)
    IF v_count < 2 THEN
        RAISE EXCEPTION 'TEST 1 FALLÓ: Solo %/2 tablas tienen organizacion_id', v_count;
    END IF;
    
    RAISE NOTICE '[TEST 1] ✓ PASÓ: Columnas organizacion_id existen en % tablas', v_count;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[TEST 1] ✗ FALLÓ: %', SQLERRM;
    v_failures := v_failures + 1;
END;

-- ============================================================================
-- TEST 2: Columnas municipio_id existen en tablas críticas
-- ============================================================================
BEGIN
    SELECT COUNT(*) INTO v_count FROM information_schema.columns 
    WHERE table_name IN ('respuestas', 'campanas', 'colonias', 'secciones_electorales') 
    AND column_name = 'municipio_id';
    
    -- encuestadores NO tiene municipio_id (se asigna por campaña)
    IF v_count < 4 THEN
        RAISE EXCEPTION 'TEST 2 FALLÓ: Solo %/4 tablas tienen municipio_id', v_count;
    END IF;
    
    RAISE NOTICE '[TEST 2] ✓ PASÓ: Columnas municipio_id existen en % tablas', v_count;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[TEST 2] ✗ FALLÓ: %', SQLERRM;
    v_failures := v_failures + 1;
END;

-- ============================================================================
-- TEST 3: Foreign keys válidas (sin violaciones de integridad)
-- ============================================================================
BEGIN
    -- Verificar que no hay respuestas con organizacion_id inexistente
    SELECT COUNT(*) INTO v_count 
    FROM respuestas r 
    LEFT JOIN organizaciones o ON r.organizacion_id = o.id 
    WHERE r.organizacion_id IS NOT NULL AND o.id IS NULL;
    
    IF v_count > 0 THEN
        RAISE EXCEPTION 'TEST 3 FALLÓ: % respuestas con organizacion_id inválido', v_count;
    END IF;
    
    -- Verificar que no hay respuestas con municipio_id inexistente
    SELECT COUNT(*) INTO v_count 
    FROM respuestas r 
    LEFT JOIN municipios m ON r.municipio_id = m.id 
    WHERE r.municipio_id IS NOT NULL AND m.id IS NULL;
    
    IF v_count > 0 THEN
        RAISE EXCEPTION 'TEST 3 FALLÓ: % respuestas con municipio_id inválido', v_count;
    END IF;
    
    RAISE NOTICE '[TEST 3] ✓ PASÓ: Todas las foreign keys son válidas';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[TEST 3] ✗ FALLÓ: %', SQLERRM;
    v_failures := v_failures + 1;
END;

-- ============================================================================
-- TEST 4: RLS habilitado en tablas críticas
-- ============================================================================
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM pg_tables t
    JOIN pg_class c ON t.tablename = c.relname
    WHERE t.schemaname = 'public' 
    AND t.tablename IN ('respuestas', 'campanas', 'encuestadores', 'organizaciones', 'organizacion_miembros')
    AND c.relrowsecurity = true;
    
    IF v_count < 5 THEN
        RAISE EXCEPTION 'TEST 4 FALLÓ: Solo %/5 tablas tienen RLS habilitado', v_count;
    END IF;
    
    RAISE NOTICE '[TEST 4] ✓ PASÓ: RLS habilitado en % tablas críticas', v_count;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[TEST 4] ✗ FALLÓ: %', SQLERRM;
    v_failures := v_failures + 1;
END;

-- ============================================================================
-- TEST 5: Política respuestas_isolation_completa existe
-- ============================================================================
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM pg_policies 
    WHERE tablename = 'respuestas' AND policyname = 'respuestas_isolation_completa';
    
    IF v_count = 0 THEN
        RAISE EXCEPTION 'TEST 5 FALLÓ: Falta política respuestas_isolation_completa';
    END IF;
    
    RAISE NOTICE '[TEST 5] ✓ PASÓ: Política respuestas_isolation_completa existe';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[TEST 5] ✗ FALLÓ: %', SQLERRM;
    v_failures := v_failures + 1;
END;

-- ============================================================================
-- TEST 6: Política colonias_lectura_publica existe (nombre corregido)
-- ============================================================================
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM pg_policies 
    WHERE tablename = 'colonias' AND policyname = 'colonias_lectura_publica';
    
    IF v_count = 0 THEN
        RAISE EXCEPTION 'TEST 6 FALLÓ: Falta política colonias_lectura_publica';
    END IF;
    
    RAISE NOTICE '[TEST 6] ✓ PASÓ: Política colonias_lectura_publica existe';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[TEST 6] ✗ FALLÓ: %', SQLERRM;
    v_failures := v_failures + 1;
END;

-- ============================================================================
-- TEST 7: Índices de municipio creados
-- ============================================================================
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE '%municipio%';
    
    IF v_count < 3 THEN
        RAISE EXCEPTION 'TEST 7 FALLÓ: Solo % índices de municipio encontrados (min 3)', v_count;
    END IF;
    
    RAISE NOTICE '[TEST 7] ✓ PASÓ: % índices de municipio creados', v_count;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[TEST 7] ✗ FALLÓ: %', SQLERRM;
    v_failures := v_failures + 1;
END;

-- ============================================================================
-- TEST 8: Datos geográficos de Atlixco cargados
-- ============================================================================
BEGIN
    -- Verificar municipio Atlixco (ID = 1)
    SELECT COUNT(*) INTO v_count FROM municipios WHERE id = 1;
    IF v_count = 0 THEN
        RAISE EXCEPTION 'TEST 8 FALLÓ: Municipio Atlixco (id=1) no encontrado';
    END IF;
    
    -- Verificar secciones
    SELECT COUNT(*) INTO v_count FROM secciones_electorales WHERE municipio_id = 1;
    IF v_count < 60 THEN
        RAISE EXCEPTION 'TEST 8 FALLÓ: Solo % secciones en Atlixco (esperadas 68)', v_count;
    END IF;
    
    -- Verificar colonias
    SELECT COUNT(*) INTO v_count FROM colonias WHERE municipio_id = 1;
    IF v_count < 400 THEN
        RAISE EXCEPTION 'TEST 8 FALLÓ: Solo % colonias en Atlixco (esperadas 417)', v_count;
    END IF;
    
    RAISE NOTICE '[TEST 8] ✓ PASÓ: Datos geográficos de Atlixco cargados';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[TEST 8] ✗ FALLÓ: %', SQLERRM;
    v_failures := v_failures + 1;
END;

-- ============================================================================
-- TEST 9: Organización legacy migrada correctamente (UUID corregido)
-- ============================================================================
BEGIN
    -- UUID legacy correcto según 02_organizaciones.sql
    SELECT COUNT(*) INTO v_count FROM organizaciones WHERE id = '00000000-0000-0000-0000-000000000001';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'TEST 9 FALLÓ: Organización legacy no encontrada';
    END IF;
    
    -- Verificar que tiene municipio asignado
    SELECT COUNT(*) INTO v_count 
    FROM organizacion_municipios 
    WHERE organizacion_id = '00000000-0000-0000-0000-000000000001';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'TEST 9 FALLÓ: Organización legacy sin municipios asignados';
    END IF;
    
    RAISE NOTICE '[TEST 9] ✓ PASÓ: Organización legacy migrada con % municipio(s)', v_count;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[TEST 9] ✗ FALLÓ: %', SQLERRM;
    v_failures := v_failures + 1;
END;

-- ============================================================================
-- TEST 10: Respuestas legacy tienen organizacion_id y municipio_id
-- ============================================================================
BEGIN
    -- Contar respuestas sin organizacion_id
    SELECT COUNT(*) INTO v_count FROM respuestas WHERE organizacion_id IS NULL;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'TEST 10 FALLÓ: % respuestas sin organizacion_id', v_count;
    END IF;
    
    -- Contar respuestas sin municipio_id
    SELECT COUNT(*) INTO v_count FROM respuestas WHERE municipio_id IS NULL;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'TEST 10 FALLÓ: % respuestas sin municipio_id', v_count;
    END IF;
    
    RAISE NOTICE '[TEST 10] ✓ PASÓ: Todas las respuestas tienen contexto multi-tenant';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[TEST 10] ✗ FALLÓ: %', SQLERRM;
    v_failures := v_failures + 1;
END;

-- ============================================================================
-- TEST 11: Vistas v3.0 creadas correctamente (nombres corregidos)
-- ============================================================================
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name IN ('v_metricas_por_campana', 'v_metricas_por_municipio', 'v_metricas_por_seccion', 'v_metricas_por_colonia');
    
    IF v_count < 4 THEN
        RAISE EXCEPTION 'TEST 11 FALLÓ: Solo %/4 vistas v3.0 encontradas', v_count;
    END IF;
    
    RAISE NOTICE '[TEST 11] ✓ PASÓ: Vistas v3.0 creadas (%/4)', v_count;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[TEST 11] ✗ FALLÓ: %', SQLERRM;
    v_failures := v_failures + 1;
END;

-- ============================================================================
-- RESUMEN FINAL (dentro del bloque DO)
-- ============================================================================
RAISE NOTICE '';
RAISE NOTICE '========================================';
IF v_failures = 0 THEN
    -- F4-BUG-07 FIX: Cerrar paréntesis faltante
    RAISE NOTICE '✅ TODOS LOS TESTS PASARON (%/%)', v_total - v_failures, v_total;
    RAISE NOTICE 'Migración v3.0 lista para deploy a producción';
ELSE
    -- F4-BUG-07 FIX: Cerrar paréntesis faltante  
    RAISE NOTICE '❌ % TEST(S) FALLARON (%/%)', v_failures, v_total;
    RAISE NOTICE 'NO proceder con deploy hasta corregir errores';
END IF;
RAISE NOTICE '========================================';

END $$;

-- ============================================================================
-- TESTS ADICIONALES DE INTEGRIDAD (fuera del bloque DO)
-- ============================================================================

-- Verificar duplicados potenciales en colonias
SELECT 'Colonias duplicadas' as check_item, COUNT(*) as total
FROM (
    SELECT nombre, municipio_id, COUNT(*) as cnt 
    FROM colonias 
    GROUP BY nombre, municipio_id 
    HAVING COUNT(*) > 1
) dupes;

-- Verificar secciones sin coordenadas (usando nombres correctos de columnas)
SELECT 'Secciones sin coordenadas' as check_item, COUNT(*) as total 
FROM secciones_electorales 
WHERE latitud_centro IS NULL OR longitud_centro IS NULL;

-- Verificar integridad campana-municipio en respuestas
SELECT 'Respuestas con campana-municipio inconsistente' as check_item, COUNT(*) as total
FROM respuestas r
JOIN campanas c ON r.campana_id = c.id
WHERE r.municipio_id != c.municipio_id OR r.organizacion_id != c.organizacion_id;

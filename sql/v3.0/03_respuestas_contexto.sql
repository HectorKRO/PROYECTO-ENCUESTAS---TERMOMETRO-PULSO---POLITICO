-- ============================================================
-- FASE 3: CONTEXTO GEOGRÁFICO EN RESPUESTAS
-- ============================================================
-- Versión: v3.0 (Corregido)
-- Fecha: 2026-02-26
--
-- PRERREQUISITOS:
--   - 01_catalogo_geografico.sql ejecutado
--   - 02_organizaciones.sql ejecutado
--
-- CORRECCIÓN CRÍTICA (Bug #6):
--   ORDEN CORRECTO:
--   1. ALTER campanas → 2. UPDATE campanas → 3. ALTER respuestas → 4. UPDATE respuestas
--
--   NO hacer UPDATE respuestas antes de que campanas.municipio_id exista y esté poblado.
--
-- CORRECCIONES DE AUDITORÍA:
--   - BugAudit-C1: Eliminado patrón EXCEPTION WHEN others → NOTICE (ocultaba fallos)
--   - BugAudit-C3: Añadido guard de prerrequisitos para organizaciones y municipios
-- ============================================================

-- Guard: Verificar prerrequisitos (BugAudit-C3)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'municipios') THEN
    RAISE EXCEPTION 'No se encontró la tabla municipios. ¿Está aplicado 01_catalogo_geografico.sql?';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizaciones') THEN
    RAISE EXCEPTION 'No se encontró la tabla organizaciones. ¿Está aplicado 02_organizaciones.sql?';
  END IF;
END $$;

-- ============================================================
-- PASO 1: AGREGAR COLUMNAS A CAMPANAS (PRIMERO)
-- ============================================================
ALTER TABLE campanas 
  ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS municipio_id SMALLINT REFERENCES municipios(id);

-- ============================================================
-- PASO 2: POBLAR CAMPANAS (ANTES de tocar respuestas)
-- ============================================================
UPDATE campanas 
SET 
  organizacion_id = '00000000-0000-0000-0000-000000000001'::UUID,
  municipio_id = 1
WHERE organizacion_id IS NULL OR municipio_id IS NULL;

-- ============================================================
-- PASO 3: HACER COLUMNAS OBLIGATORIAS EN CAMPANAS
-- ============================================================
-- BugAudit-C1: Verificar explícitamente antes de imponer NOT NULL.
-- Si quedan NULLs, el UPDATE del PASO 2 falló → abortar con EXCEPTION (no NOTICE).

DO $$
DECLARE
  v_null_org INT;
  v_null_mun INT;
BEGIN
  SELECT COUNT(*) INTO v_null_org FROM campanas WHERE organizacion_id IS NULL;
  SELECT COUNT(*) INTO v_null_mun FROM campanas WHERE municipio_id IS NULL;

  IF v_null_org > 0 THEN
    RAISE EXCEPTION 'ERROR CRÍTICO: % campanas sin organizacion_id. El UPDATE del PASO 2 falló o hay campanas huérfanas.', v_null_org;
  END IF;

  IF v_null_mun > 0 THEN
    RAISE EXCEPTION 'ERROR CRÍTICO: % campanas sin municipio_id. El UPDATE del PASO 2 falló o hay campanas huérfanas.', v_null_mun;
  END IF;
END $$;

ALTER TABLE campanas
  ALTER COLUMN organizacion_id SET NOT NULL,
  ALTER COLUMN municipio_id SET NOT NULL;

-- ============================================================
-- PASO 4: AGREGAR COLUMNAS A RESPUESTAS (DESPUÉS de campanas lista)
-- ============================================================
ALTER TABLE respuestas 
  ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS municipio_id SMALLINT REFERENCES municipios(id);

-- ============================================================
-- PASO 5: POBLAR RESPUESTAS DESDE CAMPANAS (AHORA SÍ EXISTE c.municipio_id)
-- ============================================================
UPDATE respuestas r
SET 
  organizacion_id = c.organizacion_id,
  municipio_id = c.municipio_id
FROM campanas c
WHERE r.campana_id = c.id
  AND (r.organizacion_id IS NULL OR r.municipio_id IS NULL);

-- ============================================================
-- PASO 6: ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_respuestas_municipio 
  ON respuestas(municipio_id, campana_id);

CREATE INDEX IF NOT EXISTS idx_respuestas_organizacion 
  ON respuestas(organizacion_id, created_at);

CREATE INDEX IF NOT EXISTS idx_campanas_organizacion 
  ON campanas(organizacion_id, activa);

CREATE INDEX IF NOT EXISTS idx_campanas_municipio 
  ON campanas(municipio_id);

-- ============================================================
-- PASO 7: VALIDACIÓN POST-MIGRACIÓN (CRÍTICA)
-- ============================================================
DO $$
DECLARE
  campanas_sin_org INT;
  campanas_sin_mun INT;
  resp_sin_org INT;
  resp_sin_mun INT;
BEGIN
  -- Validar campanas
  SELECT COUNT(*) INTO campanas_sin_org
  FROM campanas WHERE organizacion_id IS NULL;
  
  SELECT COUNT(*) INTO campanas_sin_mun
  FROM campanas WHERE municipio_id IS NULL;
  
  IF campanas_sin_org > 0 OR campanas_sin_mun > 0 THEN
    RAISE EXCEPTION 'ERROR CRÍTICO: Quedaron % campanas sin org y % sin municipio', 
      campanas_sin_org, campanas_sin_mun;
  END IF;
  
  -- Validar respuestas
  SELECT COUNT(*) INTO resp_sin_org
  FROM respuestas WHERE organizacion_id IS NULL;
  
  SELECT COUNT(*) INTO resp_sin_mun
  FROM respuestas WHERE municipio_id IS NULL;
  
  IF resp_sin_org > 0 OR resp_sin_mun > 0 THEN
    RAISE EXCEPTION 'ERROR CRÍTICO: Quedaron % respuestas sin org y % sin municipio', 
      resp_sin_org, resp_sin_mun;
  END IF;
  
  RAISE NOTICE '✅ FASE 3 COMPLETADA: % campanas y % respuestas con contexto completo', 
    (SELECT COUNT(*) FROM campanas),
    (SELECT COUNT(*) FROM respuestas);
END $$;

-- ============================================================
-- FIN FASE 3
-- ============================================================

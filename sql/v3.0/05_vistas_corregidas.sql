-- ============================================================
-- FASE 5: VISTAS CORREGIDAS (Sin Cross-Joins Explosivos)
-- ============================================================
-- Versión: v3.0 (Corregido)
-- Fecha: 2026-02-26
--
-- PRERREQUISITOS:
--   - 04_rls_unificado.sql ejecutado
--
-- CORRECCIÓN CRÍTICA (Bug #13):
--   - ELIMINADA: v_comparacion_campanas (hacía cross-join N×(N-1))
--   - REEMPLAZADA: v_metricas_por_campana (una fila por campaña)
--   - La lógica de comparación se traslada al frontend
--
-- CORRECCIÓN: Todas las vistas incluyen organizacion_id para RLS
-- ============================================================

-- ============================================================
-- 1. ELIMINAR VISTA PROBLEMÁTICA (Bug #13)
-- ============================================================
DROP VIEW IF EXISTS v_comparacion_campanas;

-- ============================================================
-- 2. VISTA: MÉTRICAS POR CAMPAÑA (Reemplazo limpio)
-- ============================================================
-- Una fila por campaña. El frontend hace la comparación matemática.

DROP VIEW IF EXISTS v_metricas_por_campana;

CREATE VIEW v_metricas_por_campana AS
SELECT
  c.id as campana_id,
  c.nombre as campana_nombre,
  c.municipio_id,
  m.nombre as municipio_nombre,
  c.organizacion_id,
  c.activa,
  -- BugAudit-E1: COUNT(r.id) en lugar de COUNT(*) para no contar la fila NULL
  -- del LEFT JOIN cuando la campaña no tiene respuestas aún.
  COUNT(r.id) as total_encuestas,
  ROUND(AVG(r.intencion_voto)::numeric, 2) as intencion_promedio,
  ROUND(100.0 * COUNT(r.id) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(r.id),0), 1) as pct_intencion_positiva,
  ROUND(100.0 * COUNT(r.id) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(r.id),0), 1) as pct_reconocimiento,
  ROUND(100.0 * COUNT(r.id) FILTER (WHERE r.imagen_percibida IN ('muy_positiva','positiva')) / NULLIF(COUNT(r.id),0), 1) as pct_imagen_positiva,
  MIN(r.created_at) as primera_encuesta,
  MAX(r.created_at) as ultima_encuesta
FROM campanas c
JOIN municipios m ON c.municipio_id = m.id
LEFT JOIN respuestas r
  ON r.campana_id = c.id
  AND r.completada = true
  AND r.deleted_at IS NULL
GROUP BY c.id, c.nombre, c.municipio_id, m.nombre, c.organizacion_id, c.activa;

COMMENT ON VIEW v_metricas_por_campana IS 
  'Métricas agregadas por campaña. Para comparar, el frontend solicita dos campañas y calcula diferencias.';

-- ============================================================
-- 3. VISTA: MÉTRICAS POR MUNICIPIO
-- ============================================================
DROP VIEW IF EXISTS v_metricas_por_municipio;

CREATE VIEW v_metricas_por_municipio AS
SELECT 
  m.id as municipio_id,
  m.nombre as municipio_nombre,
  m.estado_id,
  e.nombre as estado_nombre,
  r.organizacion_id,
  -- DATA-1 FIX: COUNT(r.id) para consistencia con v_metricas_por_campana
  COUNT(r.id) as total_encuestas,
  COUNT(DISTINCT r.campana_id) as total_campanas,
  COUNT(DISTINCT r.seccion_id) as secciones_con_datos,
  ROUND(100.0 * COUNT(r.id) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(r.id),0), 1) as pct_reconocimiento,
  ROUND(100.0 * COUNT(r.id) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(r.id),0), 1) as pct_intencion_positiva,
  ROUND(AVG(r.intencion_voto)::numeric, 2) as intencion_promedio
FROM respuestas r
JOIN municipios m ON r.municipio_id = m.id
JOIN estados e ON m.estado_id = e.id
WHERE r.completada = true AND r.deleted_at IS NULL
GROUP BY m.id, m.nombre, m.estado_id, e.nombre, r.organizacion_id;

-- ============================================================
-- 4. VISTA: MÉTRICAS POR SECCIÓN (Multi-Municipio)
-- ============================================================
-- Reemplaza v_resultados_por_seccion con soporte multi-municipio

DROP VIEW IF EXISTS v_metricas_por_seccion;

CREATE VIEW v_metricas_por_seccion AS
SELECT 
  r.seccion_id,
  se.municipio_id,
  m.nombre as municipio_nombre,
  se.nombre_zona,
  se.tipo as tipo_seccion,
  r.organizacion_id,
  r.campana_id,
  COUNT(*) as total_encuestas,
  ROUND(AVG(r.intencion_voto)::numeric, 2) as intencion_promedio,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) as pct_intencion_positiva,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(*),0), 1) as pct_reconocimiento,
  se.latitud_centro,
  se.longitud_centro
FROM respuestas r
JOIN secciones_electorales se 
  ON r.seccion_id = se.seccion 
  AND r.municipio_id = se.municipio_id
JOIN municipios m ON se.municipio_id = m.id
WHERE r.completada = true AND r.deleted_at IS NULL
GROUP BY r.seccion_id, se.municipio_id, m.nombre, se.nombre_zona, 
         se.tipo, r.organizacion_id, r.campana_id, se.latitud_centro, se.longitud_centro;

-- ============================================================
-- 5. VISTA: MÉTRICAS POR COLONIA (Multi-Municipio)
-- ============================================================
DROP VIEW IF EXISTS v_metricas_por_colonia;

CREATE VIEW v_metricas_por_colonia AS
SELECT 
  c.id as colonia_id,
  c.nombre as colonia_nombre,
  c.seccion_id,
  c.municipio_id,
  m.nombre as municipio_nombre,
  c.tipo as tipo_colonia,
  r.organizacion_id,
  r.campana_id,
  COUNT(*) as total_encuestas,
  ROUND(AVG(r.intencion_voto)::numeric, 2) as intencion_promedio,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) as pct_intencion_positiva
FROM respuestas r
JOIN colonias c ON r.colonia_id = c.id
JOIN municipios m ON c.municipio_id = m.id
WHERE r.completada = true AND r.deleted_at IS NULL AND r.colonia_id IS NOT NULL
GROUP BY c.id, c.nombre, c.seccion_id, c.municipio_id, m.nombre, 
         c.tipo, r.organizacion_id, r.campana_id;

-- ============================================================
-- 6. VISTAS COMPATIBLES v2.x (Actualizadas para v3.0)
-- ============================================================
-- Estas vistas mantienen nombres v2.x para compatibilidad,
-- pero incluyen filtros de municipio_id para el WarRoom v3.0

-- v_resultados_por_seccion - Compatible v2.x con soporte multi-municipio
DROP VIEW IF EXISTS v_resultados_por_seccion;

CREATE VIEW v_resultados_por_seccion AS
SELECT 
  r.seccion_id,
  se.municipio_id,
  m.nombre as municipio_nombre,
  se.nombre_zona as zona,
  se.tipo,
  r.campana_id,
  r.organizacion_id,
  COUNT(*) as total,
  ROUND(AVG(r.intencion_voto)::numeric, 2) as promedio_intencion,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) as pct_intencion_positiva,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(*),0), 1) as pct_reconocimiento
FROM respuestas r
JOIN secciones_electorales se 
  ON r.seccion_id = se.seccion 
  AND r.municipio_id = se.municipio_id
JOIN municipios m ON se.municipio_id = m.id
WHERE r.completada = true AND r.deleted_at IS NULL
GROUP BY r.seccion_id, se.municipio_id, m.nombre, se.nombre_zona, 
         se.tipo, r.campana_id, r.organizacion_id;

-- v_resultados_por_colonia - Compatible v2.x con soporte multi-municipio  
DROP VIEW IF EXISTS v_resultados_por_colonia;

CREATE VIEW v_resultados_por_colonia AS
SELECT 
  c.id as colonia_id,
  c.nombre as colonia,
  c.seccion_id,
  c.municipio_id,
  m.nombre as municipio_nombre,
  c.tipo as tipo_colonia,
  r.campana_id,
  r.organizacion_id,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) as pct_intencion_positiva,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(*),0), 1) as pct_reconocimiento
FROM respuestas r
JOIN colonias c ON r.colonia_id = c.id
JOIN municipios m ON c.municipio_id = m.id
WHERE r.completada = true AND r.deleted_at IS NULL AND r.colonia_id IS NOT NULL
GROUP BY c.id, c.nombre, c.seccion_id, c.municipio_id, m.nombre, 
         c.tipo, r.campana_id, r.organizacion_id;

-- Nota: Otras vistas v2.x (v_kpis_campana, v_tendencia_semanal) 
-- se actualizarán en Fase 3 del roadmap v3.0

-- ============================================================
-- 7. VALIDACIÓN POST-MIGRACIÓN
-- ============================================================
DO $$
DECLARE
  metricas_count INT;
BEGIN
  -- Verificar que las vistas clave existen
  SELECT COUNT(*) INTO metricas_count
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name IN (
      'v_metricas_por_campana',
      'v_metricas_por_municipio', 
      'v_metricas_por_seccion',
      'v_metricas_por_colonia'
    );
  
  IF metricas_count < 4 THEN
    RAISE EXCEPTION 'ERROR: Solo se crearon % de 4 vistas de métricas', metricas_count;
  END IF;
  
  RAISE NOTICE '✅ FASE 5 COMPLETADA: % vistas de métricas creadas', metricas_count;
END $$;

-- ============================================================
-- FIN FASE 5
-- ============================================================

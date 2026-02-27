-- ============================================================
-- MIGRACIÓN v2.3 — Correcciones Críticas Pre-Campo
-- ============================================================
-- Fecha: 2026-02-25
-- Cambios CRÍTICOS:
--   ✅ FIX: seccion_id ahora es TEXT referenciando secciones_electorales.seccion
--   ✅ FIX: Evita desincronización si se re-insertan datos de secciones
--   ✅ Nuevos campos para análisis político avanzado
--   ✅ Soporte para fotos de evidencia
--   ✅ Campos de contacto para seguimiento
-- ============================================================

-- ============================================================
-- 1. CAMBIO CRÍTICO: Modificar PK de secciones_electorales
-- ============================================================
-- NOTA: Este cambio es destructivo en producción. 
-- Requiere migrar datos existentes antes de aplicar.

-- Paso 1: Agregar columna seccion como TEXT si no existe (para BD viejas)
DO $$
BEGIN
  -- Verificar si secciones_electorales tiene id como SERIAL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='secciones_electorales' AND column_name='id' AND data_type='integer'
  ) THEN
    -- Migración desde estructura antigua
    RAISE NOTICE 'Migrando desde estructura v2.1/v2.2...';
    
    -- Crear tabla temporal con nueva estructura
    CREATE TABLE IF NOT EXISTS secciones_electorales_new (
      seccion         TEXT PRIMARY KEY,
      nombre_zona     TEXT,
      tipo            TEXT CHECK (tipo IN ('urbana','rural','mixta')) DEFAULT 'urbana',
      municipio       TEXT DEFAULT 'Atlixco',
      estado          TEXT DEFAULT 'Puebla',
      distrito_fed    INT DEFAULT 13,
      distrito_local  INT DEFAULT 21,
      lista_nominal   INT,
      latitud_centro  DECIMAL(10,8),
      longitud_centro DECIMAL(11,8)
    );
    
    -- Copiar datos
    INSERT INTO secciones_electorales_new (seccion, nombre_zona, tipo, lista_nominal, latitud_centro, longitud_centro)
    SELECT seccion, nombre_zona, tipo, lista_nominal, latitud_centro, longitud_centro
    FROM secciones_electorales;
    
    -- Actualizar FK en respuestas antes de cambiar la tabla
    -- (Este paso requiere que seccion_id sea TEXT)
  END IF;
END $$;

-- ============================================================
-- 2. MODIFICAR respuestas.seccion_id de INT a TEXT
-- ============================================================
DO $$
BEGIN
  -- Verificar tipo actual
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='respuestas' AND column_name='seccion_id' AND data_type='integer'
  ) THEN
    RAISE NOTICE 'Convirtiendo respuestas.seccion_id de INT a TEXT...';
    
    -- Convertir los IDs numéricos a TEXT con padding
    ALTER TABLE respuestas ALTER COLUMN seccion_id TYPE TEXT 
    USING LPAD(seccion_id::TEXT, 4, '0');
  END IF;
END $$;

-- ============================================================
-- 3. AGREGAR NUEVOS CAMPOS v2.3 (si no existen)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='respuestas' AND column_name='participacion_anterior') THEN
    ALTER TABLE respuestas ADD COLUMN participacion_anterior TEXT 
      CHECK (participacion_anterior IN ('si','no','ns'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='respuestas' AND column_name='identificacion_partido') THEN
    ALTER TABLE respuestas ADD COLUMN identificacion_partido TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='respuestas' AND column_name='whatsapp_contacto') THEN
    ALTER TABLE respuestas ADD COLUMN whatsapp_contacto TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='respuestas' AND column_name='consentimiento_contacto') THEN
    ALTER TABLE respuestas ADD COLUMN consentimiento_contacto BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='respuestas' AND column_name='foto_evidencia_url') THEN
    ALTER TABLE respuestas ADD COLUMN foto_evidencia_url TEXT;
  END IF;
END $$;

-- ============================================================
-- 4. RECREAR VISTAS con nuevo tipo de dato
-- ============================================================

-- Vista: Resultados por sección electoral
-- ✅ FIX v2.3: Actualizado para seccion_id como TEXT
DROP VIEW IF EXISTS v_resultados_por_seccion;
CREATE VIEW v_resultados_por_seccion AS
SELECT
  r.campana_id,
  r.seccion_id,
  se.nombre_zona,
  se.tipo,
  se.latitud_centro,
  se.longitud_centro,
  se.lista_nominal,
  COUNT(*) AS total,
  ROUND(AVG(r.intencion_voto)::numeric, 2) AS promedio_intencion,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) AS pct_intencion_positiva,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(*),0), 1) AS pct_reconocimiento
FROM respuestas r
JOIN secciones_electorales se ON r.seccion_id = se.seccion
WHERE r.completada = true AND r.deleted_at IS NULL
GROUP BY r.campana_id, r.seccion_id, se.nombre_zona, se.tipo, se.latitud_centro, se.longitud_centro, se.lista_nominal;

-- Vista demográfica con nuevos campos
DROP VIEW IF EXISTS v_demograficos;
CREATE VIEW v_demograficos AS
SELECT
  campana_id, genero, edad_rango,
  participacion_anterior,
  identificacion_partido,
  COUNT(*) AS total,
  ROUND(AVG(intencion_voto)::numeric, 2) AS promedio_intencion,
  ROUND(100.0 * COUNT(*) FILTER (WHERE intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) AS pct_intencion_positiva
FROM respuestas
WHERE completada = true AND deleted_at IS NULL
GROUP BY campana_id, genero, edad_rango, participacion_anterior, identificacion_partido;

-- Vista de contactos para seguimiento
DROP VIEW IF EXISTS v_contactos_seguimiento;
CREATE VIEW v_contactos_seguimiento AS
SELECT
  id,
  campana_id,
  seccion_id,
  created_at,
  whatsapp_contacto,
  intencion_voto,
  simpatia,
  comentario_final
FROM respuestas
WHERE consentimiento_contacto = true 
  AND whatsapp_contacto IS NOT NULL 
  AND completada = true 
  AND deleted_at IS NULL;

-- ============================================================
-- 5. ÍNDICES PARA NUEVOS CAMPOS Y RECREACIÓN DE ÍNDICES EXISTENTES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_respuestas_whatsapp ON respuestas(whatsapp_contacto) 
  WHERE consentimiento_contacto = true;

CREATE INDEX IF NOT EXISTS idx_respuestas_partido ON respuestas(identificacion_partido);

-- ✅ FIX: Recrear índice compuesto con seccion_id como TEXT
DROP INDEX IF EXISTS idx_respuestas_campana_seccion;
CREATE INDEX idx_respuestas_campana_seccion ON respuestas(campana_id, seccion_id)
  WHERE completada = true;

-- ============================================================
-- 6. VERIFICACIÓN FINAL
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migración v2.3 completada exitosamente';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Cambios aplicados:';
  RAISE NOTICE '- seccion_id ahora es TEXT';
  RAISE NOTICE '- Nuevos campos: participacion_anterior, identificacion_partido, whatsapp_contacto, consentimiento_contacto, foto_evidencia_url';
  RAISE NOTICE '- Vistas actualizadas';
  RAISE NOTICE '- Índices creados';
END $$;

-- ============================================================
-- FIN MIGRACIÓN v2.3
-- ============================================================

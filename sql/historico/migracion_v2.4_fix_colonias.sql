-- ============================================================
-- MIGRACIÓN v2.4 - Fix para Tabla Colonias y columna colonia_id
-- ============================================================
-- Este script asegura que:
-- 1. La tabla colonias existe
-- 2. La columna colonia_id existe en respuestas
-- 3. La vista v_resultados_por_colonia existe
-- ============================================================

-- 1. Crear tabla colonias si no existe
CREATE TABLE IF NOT EXISTS colonias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  seccion_id      TEXT NOT NULL REFERENCES secciones_electorales(seccion) ON DELETE CASCADE,
  tipo            TEXT CHECK (tipo IN ('COLONIA','FRACCIONAMIENTO','RANCHO','EJIDO','BARRIO','UNIDAD HABITACIONAL','PUEBLO','HACIENDA','VILLA','CONJUNTO HABITACIONAL','RESIDENCIAL','GRANJA','LOCALIDAD','PARAJE','PARQUE INDUSTRIAL','ZONA MILITAR','FRACCION','OTRO')) DEFAULT 'COLONIA',
  codigo_postal   TEXT,
  latitud         DECIMAL(10,8),
  longitud        DECIMAL(11,8),
  activa          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(nombre, seccion_id)
);

-- Índices para colonias
CREATE INDEX IF NOT EXISTS idx_colonias_nombre ON colonias(nombre);
CREATE INDEX IF NOT EXISTS idx_colonias_seccion ON colonias(seccion_id);
CREATE INDEX IF NOT EXISTS idx_colonias_activa ON colonias(activa) WHERE activa = true;

-- 1b. Actualizar constraint de tipos si la tabla ya existe (para agregar tipos faltantes)
DO $$
BEGIN
  -- Eliminar constraint antiguo si existe
  ALTER TABLE colonias DROP CONSTRAINT IF EXISTS colonias_tipo_check;
  
  -- Agregar constraint nuevo con todos los tipos del INE
  ALTER TABLE colonias ADD CONSTRAINT colonias_tipo_check 
    CHECK (tipo IN ('COLONIA','FRACCIONAMIENTO','RANCHO','EJIDO','BARRIO','UNIDAD HABITACIONAL','PUEBLO','HACIENDA','VILLA','CONJUNTO HABITACIONAL','RESIDENCIAL','GRANJA','LOCALIDAD','PARAJE','PARQUE INDUSTRIAL','ZONA MILITAR','FRACCION','OTRO'));
  
  RAISE NOTICE 'Constraint colonias_tipo_check actualizado';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'No se pudo actualizar constraint (puede que la tabla no exista): %', SQLERRM;
END $$;

-- 2. Agregar columna colonia_id a respuestas si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='respuestas' AND column_name='colonia_id'
  ) THEN
    ALTER TABLE respuestas ADD COLUMN colonia_id UUID REFERENCES colonias(id);
    RAISE NOTICE 'Columna colonia_id agregada a respuestas';
  ELSE
    RAISE NOTICE 'Columna colonia_id ya existe en respuestas';
  END IF;
END $$;

-- 3. Agregar columna colonia_texto si no existe (para compatibilidad)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='respuestas' AND column_name='colonia_texto'
  ) THEN
    ALTER TABLE respuestas ADD COLUMN colonia_texto TEXT;
    RAISE NOTICE 'Columna colonia_texto agregada a respuestas';
  END IF;
END $$;

-- 4. Recrear vista v_resultados_por_colonia
DROP VIEW IF EXISTS v_resultados_por_colonia;

CREATE VIEW v_resultados_por_colonia AS
SELECT
  r.campana_id,
  r.colonia_id,
  c.nombre as colonia,
  c.tipo as tipo_colonia,
  c.codigo_postal,
  r.seccion_id,
  se.nombre_zona as zona,
  se.tipo as tipo_seccion,
  se.latitud_centro,
  se.longitud_centro,
  COUNT(*) AS total,
  ROUND(AVG(r.intencion_voto)::numeric, 2) AS promedio_intencion,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) AS pct_intencion_positiva,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(*),0), 1) AS pct_reconocimiento
FROM respuestas r
LEFT JOIN colonias c ON r.colonia_id = c.id
LEFT JOIN secciones_electorales se ON r.seccion_id = se.seccion
WHERE r.completada = true 
  AND r.deleted_at IS NULL
  AND r.colonia_id IS NOT NULL
GROUP BY r.campana_id, r.colonia_id, c.nombre, c.tipo, c.codigo_postal, 
         r.seccion_id, se.nombre_zona, se.tipo, se.latitud_centro, se.longitud_centro;

-- 5. Verificación final
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migración v2.4 FIX completada';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tabla colonias: OK';
  RAISE NOTICE 'Columna respuestas.colonia_id: OK';
  RAISE NOTICE 'Vista v_resultados_por_colonia: OK';
END $$;

-- ============================================================
-- FASE 1: CATÁLOGO GEOGRÁFICO NACIONAL
-- ============================================================
-- Versión: v3.0 (Corregido)
-- Fecha: 2026-02-26
-- 
-- PRERREQUISITOS:
--   - Schema v2.5.2 aplicado
--   - Datos de Atlixco existentes
--
-- CORRECCIONES APLICADAS:
--   - PK de secciones_electorales NO se cambia (preservada simple)
--   - municipio_id agregado como columna regular (no en PK)
--   - Índice creado para búsquedas por municipio
-- ============================================================

-- Guard: Verificar que no estamos en una BD vacía
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'respuestas') THEN
    RAISE EXCEPTION 'No se encontró la tabla respuestas. ¿Está aplicado el schema v2.5?';
  END IF;
END $$;

-- ============================================================
-- 1. TABLA ESTADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS estados (
  id SMALLINT PRIMARY KEY,
  nombre TEXT NOT NULL,
  abrev TEXT UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT true
);

COMMENT ON TABLE estados IS 'Catálogo de estados de México para expansión futura';

-- Insertar estados iniciales (Puebla para producción, Tlaxcala para expansión)
INSERT INTO estados (id, nombre, abrev) VALUES
  (21, 'Puebla', 'PUE'),
  (29, 'Tlaxcala', 'TLAX')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. TABLA MUNICIPIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS municipios (
  id SMALLINT PRIMARY KEY,
  estado_id SMALLINT REFERENCES estados(id),
  nombre TEXT NOT NULL,
  cabecera TEXT,
  distrito_fed INT,
  latitud_centro DECIMAL(10,8),
  longitud_centro DECIMAL(11,8),
  geojson_limite JSONB,
  activo BOOLEAN DEFAULT true,
  UNIQUE(estado_id, nombre)
);

COMMENT ON TABLE municipios IS 'Catálogo de municipios. Expansible a cualquier municipio de México';

-- Insertar Atlixco como municipio #1 (legacy)
INSERT INTO municipios (id, estado_id, nombre, cabecera, distrito_fed, latitud_centro, longitud_centro)
VALUES (
  1, 
  21, 
  'Atlixco', 
  'Atlixco, Puebla', 
  13, 
  18.9088, 
  -98.4321
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. AGREGAR municipio_id A SECCIONES_ELECTORALES
-- ============================================================
-- CORRECCIÓN CRÍTICA: NO cambiamos la PK a compuesta.
-- Los números INE son únicos dentro de Puebla.
-- municipio_id es solo informativo para queries.

ALTER TABLE secciones_electorales 
  ADD COLUMN IF NOT EXISTS municipio_id SMALLINT REFERENCES municipios(id);

-- Asignar todas las secciones existentes a Atlixco (municipio 1)
UPDATE secciones_electorales
  SET municipio_id = 1
  WHERE municipio_id IS NULL;

-- Hacer obligatorio (después de poblar — sin esto, inserciones futuras pueden omitirlo)
ALTER TABLE secciones_electorales
  ALTER COLUMN municipio_id SET NOT NULL;

-- Crear índice para búsquedas eficientes por municipio
CREATE INDEX IF NOT EXISTS idx_secciones_municipio
  ON secciones_electorales(municipio_id);

-- ============================================================
-- 4. AGREGAR municipio_id A COLONIAS
-- ============================================================
ALTER TABLE colonias
  ADD COLUMN IF NOT EXISTS municipio_id SMALLINT REFERENCES municipios(id);

-- Poblar desde la sección electoral (la sección ya conoce su municipio)
UPDATE colonias co
  SET municipio_id = se.municipio_id
  FROM secciones_electorales se
  WHERE co.seccion_id = se.seccion
    AND co.municipio_id IS NULL;

-- Hacer obligatorio
ALTER TABLE colonias
  ALTER COLUMN municipio_id SET NOT NULL;

-- Crear índice
CREATE INDEX IF NOT EXISTS idx_colonias_municipio
  ON colonias(municipio_id);

-- ============================================================
-- 5. VALIDACIÓN POST-MIGRACIÓN
-- ============================================================
DO $$
DECLARE
  secciones_sin_mun INT;
  colonias_sin_mun INT;
BEGIN
  -- Verificar secciones
  SELECT COUNT(*) INTO secciones_sin_mun
  FROM secciones_electorales
  WHERE municipio_id IS NULL;
  
  IF secciones_sin_mun > 0 THEN
    RAISE EXCEPTION 'ERROR CRÍTICO: Quedaron % secciones sin municipio_id', secciones_sin_mun;
  END IF;
  
  -- Verificar colonias
  SELECT COUNT(*) INTO colonias_sin_mun
  FROM colonias
  WHERE municipio_id IS NULL;
  
  IF colonias_sin_mun > 0 THEN
    RAISE EXCEPTION 'ERROR CRÍTICO: Quedaron % colonias sin municipio_id', colonias_sin_mun;
  END IF;
  
  RAISE NOTICE '✅ FASE 1 COMPLETADA: % secciones y % colonias vinculadas a Atlixco', 
    (SELECT COUNT(*) FROM secciones_electorales WHERE municipio_id = 1),
    (SELECT COUNT(*) FROM colonias WHERE municipio_id = 1);
END $$;

-- ============================================================
-- FIN FASE 1
-- ============================================================

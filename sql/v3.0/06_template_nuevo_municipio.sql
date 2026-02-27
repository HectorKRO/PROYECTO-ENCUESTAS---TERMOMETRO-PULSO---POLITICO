-- ============================================================
-- FASE 6: TEMPLATE PARA AGREGAR NUEVO MUNICIPIO
-- ============================================================
-- Versión: v3.0 (Corregido)
-- Fecha: 2026-02-26
--
-- INSTRUCCIONES:
--   1. Copiar este archivo con nombre del nuevo municipio
--      Ej: 06_municipio_san_martin_texmelucan.sql
--   2. Reemplazar los valores en el bloque DECLARE (líneas 24-31)
--   3. Reemplazar las secciones de ejemplo con las del catálogo INE
--   4. Ejecutar en Supabase SQL Editor (copiar y pegar completo)
--
-- CORRECCIONES DE AUDITORÍA:
--   - BugAudit-F1 (CRÍTICO): Eliminado \set — no funciona en Supabase SQL Editor.
--     Ahora usa DO $$ DECLARE para las variables (compatible con Supabase).
--   - BugAudit-F2: ON CONFLICT cambiado a DO NOTHING para secciones — evita
--     reasignar secciones que ya existen a otro municipio por error.
--   - BugAudit-F3: Aritmética de coordenadas movida a SQL estándar (no en DECLARE).
-- ============================================================

-- ============================================================
-- CONFIGURACIÓN: REEMPLAZAR ESTOS VALORES
-- ============================================================
DO $$
DECLARE
  v_municipio_id    SMALLINT  := 2;                        -- <-- CAMBIAR
  v_municipio_nombre TEXT     := 'San Martín Texmelucan';  -- <-- CAMBIAR
  v_estado_id       SMALLINT  := 21;                       -- 21=Puebla, 29=Tlaxcala
  v_distrito_fed    INT       := 12;                       -- <-- CAMBIAR
  v_lat             DECIMAL   := 19.2846;                  -- <-- CAMBIAR (latitud centro)
  v_lng             DECIMAL   := -98.4381;                 -- <-- CAMBIAR (longitud centro)
BEGIN

  -- ============================================================
  -- PASO 1: INSERTAR MUNICIPIO
  -- ============================================================
  INSERT INTO municipios (
    id, estado_id, nombre, cabecera, distrito_fed,
    latitud_centro, longitud_centro, activo
  ) VALUES (
    v_municipio_id,
    v_estado_id,
    v_municipio_nombre,
    v_municipio_nombre || ', Puebla',
    v_distrito_fed,
    v_lat,
    v_lng,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  -- BugAudit-F2: DO NOTHING (no DO UPDATE) — si el municipio ya existe,
  -- no sobreescribir datos que pudo haber sido ajustados manualmente.

  IF NOT FOUND THEN
    RAISE NOTICE 'AVISO: Municipio ID=% ya existía. No se modificó.', v_municipio_id;
  ELSE
    RAISE NOTICE 'OK: Municipio % (ID=%) insertado.', v_municipio_nombre, v_municipio_id;
  END IF;

END $$;

-- ============================================================
-- PASO 2: INSERTAR SECCIONES ELECTORALES
-- ============================================================
-- BugAudit-F1: Los valores de sección se insertan como literales SQL,
-- NO con variables \set (que no funcionan en Supabase).
-- BugAudit-F2: ON CONFLICT (seccion) DO NOTHING — la PK es simple.
--   Si la sección ya existe (ej: se ejecutó dos veces), no reasignar.
--
-- INSTRUCCIÓN: Reemplazar el bloque VALUES con las secciones reales del INE.
-- Cada fila: ('NNNN', municipio_id, 'Nombre Zona', 'urbana|rural|mixta', lista_nominal, lat, lng)

INSERT INTO secciones_electorales (
  seccion, municipio_id, nombre_zona, tipo, lista_nominal,
  latitud_centro, longitud_centro
) VALUES
  -- REEMPLAZAR con secciones reales del catálogo INE:
  ('0230', 2, 'Centro',            'urbana', 2800, 19.2846, -98.4381),
  ('0231', 2, 'San Rafael',        'urbana', 2500, 19.2896, -98.4361),
  ('0232', 2, 'Santiago',          'mixta',  1800, 19.2816, -98.4421),
  ('0233', 2, 'San Martín Centro', 'urbana', 3200, 19.2866, -98.4391),
  ('0234', 2, 'La Trinidad',       'rural',  1200, 19.2766, -98.4321)
  -- Agregar más filas según catálogo INE...
ON CONFLICT (seccion) DO NOTHING;

-- ============================================================
-- PASO 3: VALIDAR SECCIONES INSERTADAS
-- ============================================================
DO $$
DECLARE
  v_municipio_id  SMALLINT := 2;   -- <-- Mismo valor que arriba
  secciones_count INT;
BEGIN
  SELECT COUNT(*) INTO secciones_count
  FROM secciones_electorales
  WHERE municipio_id = v_municipio_id;

  IF secciones_count = 0 THEN
    RAISE EXCEPTION 'ERROR: No se encontraron secciones para municipio_id=%', v_municipio_id;
  END IF;

  RAISE NOTICE 'OK: % secciones asignadas al municipio ID=%', secciones_count, v_municipio_id;
END $$;

-- ============================================================
-- PASO 4: CREAR SEED DE COLONIAS (Generar desde CSV/Excel)
-- ============================================================
-- Ejecutar script de colonias generado por separado:
-- Copiar y pegar el contenido de seed_colonias_<municipio>.sql

-- Estructura esperada del seed de colonias:
/*
INSERT INTO colonias (nombre, seccion_id, municipio_id, tipo, codigo_postal)
VALUES
  ('Centro',     '0230', 2, 'COLONIA', '74000'),
  ('San Rafael', '0231', 2, 'COLONIA', '74010')
ON CONFLICT (nombre, seccion_id) DO NOTHING;
*/

-- ============================================================
-- PASO 5: OTORGAR ACCESO A ORGANIZACIÓN (Opcional)
-- ============================================================
-- Descomentar y ajustar el UUID si se quiere dar acceso inmediato:

/*
INSERT INTO organizacion_municipios (
  organizacion_id, municipio_id
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,  -- <-- UUID de la organización
  2                                               -- <-- municipio_id
)
ON CONFLICT (organizacion_id, municipio_id) DO NOTHING;
*/

-- ============================================================
-- PASO 6: VALIDACIÓN FINAL
-- ============================================================
DO $$
DECLARE
  v_municipio_id SMALLINT := 2;  -- <-- Mismo valor que arriba
  mun_record RECORD;
BEGIN
  SELECT m.*,
         (SELECT COUNT(*) FROM secciones_electorales WHERE municipio_id = m.id) as secciones,
         (SELECT COUNT(*) FROM colonias WHERE municipio_id = m.id) as colonias
  INTO mun_record
  FROM municipios m
  WHERE m.id = v_municipio_id;

  IF mun_record.id IS NULL THEN
    RAISE EXCEPTION 'ERROR CRÍTICO: Municipio ID=% no se insertó correctamente', v_municipio_id;
  END IF;

  RAISE NOTICE E'\n✅ MUNICIPIO CONFIGURADO:\n   ID: %\n   Nombre: %\n   Secciones: %\n   Colonias: %\n',
    mun_record.id, mun_record.nombre, mun_record.secciones, mun_record.colonias;
END $$;

-- ============================================================
-- FIN TEMPLATE
-- ============================================================
-- NOTAS:
-- - Las coordenadas deben apuntar al centro geográfico del municipio
-- - El catálogo de secciones debe venir del INE oficial (catálogo 2024)
-- - Las colonias deben validarse contra el catálogo SEPOMEX (códigos postales)
-- - v_municipio_id debe ser diferente para cada municipio (sin repetir)
-- ============================================================

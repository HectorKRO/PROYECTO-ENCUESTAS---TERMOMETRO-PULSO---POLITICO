-- ============================================================
-- FIX: Actualizar constraint colonias_tipo_check
-- ============================================================
-- Ejecutar este script si obtienes error:
-- ERROR: 23514: new row for relation "colonias" violates check constraint "colonias_tipo_check"
-- ============================================================

-- 1. Eliminar constraint antiguo (si existe)
ALTER TABLE colonias DROP CONSTRAINT IF EXISTS colonias_tipo_check;

-- 2. Agregar nuevo constraint con todos los tipos del INE
ALTER TABLE colonias ADD CONSTRAINT colonias_tipo_check 
  CHECK (tipo IN (
    'COLONIA',
    'FRACCIONAMIENTO', 
    'RANCHO',
    'EJIDO',
    'BARRIO',
    'UNIDAD HABITACIONAL',
    'CONJUNTO HABITACIONAL',
    'PUEBLO',
    'HACIENDA',
    'VILLA',
    'RESIDENCIAL',
    'GRANJA',
    'LOCALIDAD',
    'PARAJE',
    'PARQUE INDUSTRIAL',
    'ZONA MILITAR',
    'FRACCION',
    'OTRO'
  ));

-- 3. Verificar el constraint
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Constraint colonias_tipo_check actualizado exitosamente';
  RAISE NOTICE 'Tipos permitidos:';
  RAISE NOTICE '  - COLONIA, FRACCIONAMIENTO, RANCHO, EJIDO, BARRIO';
  RAISE NOTICE '  - UNIDAD HABITACIONAL, CONJUNTO HABITACIONAL';
  RAISE NOTICE '  - PUEBLO, HACIENDA, VILLA, RESIDENCIAL';
  RAISE NOTICE '  - GRANJA, LOCALIDAD, PARAJE';
  RAISE NOTICE '  - PARQUE INDUSTRIAL, ZONA MILITAR';
  RAISE NOTICE '  - FRACCION, OTRO';
  RAISE NOTICE '========================================';
END $$;

-- 4. Verificar que la tabla acepte PUEBLO
INSERT INTO colonias (nombre, seccion_id, tipo, codigo_postal) 
VALUES ('TEST PUEBLO', '0154', 'PUEBLO', '74360')
ON CONFLICT (nombre, seccion_id) DO NOTHING;

-- Eliminar el registro de prueba
DELETE FROM colonias WHERE nombre = 'TEST PUEBLO' AND seccion_id = '0154';

DO $$
BEGIN
  RAISE NOTICE '✓ Verificación exitosa: El tipo PUEBLO ahora es válido';
END $$;

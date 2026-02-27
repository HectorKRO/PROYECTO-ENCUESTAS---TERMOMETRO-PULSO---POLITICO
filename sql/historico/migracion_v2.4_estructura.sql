-- =============================================================================
-- migracion_v2.4_estructura.sql
-- Actualización de estructura de la tabla colonias (v2.4)
-- Solo DDL — sin datos de seed.
-- Ejecutar DESPUÉS de migracion_v2.4_fix_colonias.sql
-- Ejecutar ANTES de seed_colonias_atlixco.sql
-- =============================================================================

-- Verificar que la tabla colonias existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name='colonias'
  ) THEN
    RAISE EXCEPTION 'La tabla colonias no existe. Ejecuta migracion_v2.4_fix_colonias.sql primero.';
  END IF;
END $$;

-- Actualizar constraint para aceptar todos los tipos del INE
-- Eliminar constraint antiguo (si existe)
ALTER TABLE colonias DROP CONSTRAINT IF EXISTS colonias_tipo_check;

-- Agregar nuevo constraint con todos los tipos
ALTER TABLE colonias ADD CONSTRAINT colonias_tipo_check
  CHECK (tipo IN (
    'COLONIA','FRACCIONAMIENTO','RANCHO','EJIDO','BARRIO',
    'UNIDAD HABITACIONAL','CONJUNTO HABITACIONAL','PUEBLO',
    'HACIENDA','VILLA','RESIDENCIAL','GRANJA','LOCALIDAD',
    'PARAJE','PARQUE INDUSTRIAL','ZONA MILITAR','FRACCION','OTRO'
  ));

DO $$
BEGIN
  RAISE NOTICE '✓ Constraint colonias_tipo_check actualizado con todos los tipos INE';
END $$;

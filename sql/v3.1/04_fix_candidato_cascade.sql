-- ============================================================
-- V3.1 FIX: candidato_id ON DELETE SET NULL (antes CASCADE)
-- ============================================================
-- Versión: v3.1
-- Fecha: 2026-02-28
--
-- PROBLEMA:
--   campanas.candidato_id tenía ON DELETE CASCADE.
--   Al eliminar un candidato → se borraba también la campaña vinculada.
--   Campaña y candidato deben ser entidades independientes.
--
-- SOLUCIÓN:
--   Cambiar a ON DELETE SET NULL:
--   - Eliminar candidato → campaña se conserva, candidato_id = NULL
--   - La campaña muestra "Sin candidato" y puede reasignarse
--
-- PRERREQUISITO: schema.sql ejecutado (ya tiene la tabla campanas)
-- ============================================================

-- ============================================================
-- PASO 1: Eliminar constraint actual (ON DELETE CASCADE)
-- ============================================================
ALTER TABLE campanas
  DROP CONSTRAINT IF EXISTS campanas_candidato_id_fkey;

-- ============================================================
-- PASO 2: Re-crear con ON DELETE SET NULL
-- ============================================================
ALTER TABLE campanas
  ADD CONSTRAINT campanas_candidato_id_fkey
  FOREIGN KEY (candidato_id)
  REFERENCES candidatos(id)
  ON DELETE SET NULL;

-- ============================================================
-- PASO 3: Validación
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'campanas'
      AND rc.constraint_name = 'campanas_candidato_id_fkey'
      AND rc.delete_rule = 'SET NULL'
  ) THEN
    RAISE EXCEPTION 'FALLO: constraint campanas_candidato_id_fkey no tiene SET NULL';
  END IF;

  RAISE NOTICE '✅ FIX APLICADO: campanas.candidato_id ahora es ON DELETE SET NULL. Eliminar un candidato ya no borra la campaña.';
END $$;

-- ============================================================
-- FIN
-- ============================================================

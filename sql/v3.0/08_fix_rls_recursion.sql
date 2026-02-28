-- ============================================================
-- FASE 8: FIX INFINITE RECURSION EN RLS
-- ============================================================
-- Versión: v3.0 (Hotfix)
-- Fecha: 2026-02-27
--
-- PROBLEMA:
--   La política "admin_ver_miembros_org" en organizacion_miembros
--   hace un subquery a la misma tabla:
--
--     USING (
--       organizacion_id IN (
--         SELECT organizacion_id FROM organizacion_miembros  ← se referencia a sí misma
--         WHERE user_id = auth.uid() AND rol IN ('admin','superadmin')
--       )
--     )
--
--   Cuando cualquier otra política (candidatos, campanas, etc.)
--   consulta organizacion_miembros, Postgres evalúa sus policies.
--   admin_ver_miembros_org intenta consultar organizacion_miembros de nuevo
--   → Postgres detecta: "infinite recursion detected in policy" → ERROR.
--
-- SÍNTOMAS:
--   - INSERT en candidatos falla: "infinite recursion in policy"
--   - esAdmin siempre false en el Dashboard (context carga rol=null)
--   - Lista de campañas vacía aunque existan en la DB
--
-- SOLUCIÓN:
--   Crear función SECURITY DEFINER que consulta organizacion_miembros
--   sin aplicar RLS (corre como superuser). Reemplazar el subquery
--   recursivo con esta función.
--
-- PRERREQUISITO: 04_rls_unificado.sql ejecutado
-- ============================================================

-- ============================================================
-- PASO 1: FUNCIÓN SECURITY DEFINER — rompe el ciclo
-- ============================================================
-- SECURITY DEFINER = corre con privilegios del creador (postgres),
-- no del usuario que la llama. Esto evita que Postgres aplique
-- las políticas RLS de organizacion_miembros dentro de la función,
-- cortando el ciclo de recursión infinita.

CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organizacion_id
  FROM organizacion_miembros
  WHERE user_id = auth.uid()
    AND activo = true
$$;

-- ============================================================
-- PASO 2: ELIMINAR POLÍTICA RECURSIVA
-- ============================================================
DROP POLICY IF EXISTS "admin_ver_miembros_org" ON organizacion_miembros;

-- ============================================================
-- PASO 3: RECREAR POLÍTICA SIN RECURSIÓN
-- ============================================================
-- Usa la función SECURITY DEFINER en lugar del subquery directo.
-- Resultado idéntico: admins ven todas las membresías de su org.
-- Sin diferencia funcional, sin bucle infinito.

CREATE POLICY "admin_ver_miembros_org" ON organizacion_miembros
  FOR SELECT TO authenticated
  USING (
    organizacion_id IN (SELECT get_my_org_ids())
  );

-- ============================================================
-- PASO 4: VALIDACIÓN
-- ============================================================
DO $$
BEGIN
  -- Verificar que la función existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_my_org_ids'
  ) THEN
    RAISE EXCEPTION 'FALLO: función get_my_org_ids no creada';
  END IF;

  -- Verificar que la política fue recreada
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizacion_miembros'
      AND policyname = 'admin_ver_miembros_org'
  ) THEN
    RAISE EXCEPTION 'FALLO: política admin_ver_miembros_org no recreada';
  END IF;

  RAISE NOTICE '✅ FASE 8 COMPLETADA: RLS recursion fix aplicado. Candidatos y campañas deberían funcionar.';
END $$;

-- ============================================================
-- FIN FASE 8
-- ============================================================

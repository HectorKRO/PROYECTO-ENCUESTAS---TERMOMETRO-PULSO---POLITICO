-- ============================================================
-- FASE 4: ROW-LEVEL SECURITY UNIFICADO
-- ============================================================
-- Versión: v3.0 (Corregido)
-- Fecha: 2026-02-26
--
-- PRERREQUISITOS:
--   - 03_respuestas_contexto.sql ejecutado
--   - Todas las tablas tienen organizacion_id y municipio_id
--
-- CORRECCIONES CRÍTICAS (Bugs #9, #11, #12):
--   - Bug #9:  Todas las políticas anteriores se eliminan primero (DROP)
--   - Bug #11: Una sola política con AND explícito (no dos que hagan OR)
--   - Bug #12: Superadmin también filtra por organización (no ve todo)
--   - Bug #10: Eliminada función get_current_organizacion() (no se usaba)
--
-- CORRECCIONES DE AUDITORÍA:
--   - BugAudit-D1: RLS habilitado en tablas nuevas (organizaciones, miembros, municipios)
--   - BugAudit-D3: CRÍTICO — Política anon para INSERT de encuestas (re-añadida)
--   - BugAudit-D4: RLS habilitado en municipios antes de crear su política
-- ============================================================

-- ============================================================
-- PASO 0: ELIMINAR TODAS LAS POLÍTICAS ANTERIORES (Bug #9)
-- ============================================================
-- Esto evita que políticas antiguas coexistan y causen OR implícito

-- Políticas de respuestas
DROP POLICY IF EXISTS "respuestas_isolation_completa"    ON respuestas;
DROP POLICY IF EXISTS "respuestas_org_isolation"         ON respuestas;
DROP POLICY IF EXISTS "respuestas_municipio_restriction" ON respuestas;
DROP POLICY IF EXISTS "encuestador_ver_su_campana"       ON respuestas;
DROP POLICY IF EXISTS "candidato_ver_sus_campanas"       ON respuestas;
DROP POLICY IF EXISTS "encuesta_publica_insertar"        ON respuestas;
DROP POLICY IF EXISTS "encuesta_publica_insertar_v3"     ON respuestas;
DROP POLICY IF EXISTS "encuestador_insertar"             ON respuestas;
DROP POLICY IF EXISTS "encuestador_insertar_v3"          ON respuestas;

-- Políticas de campanas
DROP POLICY IF EXISTS "campanas_isolation_completa" ON campanas;
DROP POLICY IF EXISTS "campanas_org_isolation"      ON campanas;
DROP POLICY IF EXISTS "candidato_ver_campanas"      ON campanas;

-- Políticas de candidatos
DROP POLICY IF EXISTS "candidatos_isolation"      ON candidatos;
DROP POLICY IF EXISTS "candidato_ver_propio"      ON candidatos;
DROP POLICY IF EXISTS "candidatos_lectura_anon"   ON candidatos;

-- Políticas de encuestadores
DROP POLICY IF EXISTS "encuestadores_isolation"   ON encuestadores;
DROP POLICY IF EXISTS "encuestador_ver_propio"    ON encuestadores;
DROP POLICY IF EXISTS "encuestador_admin_campana" ON encuestadores;

-- Políticas de catálogos geográficos
DROP POLICY IF EXISTS "secciones_lectura_publica"  ON secciones_electorales;
DROP POLICY IF EXISTS "colonias_lectura_publica"   ON colonias;
DROP POLICY IF EXISTS "municipios_lectura_publica" ON municipios;

-- Políticas de organización (pueden existir de ejecuciones previas)
DROP POLICY IF EXISTS "org_ver_propia"          ON organizaciones;
DROP POLICY IF EXISTS "miembros_ver_propios"    ON organizacion_miembros;
DROP POLICY IF EXISTS "admin_ver_miembros_org"  ON organizacion_miembros;
DROP POLICY IF EXISTS "org_ver_sus_municipios"  ON organizacion_municipios;

-- ============================================================
-- PASO 1: HABILITAR RLS EN TABLAS NUEVAS (BugAudit-D1, D4)
-- ============================================================
-- Las tablas nuevas no tienen RLS activo por defecto.
-- Sin esto, las políticas se crean pero NUNCA se aplican.

ALTER TABLE organizaciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizacion_miembros   ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizacion_municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipios              ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASO 2: POLÍTICA ANON — INSERT DE ENCUESTAS PÚBLICAS (BugAudit-D3 CRÍTICO)
-- ============================================================
-- Sin esta política, NINGUNA encuesta puede enviarse (formulario campo, QR,
-- WhatsApp, offline). El script original eliminaba esta política sin reponerla.

CREATE POLICY "encuesta_publica_insertar_v3" ON respuestas
  FOR INSERT TO anon
  WITH CHECK (
    campana_id IN (
      SELECT id FROM campanas
      WHERE activa = true
        AND organizacion_id IS NOT NULL  -- Solo campañas migradas a v3.0
    )
    -- BUG-C3 FIX: Umbral unificado a 30s (coincide con validación API)
    AND (duracion_segundos IS NULL OR duracion_segundos >= 30)
  );

-- ============================================================
-- PASO 3: POLÍTICA UNIFICADA PARA RESPUESTAS (Bug #11 corregido)
-- ============================================================
-- UNA sola política con AND explícito entre org y municipio

CREATE POLICY "respuestas_isolation_completa" ON respuestas
  FOR ALL TO authenticated
  USING (
    -- CONDICIÓN 1: Pertenece a la organización del usuario
    organizacion_id IN (
      SELECT organizacion_id
      FROM organizacion_miembros
      WHERE user_id = auth.uid()
        AND activo = true
    )
    AND
    -- CONDICIÓN 2: Acceso al municipio (o es admin/superadmin de la org)
    (
      municipio_id IN (
        SELECT omu.municipio_id
        FROM organizacion_miembros om
        JOIN organizacion_municipios omu ON om.organizacion_id = omu.organizacion_id
        WHERE om.user_id = auth.uid()
          AND om.activo = true
      )
      OR
      -- Admin/Superadmin ve todos los municipios de su org (Bug #12 corregido)
      EXISTS (
        SELECT 1 FROM organizacion_miembros om
        WHERE om.user_id = auth.uid()
          AND om.rol IN ('admin', 'superadmin')
          AND om.activo = true
          AND om.organizacion_id = respuestas.organizacion_id  -- Acotado al org de la fila
      )
    )
  )
  WITH CHECK (
    -- Para INSERT/UPDATE: validar org (municipio lo hereda de campana)
    organizacion_id IN (
      SELECT organizacion_id
      FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- ============================================================
-- PASO 4: POLÍTICA PARA CAMPANAS
-- ============================================================
CREATE POLICY "campanas_isolation_completa" ON campanas
  FOR ALL TO authenticated
  USING (
    organizacion_id IN (
      SELECT organizacion_id
      FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
  )
  WITH CHECK (
    organizacion_id IN (
      SELECT organizacion_id
      FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- ============================================================
-- PASO 5: POLÍTICA PARA CANDIDATOS
-- ============================================================
CREATE POLICY "candidatos_isolation" ON candidatos
  FOR ALL TO authenticated
  USING (
    organizacion_id IN (
      SELECT organizacion_id
      FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- ============================================================
-- PASO 6: POLÍTICA PARA ENCUESTADORES
-- ============================================================
CREATE POLICY "encuestadores_isolation" ON encuestadores
  FOR ALL TO authenticated
  USING (
    campana_id IN (
      SELECT c.id
      FROM campanas c
      JOIN organizacion_miembros om ON c.organizacion_id = om.organizacion_id
      WHERE om.user_id = auth.uid() AND om.activo = true
    )
  );

-- ============================================================
-- PASO 7: POLÍTICAS DE LECTURA PÚBLICA (Catálogos geográficos)
-- ============================================================
CREATE POLICY "secciones_lectura_publica" ON secciones_electorales
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "colonias_lectura_publica" ON colonias
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "municipios_lectura_publica" ON municipios
  FOR SELECT TO anon, authenticated
  USING (activo = true);

-- ============================================================
-- PASO 8: POLÍTICAS PARA TABLAS DE ORGANIZACIÓN (BugAudit-D1)
-- ============================================================

-- Usuarios ven solo su(s) organización(es)
CREATE POLICY "org_ver_propia" ON organizaciones
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT organizacion_id FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Usuarios ven solo sus propias membresías
CREATE POLICY "miembros_ver_propios" ON organizacion_miembros
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins ven todas las membresías de su organización
CREATE POLICY "admin_ver_miembros_org" ON organizacion_miembros
  FOR SELECT TO authenticated
  USING (
    organizacion_id IN (
      SELECT organizacion_id FROM organizacion_miembros
      WHERE user_id = auth.uid()
        AND activo = true
        AND rol IN ('admin', 'superadmin')
    )
  );

-- Municipios visibles por organización
CREATE POLICY "org_ver_sus_municipios" ON organizacion_municipios
  FOR SELECT TO authenticated
  USING (
    organizacion_id IN (
      SELECT organizacion_id FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- ============================================================
-- PASO 9: VALIDACIÓN POST-MIGRACIÓN (Comprueba políticas por nombre)
-- ============================================================
DO $$
DECLARE
  v_errores INT := 0;
BEGIN
  -- Política crítica: anon insert
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'respuestas' AND policyname = 'encuesta_publica_insertar_v3'
  ) THEN
    RAISE NOTICE '   ❌ FALTA: encuesta_publica_insertar_v3 (encuestas anónimas bloqueadas)';
    v_errores := v_errores + 1;
  END IF;

  -- Política unificada AND
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'respuestas' AND policyname = 'respuestas_isolation_completa'
  ) THEN
    RAISE NOTICE '   ❌ FALTA: respuestas_isolation_completa';
    v_errores := v_errores + 1;
  END IF;

  -- Política de campanas
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'campanas' AND policyname = 'campanas_isolation_completa'
  ) THEN
    RAISE NOTICE '   ❌ FALTA: campanas_isolation_completa';
    v_errores := v_errores + 1;
  END IF;

  -- RLS habilitado en organizaciones
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'organizaciones'
      AND c.relrowsecurity = true
  ) THEN
    RAISE NOTICE '   ❌ FALTA: RLS no habilitado en organizaciones (datos expuestos)';
    v_errores := v_errores + 1;
  END IF;

  -- RLS habilitado en organizacion_miembros
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'organizacion_miembros'
      AND c.relrowsecurity = true
  ) THEN
    RAISE NOTICE '   ❌ FALTA: RLS no habilitado en organizacion_miembros';
    v_errores := v_errores + 1;
  END IF;

  IF v_errores > 0 THEN
    RAISE EXCEPTION 'FASE 4 FALLÓ: % errores críticos en políticas RLS', v_errores;
  END IF;

  RAISE NOTICE '✅ FASE 4 COMPLETADA: RLS unificado, políticas anon restauradas, tablas nuevas protegidas.';
END $$;

-- ============================================================
-- NOTA SOBRE FUNCIÓN ELIMINADA (Bug #10)
-- ============================================================
-- La función get_current_organizacion() fue eliminada porque:
-- 1. No estaba siendo usada por ninguna política
-- 2. Las políticas usan subqueries directos (más eficientes)
-- 3. Menos código = menos mantenimiento

-- ============================================================
-- FIN FASE 4
-- ============================================================

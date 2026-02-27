-- ============================================================
-- V3.1: MULTI-TENANT Y GESTIÓN DE CANDIDATOS
-- ============================================================
-- Versión: v3.1
-- Fecha: 2026-02-27
--
-- CAMBIOS:
--   - Agrega organizacion_id a campanas para RLS multi-tenant
--   - Crea tabla candidatos_rivales para reconocimiento_asistido
--   - Agrega índices de performance
-- ============================================================

-- ============================================================
-- 1. AGREGAR organizacion_id A CAMPAÑAS
-- ============================================================
ALTER TABLE campanas 
  ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE;

-- Índice para filtrado por organización (solo campañas activas)
CREATE INDEX IF NOT EXISTS idx_campanas_org 
  ON campanas(organizacion_id) 
  WHERE activa = true;

-- Vincular campañas existentes a la organización legacy
UPDATE campanas 
  SET organizacion_id = '00000000-0000-0000-0000-000000000001'::UUID
  WHERE organizacion_id IS NULL;

-- ============================================================
-- 2. TABLA CANDIDATOS RIVALES
-- ============================================================
-- Para la pregunta de reconocimiento asistido en encuestas
CREATE TABLE IF NOT EXISTS candidatos_rivales (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id  UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  campana_id       UUID REFERENCES campanas(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  partido          TEXT,
  cargo            TEXT,
  activo           BOOLEAN DEFAULT true,
  orden            INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  created_by       UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE candidatos_rivales IS 'Candidatos rivales para la pregunta de reconocimiento asistido en encuestas';

-- Índices
CREATE INDEX IF NOT EXISTS idx_candidatos_rivales_org 
  ON candidatos_rivales(organizacion_id) 
  WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_candidatos_rivales_campana 
  ON candidatos_rivales(campana_id) 
  WHERE activo = true;

-- ============================================================
-- 3. ACTUALIZAR RLS PARA CAMPAÑAS
-- ============================================================

-- Política: Usuarios solo ven campañas de su organización
DROP POLICY IF EXISTS "campañas_ver_org" ON campanas;
CREATE POLICY "campañas_ver_org" ON campanas
  FOR SELECT TO authenticated
  USING (
    organizacion_id IN (
      SELECT organizacion_id FROM organizacion_miembros 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Política: Admin puede crear/editar campañas de su org
DROP POLICY IF EXISTS "campañas_admin_org" ON campanas;
CREATE POLICY "campañas_admin_org" ON campanas
  FOR ALL TO authenticated
  USING (
    organizacion_id IN (
      SELECT organizacion_id FROM organizacion_miembros 
      WHERE user_id = auth.uid() 
      AND rol IN ('admin', 'superadmin')
      AND activo = true
    )
  );

-- Política: Candidato ve sus propias campañas
DROP POLICY IF EXISTS "candidato_ver_campanas" ON campanas;
CREATE POLICY "candidato_ver_campanas" ON campanas
  FOR SELECT TO authenticated
  USING (
    candidato_id IN (
      SELECT id FROM candidatos WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. RLS PARA CANDIDATOS RIVALES
-- ============================================================
ALTER TABLE candidatos_rivales ENABLE ROW LEVEL SECURITY;

-- Lectura: Miembros de la org ven rivales de su org
DROP POLICY IF EXISTS "rivales_lectura_org" ON candidatos_rivales;
CREATE POLICY "rivales_lectura_org" ON candidatos_rivales
  FOR SELECT TO authenticated
  USING (
    organizacion_id IN (
      SELECT organizacion_id FROM organizacion_miembros 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Escritura: Solo admin/superadmin
DROP POLICY IF EXISTS "rivales_admin_org" ON candidatos_rivales;
CREATE POLICY "rivales_admin_org" ON candidatos_rivales
  FOR ALL TO authenticated
  USING (
    organizacion_id IN (
      SELECT organizacion_id FROM organizacion_miembros 
      WHERE user_id = auth.uid() 
      AND rol IN ('admin', 'superadmin')
      AND activo = true
    )
  );

-- ============================================================
-- 5. FUNCIÓN: LISTAR CANDIDATOS PARA RECONOCIMIENTO
-- ============================================================
-- Retorna el candidato principal + rivales activos de una campaña
CREATE OR REPLACE FUNCTION fn_candidatos_reconocimiento(p_campana_id UUID)
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  tipo TEXT, -- 'principal' | 'rival'
  partido TEXT,
  orden INT
) AS $$
BEGIN
  RETURN QUERY
  -- Candidato principal
  SELECT 
    c.id,
    c.nombre,
    'principal'::TEXT as tipo,
    c.partido,
    0::INT as orden
  FROM campanas ca
  JOIN candidatos c ON ca.candidato_id = c.id
  WHERE ca.id = p_campana_id
  
  UNION ALL
  
  -- Candidatos rivales
  SELECT 
    cr.id,
    cr.nombre,
    'rival'::TEXT as tipo,
    cr.partido,
    cr.orden
  FROM candidatos_rivales cr
  WHERE cr.campana_id = p_campana_id 
    AND cr.activo = true
  
  ORDER BY orden, nombre;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. VALIDACIÓN POST-MIGRACIÓN
-- ============================================================
DO $$
DECLARE
  camp_sin_org INT;
  org_count INT;
BEGIN
  -- Verificar que todas las campañas tienen organización
  SELECT COUNT(*) INTO camp_sin_org
  FROM campanas
  WHERE organizacion_id IS NULL;
  
  IF camp_sin_org > 0 THEN
    RAISE EXCEPTION 'ERROR: Quedaron % campañas sin organizacion_id', camp_sin_org;
  END IF;
  
  -- Verificar que existe al menos una organización
  SELECT COUNT(*) INTO org_count FROM organizaciones;
  
  IF org_count = 0 THEN
    RAISE EXCEPTION 'ERROR: No hay organizaciones configuradas';
  END IF;
  
  RAISE NOTICE '✅ V3.1 COMPLETADO: % campañas vinculadas a organizaciones', 
    (SELECT COUNT(*) FROM campanas);
END $$;

-- ============================================================
-- FIN MIGRACIÓN V3.1
-- ============================================================

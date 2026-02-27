-- ============================================================
-- FASE 2: MULTI-TENANCY - ORGANIZACIONES
-- ============================================================
-- Versión: v3.0 (Corregido)
-- Fecha: 2026-02-26
--
-- PRERREQUISITOS:
--   - 01_catalogo_geografico.sql ejecutado
--   - municipios.id = 1 (Atlixco) existe
--
-- CORRECCIONES APLICADAS:
--   - Organización legacy creada con UUID fijo para referencia estable
--   - Acceso a Atlixco vinculado automáticamente
--   - Guards de validación al final
--
-- CORRECCIONES DE AUDITORÍA:
--   - BugAudit-B1: Añadido guard de prerrequisito para tabla municipios
--   - BugAudit-B3: ON CONFLICT DO UPDATE → DO NOTHING en org legacy
--     (evita sobreescribir cambios manuales en re-ejecuciones)
-- ============================================================

-- Guard: Verificar prerrequisito (BugAudit-B1)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'municipios') THEN
    RAISE EXCEPTION 'No se encontró la tabla municipios. ¿Está aplicado 01_catalogo_geografico.sql?';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM municipios WHERE id = 1) THEN
    RAISE EXCEPTION 'No existe municipio_id=1 (Atlixco). ¿Se ejecutó correctamente 01_catalogo_geografico.sql?';
  END IF;
END $$;

-- ============================================================
-- 1. TABLA ORGANIZACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS organizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('partido','consultora','candidato','gobierno','ong')),
  plan TEXT DEFAULT 'basico' CHECK (plan IN ('basico','profesional','enterprise')),
  contacto_email TEXT,
  contacto_telefono TEXT,
  limite_municipios INT DEFAULT 1,
  limite_campanas INT DEFAULT 3,
  limite_encuestadores INT DEFAULT 10,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE organizaciones IS 'Clientes/tenants del sistema SaaS';

-- ============================================================
-- 2. TABLA DE MEMBRESÍA USUARIOS-ORGANIZACIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS organizacion_miembros (
  organizacion_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rol TEXT CHECK (rol IN ('superadmin','admin','analista','encuestador')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (organizacion_id, user_id)
);

COMMENT ON TABLE organizacion_miembros IS 'Relación muchos-a-muchos entre usuarios y organizaciones con roles';

-- Índice para búsquedas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_org_miembros_user 
  ON organizacion_miembros(user_id) 
  WHERE activo = true;

-- ============================================================
-- 3. TABLA DE ACCESO A MUNICIPIOS POR ORGANIZACIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS organizacion_municipios (
  organizacion_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  municipio_id SMALLINT REFERENCES municipios(id) ON DELETE CASCADE,
  fecha_inicio DATE DEFAULT CURRENT_DATE,
  fecha_fin DATE,
  PRIMARY KEY (organizacion_id, municipio_id)
);

COMMENT ON TABLE organizacion_municipios IS 'Municipios a los que cada organización tiene acceso';

-- ============================================================
-- 4. CREAR ORGANIZACIÓN LEGACY PARA DATOS EXISTENTES
-- ============================================================
-- Usamos UUID fijo para poder referenciarlo en scripts posteriores

INSERT INTO organizaciones (
  id, nombre, tipo, plan, limite_municipios, limite_campanas, activa
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Organización Principal (Legacy)',
  'candidato',
  'enterprise',
  10,
  10,
  true
) ON CONFLICT (id) DO NOTHING;
-- BugAudit-B3: DO NOTHING — si la org legacy ya existe en re-ejecuciones,
-- no sobreescribir nombre ni plan que pudieran haberse ajustado manualmente.

-- ============================================================
-- 5. ASIGNAR ACCESO A ATLIXCO A LA ORGANIZACIÓN LEGACY
-- ============================================================
INSERT INTO organizacion_municipios (
  organizacion_id, municipio_id
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  1
) ON CONFLICT (organizacion_id, municipio_id) DO NOTHING;

-- ============================================================
-- 6. AGREGAR organizacion_id A CANDIDATOS (para vinculación futura)
-- ============================================================
ALTER TABLE candidatos 
  ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);

-- Vincular candidatos existentes a org legacy
UPDATE candidatos 
  SET organizacion_id = '00000000-0000-0000-0000-000000000001'::UUID
  WHERE organizacion_id IS NULL;

-- ============================================================
-- 7. VALIDACIÓN POST-MIGRACIÓN
-- ============================================================
DO $$
DECLARE
  org_count INT;
  mun_access INT;
  cand_sin_org INT;
BEGIN
  -- Verificar que existe la org legacy
  SELECT COUNT(*) INTO org_count
  FROM organizaciones
  WHERE id = '00000000-0000-0000-0000-000000000001'::UUID;
  
  IF org_count = 0 THEN
    RAISE EXCEPTION 'ERROR CRÍTICO: No se creó la organización legacy';
  END IF;
  
  -- Verificar acceso a Atlixco
  SELECT COUNT(*) INTO mun_access
  FROM organizacion_municipios
  WHERE organizacion_id = '00000000-0000-0000-0000-000000000001'::UUID
    AND municipio_id = 1;
  
  IF mun_access = 0 THEN
    RAISE EXCEPTION 'ERROR CRÍTICO: La organización legacy no tiene acceso a Atlixco';
  END IF;
  
  -- Verificar candidatos
  SELECT COUNT(*) INTO cand_sin_org
  FROM candidatos
  WHERE organizacion_id IS NULL;
  
  IF cand_sin_org > 0 THEN
    RAISE EXCEPTION 'ERROR CRÍTICO: Quedaron % candidatos sin organizacion_id', cand_sin_org;
  END IF;
  
  RAISE NOTICE '✅ FASE 2 COMPLETADA: Organización legacy lista con % candidatos vinculados', 
    (SELECT COUNT(*) FROM candidatos WHERE organizacion_id = '00000000-0000-0000-0000-000000000001'::UUID);
END $$;

-- ============================================================
-- FIN FASE 2
-- ============================================================

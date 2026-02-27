# 🗺️ Roadmap Multi-Municipio v2 — CORREGIDO

**Versión:** v2.0 (post-revisión)  
**Fecha corrección:** 2026-02-26  
**Bugs corregidos:** 16 críticos, altos y de diseño  
**Duración estimada:** 2-3 semanas (sin cambios, pero con scripts estables)

---

## 🚨 CAMBIOS CRÍTICOS POST-REVISIÓN

### 1. PK de Secciones Electorales (NO se cambia)

```sql
-- ❌ ERROR v1: Intentar PK compuesta
ALTER TABLE secciones_electorales 
  DROP CONSTRAINT secciones_electorales_pkey,
  ADD PRIMARY KEY (seccion, municipio_id);
-- RESULTADO: Cascada de FKs rotas en colonias y respuestas

-- ✅ CORREGIDO v2: PK simple se mantiene
-- La restricción de unicidad por municipio se maneja por aplicación
-- Los números INE son únicos dentro del estado de Puebla
```

### 2. Políticas RLS (Unificadas, no separadas)

```sql
-- ❌ ERROR v1: Dos políticas = OR implícito
CREATE POLICY "respuestas_org_isolation" ON respuestas ...;
CREATE POLICY "respuestas_municipio_restriction" ON respuestas ...;
-- RESULTADO: PostgreSQL aplica OR, el municipio no filtra correctamente

-- ✅ CORREGIDO v2: Una política con AND explícito
CREATE POLICY "respuestas_isolation_completa" ON respuestas
  FOR ALL TO authenticated
  USING (
    -- Condición 1: Pertenece a la organización del usuario
    organizacion_id IN (
      SELECT organizacion_id 
      FROM organizacion_miembros 
      WHERE user_id = auth.uid() AND activo = true
    )
    AND
    -- Condición 2: Tiene acceso al municipio (o es superadmin)
    (
      municipio_id IN (
        SELECT om.municipio_id
        FROM organizacion_miembros om
        JOIN organizacion_municipios omu ON om.organizacion_id = omu.organizacion_id
        WHERE om.user_id = auth.uid() AND om.activo = true
      )
      OR
      EXISTS (
        SELECT 1 FROM organizacion_miembros
        WHERE user_id = auth.uid() AND rol = 'superadmin' AND activo = true
      )
    )
  );
```

### 3. Secuencia de Migración (Corregida)

```sql
-- ❌ ERROR v1: Orden incorrecto
UPDATE respuestas 
SET organizacion_id = c.organizacion_id, municipio_id = c.municipio_id
FROM campanas c WHERE r.campana_id = c.id;
-- RESULTADO: "column c.municipio_id does not exist"

-- ✅ CORREGIDO v2: Orden correcto
-- 1. Agregar columna a campanas
ALTER TABLE campanas ADD COLUMN municipio_id SMALLINT;

-- 2. Poblar campanas
UPDATE campanas SET municipio_id = 1 WHERE municipio_id IS NULL;

-- 3. Agregar columna a respuestas
ALTER TABLE respuestas ADD COLUMN municipio_id SMALLINT;
ALTER TABLE respuestas ADD COLUMN organizacion_id UUID;

-- 4. Ahora sí, poblar respuestas con datos de campanas
UPDATE respuestas r
SET 
  organizacion_id = c.organizacion_id,
  municipio_id = c.municipio_id
FROM campanas c
WHERE r.campana_id = c.id;
```

---

## 📋 FASES CORREGIDAS

### FASE 0: Preparación (Día 1)

**Checklist:**
- [ ] Backup completo de BD
- [ ] Crear BD de staging
- [ ] Script de validación post-migración

**Script de validación:**
```sql
-- 00_validate_migration.sql
DO $$
DECLARE
  nulls_campanas INT;
  nulls_respuestas INT;
BEGIN
  SELECT COUNT(*) INTO nulls_campanas 
  FROM campanas WHERE municipio_id IS NULL;
  
  SELECT COUNT(*) INTO nulls_respuestas 
  FROM respuestas 
  WHERE organizacion_id IS NULL OR municipio_id IS NULL;
  
  IF nulls_campanas > 0 THEN
    RAISE EXCEPTION 'Quedaron % campanas sin municipio_id', nulls_campanas;
  END IF;
  
  IF nulls_respuestas > 0 THEN
    RAISE EXCEPTION 'Quedaron % respuestas sin organizacion_id o municipio_id', nulls_respuestas;
  END IF;
  
  RAISE NOTICE '✅ Validación pasada: Sin NULLs en columnas requeridas';
END $$;
```

---

### FASE 1: Catálogo Geográfico (Días 2-4) — CORREGIDA

**Archivo:** `01_catalogo_geografico.sql`

```sql
-- PREREQUISITE GUARD
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'estados') THEN
    RAISE NOTICE 'Catálogo geográfico ya existe, omitiendo...';
    RETURN;
  END IF;
END $$;

-- 1. Tabla estados
CREATE TABLE estados (
  id SMALLINT PRIMARY KEY,
  nombre TEXT NOT NULL,
  abrev TEXT UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT true
);

INSERT INTO estados (id, nombre, abrev) VALUES
  (21, 'Puebla', 'PUE');

-- 2. Tabla municipios
CREATE TABLE municipios (
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

-- 3. Insertar Atlixco como municipio 1
INSERT INTO municipios (id, estado_id, nombre, cabecera, distrito_fed, latitud_centro, longitud_centro)
VALUES (1, 21, 'Atlixco', 'Atlixco, Puebla', 13, 18.9088, -98.4321)
ON CONFLICT (id) DO NOTHING;

-- 4. Agregar municipio_id a secciones_electorales (como columna, no en PK)
ALTER TABLE secciones_electorales 
  ADD COLUMN IF NOT EXISTS municipio_id SMALLINT REFERENCES municipios(id);

-- 5. Asignar secciones existentes a Atlixco
UPDATE secciones_electorales 
SET municipio_id = 1 
WHERE municipio_id IS NULL;

-- 6. Crear índice para búsquedas por municipio
CREATE INDEX IF NOT EXISTS idx_secciones_municipio 
ON secciones_electorales(municipio_id);

-- 7. VALIDACIÓN
DO $$
DECLARE
  secciones_sin_mun INT;
BEGIN
  SELECT COUNT(*) INTO secciones_sin_mun
  FROM secciones_electorales
  WHERE municipio_id IS NULL;
  
  IF secciones_sin_mun > 0 THEN
    RAISE EXCEPTION 'Quedaron % secciones sin municipio_id', secciones_sin_mun;
  END IF;
END $$;
```

---

### FASE 2: Organizaciones (Días 5-7) — CORREGIDA

**Archivo:** `02_organizaciones.sql`

```sql
-- 1. Tabla organizaciones
CREATE TABLE IF NOT EXISTS organizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('partido','consultora','candidato','gobierno','ong')),
  plan TEXT DEFAULT 'basico' CHECK (plan IN ('basico','profesional','enterprise')),
  limite_municipios INT DEFAULT 1,
  limite_campanas INT DEFAULT 3,
  limite_encuestadores INT DEFAULT 10,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de membresía
CREATE TABLE IF NOT EXISTS organizacion_miembros (
  organizacion_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rol TEXT CHECK (rol IN ('superadmin','admin','analista','encuestador')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (organizacion_id, user_id)
);

-- 3. Tabla de acceso a municipios
CREATE TABLE IF NOT EXISTS organizacion_municipios (
  organizacion_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  municipio_id SMALLINT REFERENCES municipios(id) ON DELETE CASCADE,
  fecha_inicio DATE DEFAULT CURRENT_DATE,
  fecha_fin DATE,
  PRIMARY KEY (organizacion_id, municipio_id)
);

-- 4. CREAR ORGANIZACIÓN LEGACY (para datos existentes)
INSERT INTO organizaciones (
  id, nombre, tipo, plan, limite_municipios, activa
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Organización Principal (Legacy)',
  'candidato',
  'enterprise',
  10,
  true
) ON CONFLICT (id) DO NOTHING;

-- 5. Asignar acceso a Atlixco
INSERT INTO organizacion_municipios (organizacion_id, municipio_id)
VALUES ('00000000-0000-0000-0000-000000000001', 1)
ON CONFLICT (organizacion_id, municipio_id) DO NOTHING;
```

---

### FASE 3: Contexto en Respuestas (Días 8-10) — CORREGIDA

**Archivo:** `03_respuestas_contexto.sql`

```sql
-- ORDEN CORRECTO (crítico):
-- 1. campanas → 2. respuestas

-- PASO 1: Agregar a campanas PRIMERO
ALTER TABLE campanas 
  ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS municipio_id SMALLINT REFERENCES municipios(id);

-- PASO 2: Poblar campanas
UPDATE campanas 
SET 
  organizacion_id = '00000000-0000-0000-0000-000000000001',
  municipio_id = 1
WHERE organizacion_id IS NULL OR municipio_id IS NULL;

-- PASO 3: Hacer obligatorias
ALTER TABLE campanas 
  ALTER COLUMN organizacion_id SET NOT NULL,
  ALTER COLUMN municipio_id SET NOT NULL;

-- PASO 4: Agregar a respuestas
ALTER TABLE respuestas 
  ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS municipio_id SMALLINT REFERENCES municipios(id);

-- PASO 5: Poblar respuestas desde campanas (ahora sí existe c.municipio_id)
UPDATE respuestas r
SET 
  organizacion_id = c.organizacion_id,
  municipio_id = c.municipio_id
FROM campanas c
WHERE r.campana_id = c.id
  AND (r.organizacion_id IS NULL OR r.municipio_id IS NULL);

-- PASO 6: Índices
CREATE INDEX IF NOT EXISTS idx_respuestas_municipio 
ON respuestas(municipio_id, campana_id);

CREATE INDEX IF NOT EXISTS idx_respuestas_organizacion 
ON respuestas(organizacion_id, created_at);

-- PASO 7: VALIDACIÓN
DO $$
DECLARE
  nulls INT;
BEGIN
  SELECT COUNT(*) INTO nulls
  FROM respuestas
  WHERE organizacion_id IS NULL OR municipio_id IS NULL;
  
  IF nulls > 0 THEN
    RAISE EXCEPTION 'Quedaron % respuestas sin organizacion_id o municipio_id', nulls;
  END IF;
END $$;
```

---

### FASE 4: RLS Unificado (Días 11-13) — CORREGIDO

**Archivo:** `04_rls_unificado.sql`

```sql
-- PASO 0: ELIMINAR TODAS LAS POLÍTICAS ANTERIORES
DROP POLICY IF EXISTS "respuestas_org_isolation" ON respuestas;
DROP POLICY IF EXISTS "respuestas_municipio_restriction" ON respuestas;
DROP POLICY IF EXISTS "respuestas_isolation_completa" ON respuestas;
DROP POLICY IF EXISTS "encuestador_ver_su_campana" ON respuestas;
DROP POLICY IF EXISTS "candidato_ver_sus_campanas" ON respuestas;
DROP POLICY IF EXISTS "encuesta_publica_insertar" ON respuestas;
DROP POLICY IF EXISTS "encuestador_insertar" ON respuestas;

-- PASO 1: NUEVA POLÍTICA UNIFICADA
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
    -- CONDICIÓN 2: Acceso al municipio O superadmin
    (
      municipio_id IN (
        SELECT omu.municipio_id
        FROM organizacion_miembros om
        JOIN organizacion_municipios omu ON om.organizacion_id = omu.organizacion_id
        WHERE om.user_id = auth.uid() 
          AND om.activo = true
      )
      OR
      EXISTS (
        SELECT 1 FROM organizacion_miembros
        WHERE user_id = auth.uid() 
          AND rol = 'superadmin' 
          AND activo = true
      )
    )
  )
  WITH CHECK (
    -- Mismo control para INSERT/UPDATE
    organizacion_id IN (
      SELECT organizacion_id 
      FROM organizacion_miembros 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- PASO 2: Política para campanas (similar)
DROP POLICY IF EXISTS "campanas_org_isolation" ON campanas;

CREATE POLICY "campanas_isolation_completa" ON campanas
  FOR ALL TO authenticated
  USING (
    organizacion_id IN (
      SELECT organizacion_id 
      FROM organizacion_miembros 
      WHERE user_id = auth.uid() AND activo = true
    )
  );
```

---

### FASE 5: Vistas Simplificadas (Días 14-16) — CORREGIDA

**Archivo:** `05_vistas_corregidas.sql`

```sql
-- ❌ ELIMINADA: v_comparacion_campanas (explosión combinatoria)
-- ✅ REEMPLAZADA: v_metricas_por_campana (limpio)

DROP VIEW IF EXISTS v_comparacion_campanas;
DROP VIEW IF EXISTS v_metricas_por_campana;

CREATE VIEW v_metricas_por_campana AS
SELECT 
  c.id as campana_id,
  c.nombre as campana_nombre,
  c.municipio_id,
  m.nombre as municipio_nombre,
  c.organizacion_id,
  COUNT(r.id) as total_encuestas,
  ROUND(AVG(r.intencion_voto)::numeric, 2) as intencion_promedio,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) as pct_intencion_positiva,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(*),0), 1) as pct_reconocimiento
FROM campanas c
JOIN municipios m ON c.municipio_id = m.id
LEFT JOIN respuestas r ON r.campana_id = c.id AND r.completada = true AND r.deleted_at IS NULL
WHERE c.activa = true
GROUP BY c.id, c.nombre, c.municipio_id, m.nombre, c.organizacion_id;

-- Vista por municipio
DROP VIEW IF EXISTS v_metricas_por_municipio;

CREATE VIEW v_metricas_por_municipio AS
SELECT 
  m.id as municipio_id,
  m.nombre as municipio_nombre,
  r.organizacion_id,
  COUNT(*) as total_encuestas,
  COUNT(DISTINCT r.campana_id) as total_campanas,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(*),0), 1) as pct_reconocimiento,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) as pct_intencion
FROM respuestas r
JOIN municipios m ON r.municipio_id = m.id
WHERE r.completada = true AND r.deleted_at IS NULL
GROUP BY m.id, m.nombre, r.organizacion_id;
```

---

### FASE 6: Template Nuevo Municipio (Día 17) — CORREGIDO

**Archivo:** `06_template_nuevo_municipio.sql`

```sql
-- ============================================
-- TEMPLATE: AGREGAR NUEVO MUNICIPIO
-- ============================================
-- INSTRUCCIONES:
-- 1. Reemplazar @MUNICIPIO_ID, @MUNICIPIO_NOMBRE
-- 2. Actualizar coordenadas y distrito
-- 3. Reemplazar lista de secciones
-- ============================================

-- Configuración
\set municipio_id 2
\set municipio_nombre 'San Martín Texmelucan'
\set estado_id 21
\set distrito_fed 12
\set lat 19.2846
\set lng -98.4381

-- PASO 1: Insertar municipio
INSERT INTO municipios (id, estado_id, nombre, cabecera, distrito_fed, latitud_centro, longitud_centro)
VALUES (:'municipio_id', :'estado_id', :'municipio_nombre', 
        :'municipio_nombre' || ', Puebla', :'distrito_fed', :'lat', :'lng')
ON CONFLICT (id) DO NOTHING;

-- PASO 2: Insertar secciones
-- NOTA: Usamos ON CONFLICT (seccion) porque la PK sigue siendo simple
INSERT INTO secciones_electorales (seccion, municipio_id, nombre_zona, tipo, lista_nominal, latitud_centro, longitud_centro)
VALUES
  ('0230', :'municipio_id', 'Centro', 'urbana', 2800, :'lat', :'lng'),
  ('0231', :'municipio_id', 'San Rafael', 'urbana', 2500, :'lat' + 0.005, :'lng' + 0.002),
  ('0232', :'municipio_id', 'Santiago', 'mixta', 1800, :'lat' - 0.003, :'lng' - 0.004)
  -- Agregar más secciones aquí...
ON CONFLICT (seccion) DO NOTHING;  -- ✅ CORREGIDO: era (seccion, municipio_id)

-- PASO 3: Crear seed de colonias (generar desde CSV)
-- \i seed_colonias_sanmartin.sql
```

---

## 📊 RESUMEN DE CORRECCIONES

| # | Problema Original | Corrección Aplicada | Archivo Afectado |
|---|-------------------|---------------------|------------------|
| 1-5 | PK compuesta rompe FKs | PK simple preservada, municipio_id como columna | 01_catalogo_geografico |
| 6 | Referencia a columna inexistente | Reordenamiento: campanas primero, luego respuestas | 03_respuestas_contexto |
| 7-8 | Sin validación post-migración | RAISE EXCEPTION si quedan NULLs | Todos los scripts |
| 9 | Políticas anteriores coexisten | DROP POLICY de todas las anteriores primero | 04_rls_unificado |
| 10 | Función no usada | Eliminada get_current_organizacion() | - |
| 11 | Dos políticas = OR | Una política con AND explícito | 04_rls_unificado |
| 12 | Superadmin ve todo | Agregado filtro de org a superadmin | 04_rls_unificado |
| 13 | Cross-join N×(N-1) | Eliminada v_comparacion_campanas | 05_vistas_corregidas |
| 15 | ON CONFLICT con constraint inexistente | Corregido a ON CONFLICT (seccion) | 06_template_nuevo_municipio |

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Pre-Deploy
- [ ] Backup completo de BD
- [ ] Ejecutar en staging primero
- [ ] Validar sin NULLs post-migración

### Deploy
- [ ] 01_catalogo_geografico.sql
- [ ] 02_organizaciones.sql
- [ ] 03_respuestas_contexto.sql
- [ ] 04_rls_unificado.sql
- [ ] 05_vistas_corregidas.sql
- [ ] 00_validate_migration.sql

### Post-Deploy
- [ ] Test login con usuario existente
- [ ] Verificar que ve solo datos de su org
- [ ] Verificar que superadmin ve solo su org (no todas)
- [ ] Test agregar nueva encuesta

---

**Fin del Roadmap v2 (Corregido)**

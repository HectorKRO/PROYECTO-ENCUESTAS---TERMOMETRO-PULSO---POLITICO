# 🗺️ Roadmap — Arquitectura Multi-Municipio

**Estrategia:** Híbrido 1 + 3 (Separación por función + RLS multi-tenant)
**Versión objetivo:** v3.0.0
**Duración estimada:** 2-3 semanas
**Complejidad:** Media-Alta

---

## 📊 Visión General

### Objetivo
Transformar PulsoElectoral de "Sistema para Atlixco" a "Plataforma SaaS para cualquier municipio de Puebla (y eventualmente otros estados)".

### Arquitectura Objetivo

```
┌─────────────────────────────────────────────────────────────────┐
│                    PULSOELECTORAL v3.0                          │
│                      (Multi-Municipio)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Atlixco     │    │ San Martín   │    │  Cholula     │      │
│  │  (0154-0221) │    │ (0230-0290)  │    │  (0300-0350) │      │
│  │              │    │              │    │              │      │
│  │  • 68 secc   │    │  • 60 secc   │    │  • 50 secc   │      │
│  │  • 417 col   │    │  • 380 col   │    │  • 320 col   │      │
│  │  • 3 camp    │    │  • 2 camp    │    │  • 4 camp    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             ▼                                   │
│              ┌─────────────────────────────┐                   │
│              │   Tablas Unificadas         │                   │
│              │   (con municipio_id)        │                   │
│              │                             │                   │
│              │  • respuestas               │                   │
│              │  • campanas                 │                   │
│              │  • secciones_electorales    │                   │
│              │  • colonias                 │                   │
│              └─────────────────────────────┘                   │
│                             │                                   │
│                             ▼                                   │
│              ┌─────────────────────────────┐                   │
│              │   RLS Policies              │                   │
│              │   (aislamiento por org)     │                   │
│              └─────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Fases del Roadmap

### FASE 0: Preparación (Día 1)

**Objetivo:** Asegurar que la v2.5.2 está estable antes de migrar.

#### Checklist
- [ ] Verificar que v2.5.2 funciona en producción
- [ ] Backup completo de base de datos
- [ ] Crear ambiente de staging para pruebas
- [ ] Documentar datos actuales (cuántas encuestas, campañas, etc.)

#### Entregable
- ✅ BD de staging lista
- ✅ Plan de rollback documentado

---

### FASE 1: Catálogo Geográfico (Días 2-4)

**Objetivo:** Crear estructura de catálogos geográficos independiente de datos de campaña.

> **⚠️ DECISIÓN DE DISEÑO — PK de `secciones_electorales`**
>
> Los números de sección INE son únicos dentro de cada estado en México. Todos los municipios
> de Puebla tienen rangos distintos (Atlixco: 0154-0221, San Martín: 0230+, etc.).
> Por lo tanto **NO se cambia la PK** de `secciones_electorales` a compuesta.
> Se agrega `municipio_id` como columna regular con FK e índice. Esto evita
> cascada de FKs rotas en `colonias` y `respuestas`, y simplifica toda la migración.
>
> Si en el futuro se expande a múltiples estados (donde sí habría colisión de
> números de sección), se podrá agregar `UNIQUE(seccion, municipio_id)` como
> constraint y convertir la PK en ese momento.

#### 1.1 Crear Tablas de Catálogo

**Archivo:** `sql/v3.0/01_catalogo_geografico.sql`

```sql
-- ============================================
-- CATÁLOGO GEOGRÁFICO NACIONAL
-- ============================================

CREATE TABLE estados (
  id     SMALLINT PRIMARY KEY,
  nombre TEXT NOT NULL,
  abrev  TEXT UNIQUE NOT NULL,  -- 'PUE', 'CDMX', 'VER'
  activo BOOLEAN DEFAULT true
);

INSERT INTO estados (id, nombre, abrev) VALUES
  (21, 'Puebla', 'PUE'),
  (29, 'Tlaxcala', 'TLAX')  -- Expansión futura
ON CONFLICT (id) DO NOTHING;

CREATE TABLE municipios (
  id               SMALLINT PRIMARY KEY,
  estado_id        SMALLINT REFERENCES estados(id),
  nombre           TEXT NOT NULL,
  cabecera         TEXT,
  distrito_fed     INT,
  latitud_centro   DECIMAL(10,8),
  longitud_centro  DECIMAL(11,8),
  geojson_limite   JSONB,
  activo           BOOLEAN DEFAULT true,
  UNIQUE(estado_id, nombre)
);

-- Atlixco como municipio #1 (municipio existente en producción)
INSERT INTO municipios (id, estado_id, nombre, cabecera, distrito_fed, latitud_centro, longitud_centro)
VALUES (1, 21, 'Atlixco', 'Atlixco, Puebla', 13, 18.9088, -98.4321)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE '✓ Tablas estados y municipios creadas. Atlixco = municipio 1.';
END $$;
```

#### 1.2 Migrar Secciones Actuales

**Archivo:** `sql/v3.0/02_migrar_secciones_existentes.sql`

> ✅ NO se cambia la PK. Solo se agrega `municipio_id` como columna de enriquecimiento.
> Las FKs existentes en `colonias` y `respuestas` no se tocan.

```sql
-- Prerequisito: 01_catalogo_geografico.sql debe haberse ejecutado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'municipios') THEN
    RAISE EXCEPTION 'Prerequisito faltante: ejecutar 01_catalogo_geografico.sql primero.';
  END IF;
END $$;

-- Agregar municipio_id como columna regular (NO cambia la PK)
ALTER TABLE secciones_electorales
  ADD COLUMN IF NOT EXISTS municipio_id SMALLINT REFERENCES municipios(id);

-- Asignar todas las secciones existentes a Atlixco (municipio 1)
UPDATE secciones_electorales
  SET municipio_id = 1
  WHERE municipio_id IS NULL;

-- Hacer obligatorio
ALTER TABLE secciones_electorales
  ALTER COLUMN municipio_id SET NOT NULL;

-- Índice para queries por municipio (no es PK, pero sí filtro frecuente)
CREATE INDEX IF NOT EXISTS idx_secciones_municipio
  ON secciones_electorales(municipio_id);

DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM secciones_electorales WHERE municipio_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'MIGRACIÓN INCOMPLETA: % secciones sin municipio_id.', v_count;
  END IF;
  RAISE NOTICE '✓ secciones_electorales.municipio_id OK. PK sin cambios.';
END $$;
```

#### 1.3 Migrar Colonias Actuales

**Archivo:** `sql/v3.0/03_migrar_colonias_existentes.sql`

> ✅ La FK `colonias.seccion_id → secciones_electorales(seccion)` NO se toca.
> Solo se agrega `municipio_id` como columna de enriquecimiento.

```sql
-- Prerequisito
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'secciones_electorales' AND column_name = 'municipio_id'
  ) THEN
    RAISE EXCEPTION 'Prerequisito faltante: ejecutar 02_migrar_secciones_existentes.sql primero.';
  END IF;
END $$;

-- Agregar municipio_id a colonias (columna regular, no cambia FK existente)
ALTER TABLE colonias
  ADD COLUMN IF NOT EXISTS municipio_id SMALLINT REFERENCES municipios(id);

-- Poblar desde la sección electoral (la sección ya sabe su municipio)
UPDATE colonias co
  SET municipio_id = se.municipio_id
  FROM secciones_electorales se
  WHERE co.seccion_id = se.seccion
    AND co.municipio_id IS NULL;

-- Hacer obligatorio
ALTER TABLE colonias
  ALTER COLUMN municipio_id SET NOT NULL;

-- Índice para queries por municipio
CREATE INDEX IF NOT EXISTS idx_colonias_municipio
  ON colonias(municipio_id);

DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM colonias WHERE municipio_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'MIGRACIÓN INCOMPLETA: % colonias sin municipio_id.', v_count;
  END IF;
  RAISE NOTICE '✓ colonias.municipio_id OK. FK seccion_id sin cambios.';
END $$;
```

#### Entregables Fase 1
- ✅ Tablas `estados` y `municipios` creadas
- ✅ `secciones_electorales` con `municipio_id` (PK sin cambios)
- ✅ `colonias` con `municipio_id` (FK sin cambios)
- ✅ Datos de Atlixco migrados y validados

---

### FASE 2: Multi-Tenancy Organizacional (Días 5-7)

**Objetivo:** Separar clientes/organizaciones para que cada una vea solo sus datos.

#### 2.1 Tablas de Organización

**Archivo:** `sql/v3.0/04_organizaciones.sql`

```sql
-- ============================================
-- MULTI-TENANCY: ORGANIZACIONES
-- ============================================

CREATE TABLE organizaciones (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               TEXT NOT NULL,
  tipo                 TEXT CHECK (tipo IN ('partido','consultora','candidato','gobierno','ong')),
  plan                 TEXT DEFAULT 'basico' CHECK (plan IN ('basico','profesional','enterprise')),
  contacto_email       TEXT,
  contacto_telefono    TEXT,
  limite_municipios    INT DEFAULT 1,
  limite_campanas      INT DEFAULT 3,
  limite_encuestadores INT DEFAULT 10,
  activa               BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- Membresía usuarios-organización
CREATE TABLE organizacion_miembros (
  organizacion_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rol             TEXT CHECK (rol IN ('superadmin','admin','analista','encuestador')),
  activo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (organizacion_id, user_id)
);

-- Acceso a municipios por organización
CREATE TABLE organizacion_municipios (
  organizacion_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  municipio_id    SMALLINT REFERENCES municipios(id) ON DELETE CASCADE,
  fecha_inicio    DATE DEFAULT CURRENT_DATE,
  fecha_fin       DATE,
  PRIMARY KEY (organizacion_id, municipio_id)
);

-- RLS para nuevas tablas
ALTER TABLE organizaciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizacion_miembros   ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizacion_municipios ENABLE ROW LEVEL SECURITY;

-- Usuarios ven solo su organización
CREATE POLICY "org_ver_propia" ON organizaciones
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT organizacion_id FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Usuarios ven solo sus membresías
CREATE POLICY "miembros_ver_propios" ON organizacion_miembros
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins ven membresías de su org
CREATE POLICY "admin_ver_miembros_org" ON organizacion_miembros
  FOR SELECT TO authenticated
  USING (
    organizacion_id IN (
      SELECT organizacion_id FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true AND rol IN ('admin','superadmin')
    )
  );

-- Municipios visibles por la organización
CREATE POLICY "org_ver_sus_municipios" ON organizacion_municipios
  FOR SELECT TO authenticated
  USING (
    organizacion_id IN (
      SELECT organizacion_id FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DO $$
BEGIN
  RAISE NOTICE '✓ Tablas de organización creadas con RLS.';
END $$;
```

#### 2.2 Migrar Datos Existentes

**Archivo:** `sql/v3.0/05_migrar_a_organizacion.sql`

```sql
-- Prerequisito
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizaciones') THEN
    RAISE EXCEPTION 'Prerequisito faltante: ejecutar 04_organizaciones.sql primero.';
  END IF;
END $$;

-- Crear organización por defecto para datos legacy de Atlixco
INSERT INTO organizaciones (
  id, nombre, tipo, plan, limite_municipios, activa
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Organización Atlixco (Legacy)',
  'candidato',
  'enterprise',
  10,
  true
) ON CONFLICT (id) DO NOTHING;

-- Asignar acceso a Atlixco
INSERT INTO organizacion_municipios (organizacion_id, municipio_id)
  VALUES ('00000000-0000-0000-0000-000000000001', 1)
  ON CONFLICT (organizacion_id, municipio_id) DO NOTHING;

-- Agregar organizacion_id a campanas
ALTER TABLE campanas
  ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);

UPDATE campanas
  SET organizacion_id = '00000000-0000-0000-0000-000000000001'
  WHERE organizacion_id IS NULL;

ALTER TABLE campanas
  ALTER COLUMN organizacion_id SET NOT NULL;

DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM campanas WHERE organizacion_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'MIGRACIÓN INCOMPLETA: % campanas sin organizacion_id.', v_count;
  END IF;
  RAISE NOTICE '✓ campanas.organizacion_id OK.';
END $$;
```

#### Entregables Fase 2
- ✅ Sistema de organizaciones funcionando con RLS
- ✅ Datos legacy asignados a org por defecto
- ✅ Campañas vinculadas a organizaciones

---

### FASE 3: Vincular Respuestas a Contexto Geográfico (Días 8-10)

**Objetivo:** Todas las respuestas y campañas saben a qué municipio y organización pertenecen.

#### 3.1 Agregar Contexto a Campañas y Respuestas

**Archivo:** `sql/v3.0/06_respuestas_contexto.sql`

> ⚠️ **ORDEN CRÍTICO**: campanas debe recibir `municipio_id` ANTES de que respuestas
> intente leerlo en el UPDATE. El orden incorrecto genera error de columna inexistente.

```sql
-- Prerequisitos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campanas' AND column_name = 'organizacion_id'
  ) THEN
    RAISE EXCEPTION 'Prerequisito faltante: ejecutar 05_migrar_a_organizacion.sql primero.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'municipios') THEN
    RAISE EXCEPTION 'Prerequisito faltante: ejecutar 01_catalogo_geografico.sql primero.';
  END IF;
END $$;

-- PASO 1: Agregar municipio_id a campanas PRIMERO
ALTER TABLE campanas
  ADD COLUMN IF NOT EXISTS municipio_id SMALLINT REFERENCES municipios(id);

-- PASO 2: Poblar campanas (todos los datos legacy son de Atlixco)
UPDATE campanas
  SET municipio_id = 1
  WHERE municipio_id IS NULL;

ALTER TABLE campanas
  ALTER COLUMN municipio_id SET NOT NULL;

-- PASO 3: Agregar columnas a respuestas (ahora campanas ya tiene municipio_id)
ALTER TABLE respuestas
  ADD COLUMN IF NOT EXISTS municipio_id    SMALLINT REFERENCES municipios(id),
  ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);

-- PASO 4: Poblar respuestas via JOIN con campanas (que ya tiene ambas columnas)
UPDATE respuestas r
SET
  organizacion_id = c.organizacion_id,
  municipio_id    = c.municipio_id
FROM campanas c
WHERE r.campana_id = c.id
  AND (r.organizacion_id IS NULL OR r.municipio_id IS NULL);

-- PASO 5: Índices para queries multi-municipio
CREATE INDEX IF NOT EXISTS idx_respuestas_municipio
  ON respuestas(municipio_id, campana_id);

CREATE INDEX IF NOT EXISTS idx_respuestas_organizacion
  ON respuestas(organizacion_id, created_at);

-- PASO 6: Validación post-migración (falla si quedan NULLs)
DO $$
DECLARE v_resp INT; v_camp INT;
BEGIN
  SELECT COUNT(*) INTO v_resp
    FROM respuestas
    WHERE completada = true AND (municipio_id IS NULL OR organizacion_id IS NULL);
  SELECT COUNT(*) INTO v_camp
    FROM campanas
    WHERE municipio_id IS NULL OR organizacion_id IS NULL;

  IF v_resp > 0 OR v_camp > 0 THEN
    RAISE EXCEPTION
      'MIGRACIÓN INCOMPLETA: % respuestas y % campañas sin contexto geográfico.',
      v_resp, v_camp;
  END IF;
  RAISE NOTICE '✓ Contexto geográfico completo. Respuestas y campañas OK.';
END $$;
```

#### Entregables Fase 3
- ✅ `campanas.municipio_id` poblado antes de usarlo en respuestas
- ✅ Todas las respuestas tienen `municipio_id` y `organizacion_id`
- ✅ Índices optimizados para queries multi-municipio
- ✅ Validación que falla si quedan NULLs (rollback claro)

---

### FASE 4: Row-Level Security (RLS) Multi-Capas (Días 11-13)

**Objetivo:** Seguridad a nivel de BD: usuarios solo ven datos de su organización y municipio asignado.

> ⚠️ **COMPORTAMIENTO DE RLS EN POSTGRESQL**: Múltiples políticas permissive (`FOR ALL`)
> sobre la misma tabla se combinan con **OR** (basta que una pase). Para lograr **AND**
> (la restricción de org Y la de municipio deben cumplirse simultáneamente), se usa
> **una sola política** que combina ambas condiciones, o políticas `AS RESTRICTIVE`.
>
> El diseño original tenía dos políticas separadas (07 y 08) que resultaban en OR,
> permitiendo que un usuario con acceso de org omitiera la restricción de municipio.
> Esta versión corregida usa una sola política que garantiza AND.

#### 4.1 Reemplazar Políticas Existentes y Agregar Aislamiento Organizacional

**Archivo:** `sql/v3.0/07_rls_organizacion.sql`

```sql
-- ============================================
-- RLS MULTI-CAPA: ORG + MUNICIPIO (política única)
-- ============================================

-- PASO 1: Eliminar políticas existentes de v2.x antes de agregar las nuevas.
-- Las políticas v2.x usan candidato_id/encuestador_id como identidad.
-- Las v3.0 usan organizacion_id. Las dos no deben coexistir.
DROP POLICY IF EXISTS "encuesta_publica_insertar"     ON respuestas;
DROP POLICY IF EXISTS "encuestador_insertar"           ON respuestas;
DROP POLICY IF EXISTS "encuestador_ver_su_campana"     ON respuestas;
DROP POLICY IF EXISTS "candidato_ver_sus_campanas"     ON respuestas;
DROP POLICY IF EXISTS "candidato_ver_campanas"         ON campanas;

-- PASO 2: Política de INSERT para encuesta pública (anon) — incluye guard de org activa
CREATE POLICY "encuesta_publica_insertar_v3" ON respuestas
  FOR INSERT TO anon
  WITH CHECK (
    campana_id IN (
      SELECT id FROM campanas
      WHERE activa = true AND organizacion_id IS NOT NULL
    )
    AND (duracion_segundos IS NULL OR duracion_segundos >= 45)
  );

-- PASO 3: Política única para authenticated — AND entre org y municipio
--
-- Lógica:
--   - El usuario debe pertenecer a la organización de la fila (org isolation)
--   - Y debe tener acceso al municipio de la fila, a menos que sea admin/superadmin de la org
--
CREATE POLICY "respuestas_org_y_municipio" ON respuestas
  FOR ALL TO authenticated
  USING (
    -- Condición 1: misma organización
    organizacion_id IN (
      SELECT organizacion_id FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
    AND
    -- Condición 2: tiene acceso al municipio O es admin/superadmin de esa org
    (
      municipio_id IN (
        SELECT omu.municipio_id
        FROM organizacion_miembros om
        JOIN organizacion_municipios omu ON om.organizacion_id = omu.organizacion_id
        WHERE om.user_id = auth.uid() AND om.activo = true
      )
      OR
      EXISTS (
        SELECT 1 FROM organizacion_miembros
        WHERE user_id = auth.uid()
          AND activo = true
          AND rol IN ('admin', 'superadmin')
          AND organizacion_id = respuestas.organizacion_id  -- Acotado al org de la fila
      )
    )
  )
  WITH CHECK (
    -- Al insertar/actualizar, misma lógica
    organizacion_id IN (
      SELECT organizacion_id FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- PASO 4: Política en campanas (misma lógica de organización)
DROP POLICY IF EXISTS "campanas_org_isolation" ON campanas;
CREATE POLICY "campanas_org_isolation" ON campanas
  FOR ALL TO authenticated
  USING (
    organizacion_id IN (
      SELECT organizacion_id FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- PASO 5: INSERT para encuestadores autenticados (v3 — valida org)
CREATE POLICY "encuestador_insertar_v3" ON respuestas
  FOR INSERT TO authenticated
  WITH CHECK (
    campana_id IN (
      SELECT e.campana_id FROM encuestadores e
      WHERE e.auth_user_id = auth.uid() AND e.activo = true
    )
    AND organizacion_id IN (
      SELECT organizacion_id FROM organizacion_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DO $$
BEGIN
  RAISE NOTICE '✓ RLS v3.0 aplicado. Políticas v2.x eliminadas.';
  RAISE NOTICE '  Política única con AND (org + municipio) activa.';
END $$;
```

> **Nota:** El archivo `08_rls_municipio.sql` del diseño original se eliminó.
> La restricción de municipio está integrada en la política `respuestas_org_y_municipio`
> del script 07, garantizando semántica AND (no OR).

#### Entregables Fase 4
- ✅ Políticas v2.x eliminadas y reemplazadas (no coexisten con v3.x)
- ✅ Una sola política por tabla con lógica AND (org + municipio)
- ✅ INSERT público actualizado para validar organizacion_id
- ✅ RLS en nuevas tablas (organizaciones, miembros, municipios — en script 04)
- ✅ Superadmin acotado a su propia organización (no cross-org)

---

### FASE 5: Vistas Comparativas (Días 14-16)

**Objetivo:** Permitir comparar métricas entre municipios y campañas.

#### 5.1 Vistas Unificadas

**Archivo:** `sql/v3.0/09_vistas_multi_municipio.sql`

```sql
-- ============================================
-- VISTAS MULTI-MUNICIPIO
-- ============================================

-- Vista: KPIs agregados por municipio
DROP VIEW IF EXISTS v_kpis_por_municipio;
CREATE VIEW v_kpis_por_municipio AS
SELECT
  m.id                 AS municipio_id,
  m.nombre             AS municipio_nombre,
  r.organizacion_id,
  COUNT(*)             AS total_encuestas,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce'))
    / NULLIF(COUNT(*),0), 1) AS pct_reconocimiento,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4)
    / NULLIF(COUNT(*),0), 1) AS pct_intencion,
  COUNT(DISTINCT r.campana_id) AS total_campanas
FROM respuestas r
JOIN municipios m ON r.municipio_id = m.id
WHERE r.completada = true AND r.deleted_at IS NULL
GROUP BY m.id, m.nombre, r.organizacion_id;


-- Vista: Métricas por campaña (base para comparaciones)
-- ⚠️ NOTA: No hace cross-join automático. El frontend elige qué dos campañas comparar.
-- Usar esta vista para obtener métricas de cada campaña y comparar en la capa de aplicación.
DROP VIEW IF EXISTS v_metricas_por_campana;
CREATE VIEW v_metricas_por_campana AS
SELECT
  c.id              AS campana_id,
  c.nombre          AS campana_nombre,
  c.municipio_id,
  m.nombre          AS municipio_nombre,
  c.organizacion_id,
  COUNT(r.id)       AS total_encuestas,
  ROUND(AVG(r.intencion_voto)::numeric, 2)                                              AS intencion_promedio,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(r.id),0), 1) AS pct_intencion_positiva,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce'))
    / NULLIF(COUNT(r.id),0), 1)                                                         AS pct_reconocimiento
FROM campanas c
JOIN municipios m ON c.municipio_id = m.id
LEFT JOIN respuestas r ON r.campana_id = c.id AND r.completada = true AND r.deleted_at IS NULL
WHERE c.activa = true
GROUP BY c.id, c.nombre, c.municipio_id, m.nombre, c.organizacion_id;

-- Si se requiere la vista de comparación por pares en SQL (con cross-join explícito),
-- usarla con precaución: con N campañas genera N×(N-1) filas.
-- Se recomienda hacer la comparación en el frontend usando v_metricas_por_campana.


-- Vista: Ranking de secciones con contexto de municipio
DROP VIEW IF EXISTS v_ranking_secciones_multi;
CREATE VIEW v_ranking_secciones_multi AS
SELECT
  r.municipio_id,
  m.nombre                                                                  AS municipio_nombre,
  r.seccion_id,
  se.nombre_zona,
  COUNT(*)                                                                  AS total_encuestas,
  ROUND(AVG(r.intencion_voto)::numeric, 2)                                  AS intencion_promedio,
  RANK() OVER (PARTITION BY r.municipio_id ORDER BY AVG(r.intencion_voto) DESC) AS ranking_municipio,
  RANK() OVER (ORDER BY AVG(r.intencion_voto) DESC)                         AS ranking_global
FROM respuestas r
JOIN municipios m             ON r.municipio_id = m.id
-- JOIN por seccion_id + municipio_id para evitar ambigüedad si en el futuro
-- hubiera secciones con el mismo número en diferentes estados
JOIN secciones_electorales se ON r.seccion_id = se.seccion
                              AND se.municipio_id = r.municipio_id
WHERE r.completada = true AND r.deleted_at IS NULL
GROUP BY r.municipio_id, m.nombre, r.seccion_id, se.nombre_zona;
```

#### Entregables Fase 5
- ✅ `v_metricas_por_campana` en lugar de cross-join automático
- ✅ `v_kpis_por_municipio` agregado por municipio
- ✅ `v_ranking_secciones_multi` con JOIN correcto
- ✅ Comparación por pares delegada al frontend (evita explosión cartesiana)

---

### FASE 6: Template para Nuevo Municipio (Día 17)

**Objetivo:** Proceso documentado para agregar San Martín Texmelucan (o cualquier otro municipio).

#### 6.1 Script Template

**Archivo:** `sql/v3.0/10_agregar_municipio_template.sql`

```sql
-- ============================================
-- AGREGAR NUEVO MUNICIPIO — TEMPLATE
-- ============================================
-- Instrucciones:
-- 1. Reemplazar los valores de @MUNICIPIO_ID, @MUNICIPIO_NOMBRE, etc.
-- 2. Agregar secciones electorales del municipio
-- 3. Ejecutar en orden dentro de una transacción
-- ============================================

BEGIN;

-- PASO 1: Insertar municipio
INSERT INTO municipios (id, estado_id, nombre, cabecera, distrito_fed, latitud_centro, longitud_centro)
VALUES
  (2, 21, 'San Martín Texmelucan', 'San Martín Texmelucan, Puebla', 12, 19.2846, -98.4381)
ON CONFLICT (id) DO NOTHING;

-- PASO 2: Insertar secciones electorales
-- seccion TEXT es único dentro de Puebla — no hay colisión con Atlixco (0154-0221)
INSERT INTO secciones_electorales (seccion, municipio_id, nombre_zona, tipo, lista_nominal, latitud_centro, longitud_centro)
VALUES
  ('0291', 2, 'Centro',      'urbana', 2800, 19.2846, -98.4381),
  ('0292', 2, 'San Rafael',  'urbana', 2500, 19.2900, -98.4400),
  ('0293', 2, 'Santiago',    'mixta',  1800, 19.2800, -98.4300)
  -- ... agregar todas las secciones del municipio
ON CONFLICT (seccion) DO NOTHING;
-- ON CONFLICT solo necesita la PK simple (seccion), no compuesta

-- PASO 3: Seed de colonias (generado desde CSV/Excel del INE)
-- Ejecutar seed_colonias_[municipio].sql aquí o via \i
-- Ej: INSERT INTO colonias (nombre, seccion_id, municipio_id, tipo, codigo_postal) VALUES (...)
-- ON CONFLICT (nombre, seccion_id) DO NOTHING;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✓ Municipio San Martín Texmelucan agregado.';
END $$;
```

#### Entregables Fase 6
- ✅ Template reutilizable con `BEGIN/COMMIT` para rollback automático si algo falla
- ✅ `ON CONFLICT (seccion)` — usa la PK simple, no una compuesta inexistente
- ✅ Secciones se insertan con `municipio_id` explícito
- ✅ Documentación del proceso de seed de colonias

---

### FASE 7: Frontend Adaptaciones (Días 18-21)

**Objetivo:** UI/UX para seleccionar municipio y ver comparativas.

#### 7.1 Cambios Necesarios en Frontend

| Componente | Cambio | Complejidad |
|------------|--------|-------------|
| `WarRoom.jsx` | Selector de municipio, comparación inter-municipios | Media |
| `DashboardPolitico.jsx` | Filtro por municipio, vista consolidada | Baja |
| `AdminPanel.jsx` | Gestión de acceso a municipios por org | Media |
| `FormularioEncuesta.jsx` | Secciones filtradas por municipio seleccionado | Baja |
| Login/Auth | Selección de organización y municipio al iniciar | Media |

#### 7.2 Ejemplo de Cambio

```javascript
// Nuevo hook: useOrganizacion.js
export function useOrganizacion() {
  const [municipios, setMunicipios] = useState([]);
  const [municipioActual, setMunicipioActual] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sesión antes de consultar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setLoading(false);
        return;
      }

      supabase
        .from('organizacion_municipios')
        .select('municipio_id, municipios(nombre)')
        .then(({ data, error }) => {
          if (error) {
            console.error('[useOrganizacion] Error:', error);
          } else {
            setMunicipios(data || []);
            if (data?.length > 0 && !municipioActual) {
              setMunicipioActual(data[0].municipio_id);
            }
          }
          setLoading(false);
        });
    });
  }, []);

  return { municipios, municipioActual, setMunicipioActual, loading };
}
```

#### Entregables Fase 7
- ✅ Selector de municipio con manejo de auth state
- ✅ Comparación inter-municipios usando `v_metricas_por_campana`
- ✅ Filtros aplicados correctamente en todos los componentes

---

## 📋 Resumen de Entregables por Fase

| Fase | Días | Archivos SQL | Cambios Frontend | Estado |
|------|------|--------------|------------------|--------|
| 0 | 1 | — | — | Preparación |
| 1 | 3 | 3 | — | Catálogo geográfico |
| 2 | 3 | 2 | — | Organizaciones |
| 3 | 3 | 1 | — | Contexto en respuestas |
| 4 | 3 | 1 (fusionado) | — | RLS |
| 5 | 3 | 1 | — | Vistas comparativas |
| 6 | 1 | 1 | — | Template municipio |
| 7 | 4 | — | 4-5 componentes | Frontend |
| **Total** | **21** | **9 archivos** | **4-5 archivos** | **v3.0** |

---

## 🎯 Checklist de Verificación Final

### Funcionalidad
- [ ] Usuario de Org A no ve datos de Org B
- [ ] Usuario puede seleccionar municipio
- [ ] War Room muestra mapa del municipio seleccionado
- [ ] Comparación campaña vs campaña funciona usando `v_metricas_por_campana`
- [ ] Agregar nuevo municipio toma < 30 minutos usando el template

### Seguridad
- [ ] RLS policies testeadas con usuarios reales (3 roles: encuestador, analista, admin)
- [ ] No hay data leakage entre organizaciones
- [ ] Admin de Org A no puede ver datos de Org B (ni con superadmin)
- [ ] Encuestador solo ve su municipio asignado

### Performance
- [ ] Índices utilizados en queries (EXPLAIN ANALYZE)
- [ ] War Room carga en < 3 segundos
- [ ] Dashboard con 3+ municipios responde bien

---

## 🚨 Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Migración de datos falla | Media | Alto | Backup completo + scripts con RAISE EXCEPTION si quedan NULLs |
| RLS demasiado restrictivo | Media | Medio | Tests con usuarios reales en staging antes de producción |
| Queries lentos | Baja | Medio | Índices compuestos en municipio_id, EXPLAIN ANALYZE |
| Conflicto con políticas RLS v2.x | Alta (si no se eliminan) | Alto | Script 07 hace DROP explícito de todas las políticas anteriores |
| Frontend complejo | Media | Medio | Hooks reutilizables + `v_metricas_por_campana` simplifica comparaciones |
| Datos geográficos incorrectos | Baja | Alto | Validación con cartografía INE oficial |

---

## 📝 Notas de Implementación

### Orden de Ejecución en Producción

```bash
# 1. Backup OBLIGATORIO antes de cualquier migración
# En Supabase: Dashboard → Database → Backups → Create backup

# 2. Ejecutar en orden estricto (cada script valida el prerequisito anterior)
# Fase 1
01_catalogo_geografico.sql
02_migrar_secciones_existentes.sql
03_migrar_colonias_existentes.sql

# Fase 2
04_organizaciones.sql
05_migrar_a_organizacion.sql

# Fase 3
06_respuestas_contexto.sql

# Fase 4
07_rls_organizacion.sql
# NOTA: 08_rls_municipio.sql eliminado — fusionado en 07

# Fase 5
09_vistas_multi_municipio.sql

# 3. Verificaciones post-migración
SELECT COUNT(*) FROM respuestas WHERE municipio_id IS NULL;     -- debe ser 0
SELECT COUNT(*) FROM campanas  WHERE municipio_id IS NULL;     -- debe ser 0
SELECT COUNT(*) FROM secciones_electorales WHERE municipio_id IS NULL; -- debe ser 0
```

### Rollback Plan

```sql
-- Si algo falla, restaurar desde backup (Supabase Dashboard)
-- Los scripts usan RAISE EXCEPTION para abortar automáticamente si detectan NULLs

-- Para rollback manual de la Fase 1 (si se aplicó parcialmente):
ALTER TABLE secciones_electorales DROP COLUMN IF EXISTS municipio_id;
ALTER TABLE colonias              DROP COLUMN IF EXISTS municipio_id;
DROP TABLE IF EXISTS municipios;
DROP TABLE IF EXISTS estados;
```

### Cambios vs Versión Original del Roadmap

| Sección | Cambio | Razón |
|---------|--------|-------|
| Fase 1 | PK de secciones NO cambia | INE garantiza unicidad dentro del estado; evita cascada de FKs |
| Fase 1 (03) | FK de colonias NO se hace compuesta | Innecesario si la PK no cambia |
| Fase 3 (06) | Orden de ALTER/UPDATE corregido | El UPDATE leía `campanas.municipio_id` antes de crearlo |
| Fase 3 (06) | Prerequisite guards agregados | Falla clara si scripts anteriores no corrieron |
| Fase 4 (07) | Políticas v2.x se eliminan explícitamente | Sin DROP, coexisten con OR y se anulan mutuamente |
| Fase 4 (07+08) | Fusionados en una sola política AND | Dos políticas FOR ALL = OR en PostgreSQL, no AND |
| Fase 4 (08) | Eliminado (fusionado en 07) | Ver fila anterior |
| Fase 4 | `get_current_organizacion()` eliminada | Código muerto: ninguna política la usaba |
| Fase 4 | Superadmin acotado por `organizacion_id` | Sin esto, superadmin de Org A veía datos de Org B |
| Fase 5 | `v_comparacion_campanas` reemplazada por `v_metricas_por_campana` | Cross-join N×(N-1) no escalable; comparación va al frontend |
| Fase 6 | `ON CONFLICT (seccion)` en lugar de `(seccion, municipio_id)` | PK sigue siendo simple |
| Fase 7 | Hook con guard de auth state | Sin sesión activa, query a RLS-protected table falla silenciosamente |

---

**Fin del Roadmap v3.0 (corregido)**

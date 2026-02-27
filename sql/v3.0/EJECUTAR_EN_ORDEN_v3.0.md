# 📋 Guía de Ejecución — Migración a v3.0 Multi-Municipio

**Fecha:** 2026-02-26  
**Versión:** v3.0 (Corregido post-revisión de 16 bugs)  
**Duración estimada:** 15-30 minutos

---

## ⚠️ PRECAUCIONES

1. **HACER BACKUP ANTES** — Esta migración modifica estructura crítica
2. **Ejecutar en Staging primero** — Nunca en producción sin probar
3. **No interrumpir** — Los scripts deben ejecutarse en orden completo
4. **Validar al final** — Siempre ejecutar `00_validate_migration.sql`

---

## 🔀 Orden de Ejecución

### FLUJO 1: Instalación Nueva (Base de datos vacía)

Si estás creando una BD desde cero para un nuevo cliente:

```sql
-- 0. Schema base v2.5.2 (prerrequisito)
\i ../schema.sql

-- 1. Catálogo geográfico (estados, municipios, secciones con municipio_id)
\i 01_catalogo_geografico.sql

-- 2. Organizaciones (multi-tenancy)
\i 02_organizaciones.sql

-- 3. Contexto en respuestas (campanas y respuestas con org/municipio)
\i 03_respuestas_contexto.sql

-- 4. RLS unificado (seguridad por organización)
\i 04_rls_unificado.sql

-- 5. Vistas corregidas (métricas sin cross-joins)
\i 05_vistas_corregidas.sql

-- 6. Seed de datos (Atlixco)
\i ../seed_colonias_atlixco.sql

-- 7. Validación
\i 00_validate_migration.sql

-- 8. Setup admin
\i ../setup_admin_user.sql
```

---

### FLUJO 2: Upgrade desde v2.5.2 (BD existente con datos)

**⚠️ Este es el flujo más común para migrar producción**

```sql
-- ============================================================
-- FASE A: Estructura (Obligatorio)
-- ============================================================

-- 1. Catálogo geográfico
--    Agrega: estados, municipios, municipio_id a secciones/colonias
\i 01_catalogo_geografico.sql

-- 2. Organizaciones
--    Agrega: tablas de org, miembros, acceso a municipios
--    Crea: organización legacy para datos existentes
\i 02_organizaciones.sql

-- 3. Contexto en respuestas
--    Agrega: organizacion_id y municipio_id a campanas y respuestas
--    Pobla: datos desde relaciones existentes
--    NOTA: Este script es crítico, verificar que no hay NULLs
\i 03_respuestas_contexto.sql

-- ============================================================
-- FASE B: Seguridad (Obligatorio)
-- ============================================================

-- 4. RLS unificado
--    Elimina: todas las políticas anteriores
--    Crea: nuevas políticas con AND explícito
\i 04_rls_unificado.sql

-- ============================================================
-- FASE C: Vistas (Obligatorio)
-- ============================================================

-- 5. Vistas corregidas
--    Elimina: v_comparacion_campanas (cross-join problemático)
--    Crea: v_metricas_por_campana, v_metricas_por_municipio, etc.
\i 05_vistas_corregidas.sql

-- ============================================================
-- FASE D: Validación (Obligatorio)
-- ============================================================

-- 6. Validación
--    Verifica: que no quedaron NULLs en columnas requeridas
--    Verifica: que existen políticas RLS
--    Verifica: que org legacy tiene acceso a Atlixco
\i 00_validate_migration.sql

-- ============================================================
-- FASE E: Datos de nuevos municipios (Opcional, cuando aplique)
-- ============================================================

-- 7. Agregar nuevo municipio (ejemplo: San Martín Texmelucan)
-- \i 06_template_nuevo_municipio.sql
-- \i seed_colonias_sanmartin.sql  -- Generado desde CSV

```

---

### FLUJO 3: Agregar Nuevo Municipio (Post-v3.0)

Cuando ya tienes v3.0 y quieres agregar otro municipio:

```sql
-- 1. Configurar y ejecutar template
--    Editar: municipio_id, nombre, coordenadas
--    Editar: lista de secciones del INE
\i 06_template_nuevo_municipio.sql

-- 2. Insertar colonias (generado desde Excel/CSV del INE)
--    Formato: INSERT INTO colonias (nombre, seccion_id, municipio_id, tipo, codigo_postal)
\i seed_colonias_nuevomun.sql

-- 3. (Opcional) Dar acceso a organización existente
INSERT INTO organizacion_municipios (organizacion_id, municipio_id)
VALUES ('uuid-de-la-org', 2);

-- 4. Validar
SELECT COUNT(*) as secciones FROM secciones_electorales WHERE municipio_id = 2;
SELECT COUNT(*) as colonias FROM colonias WHERE municipio_id = 2;
```

---

## 🧪 Tests Post-Migración

Ejecutar estos tests en Supabase SQL Editor para verificar:

### Test 1: Datos completos
```sql
-- Debe retornar 0 en todos
SELECT 
  (SELECT COUNT(*) FROM campanas WHERE organizacion_id IS NULL) as campanas_sin_org,
  (SELECT COUNT(*) FROM respuestas WHERE organizacion_id IS NULL) as respuestas_sin_org,
  (SELECT COUNT(*) FROM secciones_electorales WHERE municipio_id IS NULL) as secciones_sin_mun;
```

### Test 2: RLS funciona
```sql
-- Conectar como usuario anónimo (simulado)
-- Esta query debería retornar 0 resultados si RLS está activo
SET ROLE anon;
SELECT COUNT(*) FROM respuestas;
RESET ROLE;
```

### Test 3: Vistas nuevas
```sql
-- Debe retornar datos de Atlixco
SELECT * FROM v_metricas_por_municipio WHERE municipio_id = 1;

-- Debe retornar campanas con métricas
SELECT * FROM v_metricas_por_campana LIMIT 5;
```

### Test 4: Organización legacy
```sql
-- Debe retornar 1 fila con acceso a Atlixco
SELECT 
  o.id, o.nombre, om.municipio_id, m.nombre as municipio
FROM organizaciones o
JOIN organizacion_municipios om ON o.id = om.organizacion_id
JOIN municipios m ON om.municipio_id = m.id
WHERE o.id = '00000000-0000-0000-0000-000000000001';
```

---

## 🚨 Solución de Problemas

### Error: "Quedaron X respuestas sin organizacion_id"

**Causa:** Algunas respuestas no tienen campana_id válido

**Solución:**
```sql
-- Ver cuáles son
SELECT id, campana_id FROM respuestas WHERE campana_id NOT IN (SELECT id FROM campanas);

-- Si son de prueba, eliminarlas:
DELETE FROM respuestas WHERE campana_id NOT IN (SELECT id FROM campanas);

-- O asignarlas a campana default:
UPDATE respuestas SET campana_id = 'uuid-campana-default' WHERE campana_id IS NULL;
```

---

### Error: "ERROR: No se creó la organización legacy"

**Causa:** Script 02 no se ejecutó o falló silenciosamente

**Solución:**
```sql
-- Ejecutar manualmente:
INSERT INTO organizaciones (
  id, nombre, tipo, plan, limite_municipios, activa
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Organización Principal (Legacy)',
  'candidato', 'enterprise', 10, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO organizacion_municipios VALUES ('00000000-0000-0000-0000-000000000001', 1);
```

---

### Error: "violates row-level security policy"

**Causa:** Políticas antiguas coexisten con nuevas (OR implícito)

**Solución:**
```sql
-- Ver políticas existentes
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Eliminar todas las que no sean las nuevas:
DROP POLICY IF EXISTS "respuestas_org_isolation" ON respuestas;
DROP POLICY IF EXISTS "respuestas_municipio_restriction" ON respuestas;
-- etc...

-- Re-ejecutar script 04
\i 04_rls_unificado.sql
```

---

## 📊 Checklist Final

Antes de declarar la migración exitosa:

- [ ] `00_validate_migration.sql` pasa sin errores
- [ ] Login con usuario existente funciona
- [ ] Dashboard muestra datos de Atlixco
- [ ] War Room carga el mapa
- [ ] Agregar encuesta funciona (con organizacion_id asignado automáticamente)
- [ ] Superadmin ve solo su organización (no todas)
- [ ] Usuario regular no ve datos de otras organizaciones

---

## 📝 Notas de Implementación

### Tiempo estimado por fase

| Fase | Tiempo | Riesgo |
|------|--------|--------|
| 01 - Catálogo | 2 min | Bajo |
| 02 - Organizaciones | 2 min | Bajo |
| 03 - Contexto | 5-10 min | **Medio** (depende de volumen de datos) |
| 04 - RLS | 2 min | Medio |
| 05 - Vistas | 1 min | Bajo |
| 06 - Validación | 1 min | - |
| **Total** | **15-20 min** | - |

### Rollback (si algo falla)

```sql
-- Si la validación falla, estos son los cambios a revertir manualmente:

-- 1. Eliminar columnas agregadas (NO recomendado si ya hay datos nuevos)
-- ALTER TABLE respuestas DROP COLUMN organizacion_id, DROP COLUMN municipio_id;
-- ALTER TABLE campanas DROP COLUMN organizacion_id, DROP COLUMN municipio_id;

-- 2. Restaurar desde backup (recomendado)
-- pg_dump ... | psql ...
```

---

**Fin de la guía de ejecución**

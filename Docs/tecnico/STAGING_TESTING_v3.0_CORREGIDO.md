# 🧪 Staging y Testing v3.0 — CORREGIDO

**Versión:** v3.0 (Post-auditoría ST)  
**Fecha:** 2026-02-26  
**Estado:** Guía corregida para Supabase Cloud

---

## 📋 Correcciones Aplicadas (Audit ST)

| ID | Error Original | Corrección |
|----|----------------|------------|
| ST-1 | `\i` en SQL Editor (no funciona) | Copiar/pegar contenido o usar psql CLI |
| ST-2 | `pg_tables.rowsecurity` no existe | Usar `pg_class.relrowsecurity` |
| ST-3 | `dropdb/createdb` en Supabase Cloud | Usar Point-in-Time Recovery o Dashboard |
| ST-4 | Rollback B `WHERE NULL` inoperante | `DROP NOT NULL` primero o usar backup |
| ST-5 | Test por patrón `%municipio%` frágil | Verificar índices específicos por nombre |
| ST-6 | Falta test política `encuesta_publica_insertar` | Agregado test específico |
| ST-7 | `pg_dump --where` no existe | Usar método alternativo con COPY |

---

## 1. CREAR AMBIENTE DE STAGING

### Opción A: Proyecto Supabase Nuevo (Recomendado)

```bash
# En Supabase Dashboard:
# 1. "New Project" → "pulsoelectoral-staging"
# 2. Guardar credenciales
# 3. Configurar archivo local
```

**Archivo:** `.env.local.staging`

```env
NEXT_PUBLIC_SUPABASE_URL=https://staging-xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_ENV=staging
```

---

## 2. IMPORTAR A STAGING

### Método 1: SQL Editor (Copiar/Pegar)

✅ **ST-1 CORREGIDO:** No usar `\i`, copiar contenido directamente

1. Abrir Supabase Dashboard → SQL Editor
2. Crear "New Query"
3. Copiar contenido de `prod_schema_backup.sql`
4. Ejecutar
5. Repetir para datos (subset)

### Método 2: psql CLI (Si tienes acceso)

```bash
# Exportar desde producción
pg_dump --schema-only --no-owner --no-privileges \
  postgres://user:pass@db.prod.supabase.co:5432/postgres \
  > prod_schema.sql

# Importar a staging
psql postgres://user:pass@db.staging.supabase.co:5432/postgres \
  -f prod_schema.sql
```

### Método 3: Exportar Subset de Datos (ST-7 CORREGIDO)

✅ **ST-7 CORREGIDO:** `pg_dump --where` no existe, usar COPY

```bash
# Método correcto para exportar subset:
psql postgres://user:pass@db.prod.supabase.co:5432/postgres \
  -c "COPY (SELECT * FROM respuestas WHERE created_at > '2025-01-01') TO STDOUT CSV HEADER" \
  > respuestas_subset.csv

# Luego importar en staging:
psql postgres://user:pass@db.staging.supabase.co:5432/postgres \
  -c "COPY respuestas FROM STDIN CSV HEADER" \
  < respuestas_subset.csv
```

---

## 3. EJECUTAR MIGRACIÓN v3.0

### Orden de ejecución (misma secuencia)

```bash
# Ejecutar en SQL Editor uno por uno (copiar/pegar):

1. 01_catalogo_geografico.sql
2. 02_organizaciones.sql
3. 03_respuestas_contexto.sql
4. 04_rls_unificado.sql
5. 05_vistas_corregidas.sql
6. 00_validate_migration.sql
```

---

## 4. TESTS AUTOMATIZADOS (CORREGIDOS)

**Archivo:** `tests/v3.0_validate.sql`

```sql
-- ============================================================
-- TEST SUITE v3.0 (CORREGIDO)
-- ============================================================

DO $$
DECLARE
  v_passed INT := 0;
  v_failed INT := 0;
  v_count INT;
  v_test_name TEXT;
BEGIN
  RAISE NOTICE E'\n========================================';
  RAISE NOTICE 'TEST SUITE v3.0 CORREGIDO';
  RAISE NOTICE '========================================\n';

  -- T1: Estados y municipios
  v_test_name := 'T1: Estados y municipios';
  SELECT COUNT(*) INTO v_count FROM estados;
  IF v_count >= 1 THEN
    RAISE NOTICE '✅ % (%)', v_test_name, v_count;
    v_passed := v_passed + 1;
  ELSE
    RAISE NOTICE '❌ %', v_test_name;
    v_failed := v_failed + 1;
  END IF;

  -- T2: Municipio Atlixco
  v_test_name := 'T2: Municipio Atlixco';
  SELECT COUNT(*) INTO v_count FROM municipios WHERE id = 1;
  IF v_count = 1 THEN
    RAISE NOTICE '✅ %', v_test_name;
    v_passed := v_passed + 1;
  ELSE
    RAISE NOTICE '❌ %', v_test_name;
    v_failed := v_failed + 1;
  END IF;

  -- T3: Secciones con municipio_id
  v_test_name := 'T3: Secciones con municipio_id';
  SELECT COUNT(*) INTO v_count FROM secciones_electorales WHERE municipio_id IS NULL;
  IF v_count = 0 THEN
    RAISE NOTICE '✅ %', v_test_name;
    v_passed := v_passed + 1;
  ELSE
    RAISE NOTICE '❌ % - % sin municipio', v_test_name, v_count;
    v_failed := v_failed + 1;
  END IF;

  -- T4: Organización legacy
  v_test_name := 'T4: Organización legacy';
  SELECT COUNT(*) INTO v_count FROM organizaciones 
  WHERE id = '00000000-0000-0000-0000-000000000001';
  IF v_count = 1 THEN
    RAISE NOTICE '✅ %', v_test_name;
    v_passed := v_passed + 1;
  ELSE
    RAISE NOTICE '❌ %', v_test_name;
    v_failed := v_failed + 1;
  END IF;

  -- T5: Campanas con org
  v_test_name := 'T5: Campanas con organizacion_id';
  SELECT COUNT(*) INTO v_count FROM campanas WHERE organizacion_id IS NULL;
  IF v_count = 0 THEN
    RAISE NOTICE '✅ %', v_test_name;
    v_passed := v_passed + 1;
  ELSE
    RAISE NOTICE '❌ % - % campanas sin org', v_test_name, v_count;
    v_failed := v_failed + 1;
  END IF;

  -- T6: Respuestas con contexto
  v_test_name := 'T6: Respuestas con org y mun';
  SELECT COUNT(*) INTO v_count FROM respuestas 
  WHERE organizacion_id IS NULL OR municipio_id IS NULL;
  IF v_count = 0 THEN
    RAISE NOTICE '✅ %', v_test_name;
    v_passed := v_passed + 1;
  ELSE
    RAISE NOTICE '❌ % - % respuestas incompletas', v_test_name, v_count;
    v_failed := v_failed + 1;
  END IF;

  -- ✅ ST-2 CORREGIDO: Usar pg_class.relrowsecurity en lugar de pg_tables.rowsecurity
  v_test_name := 'T7: RLS activo en respuestas';
  SELECT COUNT(*) INTO v_count 
  FROM pg_class 
  WHERE relname = 'respuestas' AND relrowsecurity = true;
  IF v_count = 1 THEN
    RAISE NOTICE '✅ %', v_test_name;
    v_passed := v_passed + 1;
  ELSE
    RAISE NOTICE '❌ % - RLS no activo', v_test_name;
    v_failed := v_failed + 1;
  END IF;

  -- ✅ ST-6 CORREGIDO: Tests separados para políticas críticas
  v_test_name := 'T8: Política respuestas_isolation_completa';
  SELECT COUNT(*) INTO v_count 
  FROM pg_policies 
  WHERE tablename = 'respuestas' AND policyname = 'respuestas_isolation_completa';
  IF v_count = 1 THEN
    RAISE NOTICE '✅ %', v_test_name;
    v_passed := v_passed + 1;
  ELSE
    RAISE NOTICE '❌ %', v_test_name;
    v_failed := v_failed + 1;
  END IF;

  -- T8b: Política de inserción anónima (crítica para campo)
  v_test_name := 'T8b: Política encuesta_publica_insertar_v3';
  SELECT COUNT(*) INTO v_count 
  FROM pg_policies 
  WHERE tablename = 'respuestas' 
    AND policyname LIKE '%encuesta_publica%';
  IF v_count >= 1 THEN
    RAISE NOTICE '✅ % (%)', v_test_name, v_count;
    v_passed := v_passed + 1;
  ELSE
    RAISE NOTICE '⚠️ % - ENCUESTAS ANÓNIMAS PODRÍAN ESTAR BLOQUEADAS', v_test_name;
    v_failed := v_failed + 1;
  END IF;

  -- T9: Vista v_metricas_por_campana
  v_test_name := 'T9: Vista v_metricas_por_campana';
  SELECT COUNT(*) INTO v_count 
  FROM information_schema.views 
  WHERE table_name = 'v_metricas_por_campana';
  IF v_count = 1 THEN
    RAISE NOTICE '✅ %', v_test_name;
    v_passed := v_passed + 1;
  ELSE
    RAISE NOTICE '❌ %', v_test_name;
    v_failed := v_failed + 1;
  END IF;

  -- ✅ ST-5 CORREGIDO: Verificar índices específicos por nombre exacto
  v_test_name := 'T10: Índices específicos de municipio';
  SELECT COUNT(*) INTO v_count 
  FROM pg_indexes 
  WHERE indexname IN (
    'idx_secciones_municipio',
    'idx_colonias_municipio', 
    'idx_respuestas_municipio',
    'idx_campanas_municipio'
  );
  IF v_count >= 4 THEN
    RAISE NOTICE '✅ % (%/4)', v_test_name, v_count;
    v_passed := v_passed + 1;
  ELSE
    RAISE NOTICE '❌ % - Solo % de 4 índices', v_test_name, v_count;
    v_failed := v_failed + 1;
  END IF;

  -- RESUMEN
  RAISE NOTICE E'\n========================================';
  RAISE NOTICE 'RESULTADOS: % PASADOS, % FALLIDOS', v_passed, v_failed;
  RAISE NOTICE '========================================\n';

  IF v_failed > 0 THEN
    RAISE EXCEPTION 'TESTS FALLIDOS: %', v_failed;
  END IF;
END $$;
```

---

## 5. ROLLBACK PLAN (CORREGIDO)

### ✅ ST-3 CORREGIDO: Opción A — Point-in-Time Recovery (Supabase)

**Para Supabase Cloud (no funciona dropdb/createdb):**

1. Ir a Supabase Dashboard → Database → Backups
2. Click "Restore" en el backup pre-migración
3. Confirmar (esto restaura TODO el proyecto al estado anterior)

**Alternativa: Crear nuevo proyecto desde backup**

### ✅ ST-4 CORREGIDO: Opción B — Revertir Manual

```sql
-- Si necesitas revertir sin restaurar backup completo:
-- NOTA: Esto requiere que primero eliminemos las constraints NOT NULL

-- 1. Desactivar RLS temporalmente
ALTER TABLE respuestas DISABLE ROW LEVEL SECURITY;
ALTER TABLE campanas DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar columnas agregadas (opcional, destructivo)
-- ALTER TABLE respuestas DROP COLUMN organizacion_id;
-- ALTER TABLE respuestas DROP COLUMN municipio_id;

-- 3. O mejor: Mantener columnas con valores default para compatibilidad
UPDATE respuestas SET 
  organizacion_id = '00000000-0000-0000-0000-000000000001',
  municipio_id = 1;

-- 4. Recrear políticas v2.x (si se tienen guardadas)
-- ... scripts de políticas anteriores ...
```

**Recomendación:** Siempre usar Opción A (Restore from Backup) cuando sea posible.

---

## 6. CHECKLIST FINAL DE VALIDACIÓN

### Base de Datos
- [ ] `00_validate_migration.sql` pasa sin errores
- [ ] `tests/v3.0_validate.sql` pasa 11/11 tests (incluyendo T8b)
- [ ] No hay NULLs en columnas requeridas
- [ ] RLS activo: `SELECT relrowsecurity FROM pg_class WHERE relname = 'respuestas'` retorna `true`
- [ ] Políticas específicas existen (por nombre exacto)

### Seguridad
- [ ] Usuario A no ve datos de Usuario B (diferente org)
- [ ] Encuestador no ve panel de admin
- [ ] Anónimo puede insertar encuestas (política pública existe)
- [ ] Superadmin ve solo su org

### Performance
- [ ] Dashboard carga en <3 segundos
- [ ] War Room carga en <5 segundos
- [ ] Índices específicos creados (verificados por nombre)

---

## 7. GO/NO-GO CRITERIA

### ✅ GO (Aprobar deploy)
- Todos los tests pasan
- Performance aceptable
- Documentación actualizada
- Rollback plan probado (restaurar backup funciona)

### ❌ NO-GO (Posponer)
- Tests fallidos
- Data leakage detectado
- Performance degradada >100%
- No hay backup verificado

---

**Fin de documentación corregida**

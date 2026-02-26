# 📋 Guía de Instalación SQL - PulsoElectoral

## Orden de Ejecución

### Para Nuevas Instalaciones (Base de datos vacía)

Ejecutar en este orden:

```sql
1. schema.sql                    -- Crea todas las tablas y vistas
2. migracion_colonias_v2.4.sql   -- Inserta las 417 colonias
3. alertas_supabase.sql          -- Sistema de alertas (opcional)
```

### Para Base de Datos Existente (Actualización)

Si ya tienes una BD con datos y solo necesitas actualizar:

```sql
1. migracion_v2.4_fix_colonias.sql   -- Asegura que tablas/columnas existan
2. migracion_colonias_v2.4.sql       -- Inserta las 417 colonias
```

## Errores Comunes y Soluciones

### Error: `column r.colonia_id does not exist`

**Causa:** La tabla `respuestas` fue creada antes de la v2.4 sin la columna `colonia_id`.

**Solución:** Ejecutar `migracion_v2.4_fix_colonias.sql` primero.

```sql
-- En Supabase SQL Editor:
\i migracion_v2.4_fix_colonias.sql
```

### Error: `relation "colonias" does not exist`

**Causa:** La tabla `colonias` no existe. Puede pasar si:
- Se ejecutó `migracion_colonias_v2.4.sql` antes que `schema.sql`
- El schema.sql no se ejecutó completamente

**Solución:** Ejecutar `migracion_v2.4_fix_colonias.sql` primero, luego los datos.

### Error: `new row for relation "colonias" violates check constraint "colonias_tipo_check"`

**Causa:** El constraint de tipos tiene valores antiguos y no incluye todos los tipos del INE (como 'PUEBLO', 'HACIENDA', etc.).

**Solución:**
```sql
-- Opción 1: Script específico
\i sql/fix_colonias_tipo_constraint.sql

-- Opción 2: El script migracion_colonias_v2.4.sql ahora incluye el fix automáticamente
\i sql/migracion_colonias_v2.4.sql
```

### Error: `foreign key constraint "respuestas_colonia_id_fkey"`

**Causa:** Se está insertando una respuesta con `colonia_id` que no existe en la tabla `colonias`.

**Solución:** Verificar que:
1. La tabla `colonias` tiene datos (`SELECT COUNT(*) FROM colonias;` debe retornar 417)
2. El `colonia_id` en la respuesta existe en la tabla

## Verificación Post-Instalación

Ejecutar estas consultas para verificar:

```sql
-- 1. Verificar que la tabla colonias existe y tiene datos
SELECT COUNT(*) as total_colonias FROM colonias;
-- Debe retornar: 417

-- 2. Verificar que la columna colonia_id existe en respuestas
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='respuestas' AND column_name='colonia_id';
-- Debe retornar: colonia_id

-- 3. Verificar que la vista v_resultados_por_colonia funciona
SELECT COUNT(*) as total_registros 
FROM v_resultados_por_colonia 
WHERE campana_id IS NOT NULL;
-- Si hay datos, debe retornar > 0
```

## Estructura de Tablas v2.4

```
candidatos (1)
  └── campanas (N)
        ├── encuestadores (N)
        └── respuestas (N)
              ├── seccion_id → secciones_electorales
              └── colonia_id → colonias (NEW v2.4)

colonias (417 registros)
  └── seccion_id → secciones_electorales

secciones_electorales (68 registros)
```

## Notas Importantes

- La tabla `colonias` debe crearse ANTES de que `respuestas` pueda tener la columna `colonia_id` (FK)
- La migración `migracion_v2.4_fix_colonias.sql` es idempotente (puede ejecutarse múltiples veces sin error)
- Si tienes datos existentes en `respuestas`, la columna `colonia_id` se agregará como `NULL` (permitido)

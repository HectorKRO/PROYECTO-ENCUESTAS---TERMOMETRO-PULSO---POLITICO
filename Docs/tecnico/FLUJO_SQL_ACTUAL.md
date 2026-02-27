# 📊 Análisis del Flujo SQL Actual — PulsoElectoral

**Fecha de análisis:** 2026-02-26  
**Versión analizada:** v2.5.1  
**Total de archivos SQL:** 10  

---

## 📁 Inventario de Archivos SQL

| # | Archivo | Líneas | Propósito | Ejecución |
|---|---------|--------|-----------|-----------|
| 1 | `schema.sql` | 654 | Schema base completo | Obligatoria (1ra) |
| 2 | `migracion_v2.3.sql` | 191 | Migra de v2.2 → v2.3 | Condicional (upgrade) |
| 3 | `migracion_colonias_v2.4.sql` | 452 | Inserta 417 colonias | Obligatoria post-schema |
| 4 | `migracion_v2.4_fix_colonias.sql` | 108 | Fix estructura colonias | Condicional (si falla #3) |
| 5 | `fix_colonias_tipo_constraint.sql` | 60 | Fix constraint tipos | Emergencia (error específico) |
| 6 | `fix_supabase_security_linter.sql` | 477 | Recrea vistas seguras | Emergencia (linter) |
| 7 | `alertas_supabase.sql` | 474 | Sistema de alertas | Opcional (feature) |
| 8 | `setup_admin_user.sql` | 196 | Crea admin inicial | Setup inicial (1 vez) |
| 9 | `setup_password_auth.sql` | 60 | Configura auth | Setup inicial (1 vez) |
| 10 | `sql/README.md` | 108 | Documentación | Referencia |

**Total líneas SQL ejecutables:** ~2,672 líneas

---

## 🔄 Flujos de Ejecución Actuales

### FLUJO A: Nueva Instalación (Base de datos vacía)

```
┌─────────────────────────────────────────────────────────────────┐
│  NUEVA INSTALACIÓN (BD Vacía)                                    │
└─────────────────────────────────────────────────────────────────┘

PASO 1: Schema Base (Obligatorio)
├─► schema.sql
│   ├─ Crea extensiones (pgcrypto)
│   ├─ Crea tablas: candidatos, campanas, encuestadores
│   ├─ Crea tablas: secciones_electorales, colonias, respuestas
│   ├─ Crea índices (13 índices)
│   ├─ Crea vistas (7 vistas)
│   ├─ Crea RLS policies (8 políticas)
│   └─ Inserta 68 secciones de Atlixco (seed data)
│
PASO 2: Datos Geográficos (Obligatorio)
├─► migracion_colonias_v2.4.sql
│   ├─ Verifica que tabla colonias existe (DO $$)
│   ├─ Actualiza constraint de tipos
│   └─ Inserta 417 colonias (452 líneas de INSERT)
│
PASO 3: Configuración Auth (Obligatorio)
├─► setup_admin_user.sql (o setup_password_auth.sql)
│   ├─ Crea candidato vinculado a auth.users
│   └─ Crea campaña inicial
│
PASO 4: Features Opcionales
├─► alertas_supabase.sql (Opcional)
│   ├─ Tabla alertas
│   ├─ Funciones de evaluación
│   └─ Triggers automáticos
│
└─► fix_supabase_security_linter.sql (Si el linter falla)
    └─ Recrea vistas con SECURITY INVOKER

TIEMPO ESTIMADO: 5-10 minutos (depende de Supabase)
```

### FLUJO B: Actualización de BD Existente (v2.2 → v2.5)

```
┌─────────────────────────────────────────────────────────────────┐
│  ACTUALIZACIÓN (BD con datos existentes)                         │
└─────────────────────────────────────────────────────────────────┘

SCENARIO B1: Actualización v2.2 → v2.3
├─► migracion_v2.3.sql
│   ├─ Detecta si seccion_id es INT (v2.1/v2.2)
│   ├─ Migra estructura: INT → TEXT
│   ├─ Agrega columnas nuevas: participacion_anterior, etc.
│   ├─ Recrea vistas con nuevo tipo de dato
│   └─ Recrea índices

SCENARIO B2: Actualización v2.3 → v2.4 (colonias)
├─► migracion_v2.4_fix_colonias.sql (SI falla)
│   ├─ Crea tabla colonias si no existe
│   ├─ Agrega columna colonia_id a respuestas
│   └─ Crea vista v_resultados_por_colonia
│
├─► migracion_colonias_v2.4.sql
│   └─ Inserta 417 colonias

SCENARIO B3: Fix de Emergencia (Error específico)
├─► fix_colonias_tipo_constraint.sql
│   └─ Si: "violates check constraint colonias_tipo_check"
│
├─► fix_supabase_security_linter.sql
│   └─ Si: Alertas de seguridad en Supabase Dashboard

COMPLEJIDAD: Alta (depende del estado actual de la BD)
RIESGO: Medio (puede perderse data si se hace mal)
```

### FLUJO C: Desarrollo/Testing (Iterativo)

```
┌─────────────────────────────────────────────────────────────────┐
│  DESARROLLO (Cambios frecuentes)                                 │
└─────────────────────────────────────────────────────────────────┘

CAMBIO A VISTAS (KPIs, tendencias)
├─► Modificar schema.sql
│   └─ Sección "10. VISTAS para el Dashboard"
└─► O: Ejecutar solo el DROP + CREATE VIEW específico

CAMBIO A RLS/POLÍTICAS
├─► Modificar schema.sql
│   └─ Sección "11. ROW LEVEL SECURITY"
└─► O: Ejecutar DROP POLICY + CREATE POLICY individuales

CAMBIO A DATOS (Secciones, colonias)
├─► Modificar migracion_colonias_v2.4.sql
│   └─ Líneas de INSERT
└─► Problema: Script idempotente pero lento (417 inserts)

CAMBIO A FUNCIONES/TRIGGERS
├─► Modificar schema.sql
│   └─ Sección "7. STATS MATERIALIZADAS"
└─► O: CREATE OR REPLACE FUNCTION individual

PROBLEMA: No hay "hot reload" de cambios SQL
```

---

## 🔍 Problemas Identificados en el Flujo Actual

### 1. **DUPLICACIÓN DE CÓDIGO**

| Ubicación | Duplicación | Impacto |
|-----------|-------------|---------|
| `schema.sql` vs `migracion_v2.3.sql` | Vistas definidas en ambos | Mantenimiento doble |
| `migracion_colonias_v2.4.sql` vs `fix_colonias_tipo_constraint.sql` | Constraint de tipos | Inconsistencia |
| `schema.sql` vs `fix_supabase_security_linter.sql` | 7 vistas recreadas | 477 líneas duplicadas |

**Ejemplo concreto:**
```sql
-- schema.sql (líneas 425-438)
DROP VIEW IF EXISTS v_tendencia_semanal;
CREATE VIEW v_tendencia_semanal AS (...);

-- migracion_v2.3.sql (líneas 129-142)
DROP VIEW IF EXISTS v_tendencia_semanal;
CREATE VIEW v_tendencia_semanal AS (...);  -- Mismo código

-- fix_supabase_security_linter.sql (líneas 14-27)
DROP VIEW IF EXISTS v_tendencia_semanal;
CREATE VIEW v_tendencia_semanal AS (...);  -- Tercera vez
```

### 2. **ORDEN DE EJECUCIÓN NO LINEAL**

```
Problema: ¿Cuál ejecutar primero?

Opción A (Nueva instalación):
  schema.sql → migracion_colonias_v2.4.sql → setup_*.sql

Opción B (Actualización v2.2 → v2.4):
  migracion_v2.3.sql → migracion_v2.4_fix_colonias.sql → migracion_colonias_v2.4.sql

Opción C (Fix de error):
  fix_colonias_tipo_constraint.sql (solo si falla)

Opción D (Linter de seguridad):
  fix_supabase_security_linter.sql (solo si alerta)

Resultado: Confusión para nuevos desarrolladores
```

### 3. **DATOS EMBEBIDOS EN MIGRACIONES**

```
migracion_colonias_v2.4.sql (452 líneas)
├─ 30 líneas: Lógica (CREATE, ALTER, DO)
└─ 422 líneas: INSERT INTO colonias VALUES (...)

Problemas:
- Archivo muy grande para revisar en GitHub
- No se puede editar fácilmente una sola colonia
- No hay separación entre estructura y datos
- Si hay error en línea 400, todo falla
```

### 4. **SCENARIO "¿QUÉ EJECUTÉ?"**

```
Desarrollador nuevo llega al proyecto:

1. Ve 10 archivos SQL
2. Lee README.md → dice ejecutar schema.sql primero
3. Ejecuta schema.sql → OK
4. Ejecuta migracion_colonias_v2.4.sql → OK
5. ¿Ejecuta migracion_v2.3.sql? → No está claro
6. ¿Ejecuta migracion_v2.4_fix_colonias.sql? → Quizás
7. ¿Y los fix_*.sql? → Solo si hay error
8. ¿alertas_supabase.sql? → Opcional

Resultado: "Ejecuté todo pero no sé si mi BD está bien"
```

### 5. **NO HAY ROLLBACK**

| Cambio | ¿Se puede deshacer? |
|--------|---------------------|
| `migracion_v2.3.sql` | NO (cambio de INT → TEXT es destructivo) |
| `migracion_colonias_v2.4.sql` | Parcial (DELETE FROM colonias) |
| `alertas_supabase.sql` | Sí (DROP TABLE alertas) |
| Cambios a vistas | Sí (recreate) |

**Riesgo:** Si algo falla en producción, no hay plan de contingencia.

### 6. **DIFICULTAD PARA TESTING**

```
Para probar un cambio en vistas:

1. Modificar schema.sql
2. Ejecutar TODO el schema.sql (654 líneas)
3. Esperar 2-3 minutos
4. Verificar resultado
5. Si está mal, volver a paso 1

Problema: No hay forma de "aplicar solo este cambio"
```

---

## 📊 Mapa de Dependencias entre Archivos

```
                            ┌──────────────────────┐
                            │   schema.sql (654)   │
                            │   (NÚCLEO)           │
                            └──────────┬───────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          │                            │                            │
          ▼                            ▼                            ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ migracion_v2.3.sql  │    │migracion_colonias   │    │   setup_admin_      │
│ (191 líneas)        │    │_v2.4.sql (452)      │    │   user.sql (196)    │
│                     │    │                     │    │                     │
│ DEPENDE: schema     │    │ DEPENDE: schema     │    │ DEPENDE: schema     │
│ v2.1/v2.2           │    │                     │    │ + auth.users        │
└─────────────────────┘    └──────────┬──────────┘    └─────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                         ▼                         ▼
           ┌─────────────────────────┐   ┌─────────────────────────┐
           │migracion_v2.4_fix_      │   │ fix_colonias_tipo_      │
           │colonias.sql (108)       │   │ constraint.sql (60)     │
           │                         │   │                         │
           │ EMERGENCIA: Si falla    │   │ EMERGENCIA: Constraint  │
           │ colonias no existe      │   │                         │
           └─────────────────────────┘   └─────────────────────────┘

ARCHIVOS AISLADOS:
┌─────────────────────────┐    ┌─────────────────────────┐
│alertas_supabase.sql     │    │fix_supabase_security_   │
│(474 líneas)             │    │linter.sql (477)         │
│                         │    │                         │
│ OPCIONAL: Feature        │    │ EMERGENCIA: Linter      │
│ independiente            │    │ seguridad Supabase      │
└─────────────────────────┘    └─────────────────────────┘
```

---

## 🎬 Escenarios de Uso Reales

### Escenario 1: "Nuevo desarrollador en el equipo"

**Tiempo actual:** 30-45 minutos de setup  
**Pasos:**
1. Leer README.md (5 min)
2. Ejecutar schema.sql en Supabase (3 min)
3. Ejecutar migracion_colonias_v2.4.sql (5 min) → Error: "tabla colonias no existe"
4. Leer error, ejecutar migracion_v2.4_fix_colonias.sql (2 min)
5. Re-ejecutar migracion_colonias_v2.4.sql (5 min)
6. Ejecutar setup_admin_user.sql → Error: "usuario no existe en auth"
7. Crear usuario manual en Dashboard (5 min)
8. Re-ejecutar setup_admin_user.sql (2 min)
9. Verificar que todo funcione (10 min)

**Puntos de fricción:** 4 errores potenciales, orden no claro

---

### Escenario 2: "Agregar una nueva colonia"

**Tiempo actual:** 15-20 minutos  
**Pasos:**
1. Abrir migracion_colonias_v2.4.sql (452 líneas)
2. Buscar la sección correcta (5 min)
3. Agregar línea INSERT (1 min)
4. Commit + Push (2 min)
5. En producción: re-ejecutar TODO el archivo (10 min)
   - 417 INSERTs, aunque solo cambió 1
6. Verificar (2 min)

**Puntos de fricción:** Script pesado, no hay "diferencial"

---

### Escenario 3: "Modificar una vista de KPIs"

**Tiempo actual:** 10-15 minutos  
**Pasos:**
1. Abrir schema.sql
2. Buscar "v_kpis_campana" (línea ~390)
3. Modificar SQL (2 min)
4. Ejecutar en Supabase:
   - Opción A: Todo schema.sql (3 min)
   - Opción B: Copiar solo el DROP + CREATE (1 min, riesgo de error)
5. Verificar (5 min)

**Puntos de fricción:** Hay que saber qué copiar, fácil olvidar un índice relacionado

---

### Escenario 4: "Deploy a producción"

**Tiempo actual:** Variable (20-60 minutos)  
**Proceso mental:**
```
¿Qué versión está en producción? v2.3
¿Qué necesito aplicar? v2.4 + v2.5
¿Ejecuto schema.sql completo? No, perdería datos
¿Cuáles son las migraciones pendientes? migracion_colonias_v2.4.sql
¿Y si falla? Tengo los fix_*.sql listos
¿En qué orden? fix primero, luego datos
¿Y alertas? Opcional, después
```

**Puntos de fricción:**
- No hay "estado actual" de la BD documentado
- Orden de ejecución depende del conocimiento tácito
- Si falla en paso 3, los pasos 1-2 ya se aplicaron (no atómico)

---

## 📈 Métricas del Flujo Actual

| Métrica | Valor | Impacto |
|---------|-------|---------|
| **Archivos SQL** | 10 | Complejidad de gestión |
| **Líneas totales** | ~2,672 | Tiempo de revisión en PR |
| **Ordenes de ejecución válidos** | 4+ | Confusión |
| **Escenarios de error documentados** | 3 (README) | Soporte manual |
| **Tiempo setup nuevo dev** | 30-45 min | Onboarding lento |
| **Tiempo cambio menor** | 10-20 min | Desarrollo lento |
| **Rollback posible** | Parcial | Riesgo en producción |
| **Idempotencia** | ~70% | 30% requiere cuidado |

---

## 💭 Conclusiones del Análisis

### Lo que FUNCIONA actualmente:
- ✅ Schema base es completo y funcional
- ✅ Los fix_*.sql resuelven problemas específicos
- ✅ README.md documenta los errores comunes
- ✅ Los scripts son idempotentes (en su mayoría)

### Lo que NO FUNCIONA:
- ❌ Demasiados archivos con responsabilidades solapadas
- ❌ Datos (417 colonias) embebidos en lógica de migración
- ❌ No hay "única fuente de verdad" para el estado de la BD
- ❌ Orden de ejecución depende de conocimiento tácito
- ❌ Difícil saber "qué cambios ya están aplicados"
- ❌ No hay mecanismo de rollback seguro

### El problema principal:
> **"El flujo actual está diseñado para 'funcionar', no para 'escalar con múltiples desarrolladores y clientes'"**

Con 1-2 desarrolladores y 1 municipio, el flujo actual es manejable.  
Con 3+ desarrolladores y 3+ municipios, se vuelve un riesgo operacional.

---

**Fin del análisis del flujo actual**

# 🗺️ Roadmap de Ejecución v3.0 — CORREGIDO

**Fecha:** 2026-02-26  
**Versión:** v3.0-corr (Post-auditoría E1-E24)  
**Estado:** Listo para aprobación final

---

## 🚨 Correcciones Aplicadas (Resumen)

| Categoría | Cantidad | Principales |
|-----------|----------|-------------|
| Crítico | 3 | Rollback plan, orden deploy, bugs pre-testing |
| Alto | 10 | Scripts SQL, tareas subestimadas, preparación |
| Medio | 8 | Tooling, tests, recursos |
| Bajo | 3 | Documentación, seguridad |

**Cambios de mayor impacto:**
1. **Fase 2a:** Sub-fase explícita para corregir bugs U2-U8
2. **Rollback plan:** Eliminado "desactivar RLS", reemplazado por revertir scripts específicos
3. **Tests:** Creación de `tests/v3.0_validate.sql` agregada como tarea
4. **Deploy:** Orden corregido (SQL primero, validación, luego frontend)

---

## 📊 Resumen de Fases (Duraciones Corregidas)

| Fase | Duración | Entregable | Riesgo |
|------|----------|------------|--------|
| **0** | 1-2 días | Staging funcional + tests creados | Medio |
| **1** | 2-3 días | BD v3.0 migrada y validada | **Alto** |
| **2a** | 1 día | Bugs U2-U8 corregidos | **Alto** |
| **2b** | 3 días | Integración Frontend-Backend | Alto |
| **3** | 2 días | Testing completo (2 usuarios) | Alto |
| **4** | 1 día | Deploy a producción | **Alto** |
| **5** | 3 días | Estabilización | Medio |
| **Total** | **13-15 días** | (~3 semanas) | |

---

## FASE 0: Preparación (Días 1-2) — CORREGIDA

### Objetivo
Ambiente de staging idéntico a producción, con tests listos para ejecutar.

### Tareas

#### Día 1: Setup de Staging

**1. Crear proyecto Supabase staging**
- Nombre: `pulsoelectoral-staging-v3`
- Guardar credenciales en archivo seguro (no en repo)

**2. Archivo `.env.staging` (E5 CORREGIDO)**
```bash
# .env.staging (NO commitear)
NEXT_PUBLIC_SUPABASE_URL=https://staging-xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_ENV=staging
```

**3. Exportar schema de producción (E1 CORREGIDO)**
```bash
# ✅ Usar --schema=public para evitar auth, storage, etc.
# ✅ Usar PGPASSWORD en lugar de pass en URL (E3)
export PGPASSWORD="tu-password-aqui"

pg_dump \
  --host=db.xxx.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --schema-only \
  --schema=public \
  --no-owner \
  --no-privileges \
  > schema_prod.sql
```

**4. Exportar datos con dependencias (E2 CORREGIDO)**
```bash
# Exportar TODAS las tablas referenciadas, no solo respuestas
# Tablas necesarias: campanas, candidatos, encuestadores, secciones_electorales, colonias, respuestas

pg_dump \
  --host=db.xxx.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --data-only \
  --schema=public \
  --table=campanas \
  --table=candidatos \
  --table=encuestadores \
  --table=secciones_electorales \
  --table=colonias \
  --table=respuestas \
  --where="created_at > NOW() - INTERVAL '3 months'" \
  > data_subset.sql

# Nota: Para tablas pequeñas (config), exportar completo sin --where
pg_dump --data-only --schema=public --table=stats_campanas >> data_subset.sql
```

**5. Crear usuarios de prueba en staging (E4 CORREGIDO)**
```sql
-- En Supabase Dashboard de STAGING:
-- Authentication → Users → Add User
-- Crear 3 usuarios:
-- 1. hector@pulsoelectoral.com (Superadmin - Org A)
-- 2. paco@paco2025.com (Candidato - Org B)  
-- 3. tester@anon.com (Analista - Org B)

-- Luego ejecutar setup_admin_user.sql para cada uno
```

#### Día 2: Importación y Tests

**6. Importar a staging**
```bash
# Schema primero
psql \
  --host=db.staging.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  -f schema_prod.sql

# Luego datos
psql \
  --host=db.staging.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  -f data_subset.sql
```

**7. Crear archivo de tests (E6, E23 CORREGIDOS)**
Crear `tests/v3.0_validate.sql` (ver sección "Archivos a Crear" al final)

**8. Verificar v2.5 funciona en staging**
- Desplegar código actual a staging
- Login con usuario de prueba
- Verificar dashboard carga datos

### Entregables Fase 0
- [x] Proyecto staging creado
- [x] Datos importados (sin errores de FK)
- [x] Usuarios de prueba creados (3 usuarios, 2 orgs)
- [x] `tests/v3.0_validate.sql` creado
- [x] v2.5 funciona en staging

---

## FASE 1: Migración SQL v3.0 (Días 3-5) — CORREGIDA

### Día 3: Scripts 01-03 + Corrección de Errores

**Mañana (4 horas):**
```sql
-- Ejecutar en orden:
1. 01_catalogo_geografico.sql      -- ~10 min
2. 02_organizaciones.sql           -- ~5 min
3. 03_respuestas_contexto.sql      -- ~30-120 min (depende de volumen)
```

**Si un script falla con RAISE EXCEPTION (E7):**
- Leer mensaje de error
- Corregir causa (ej: falta tabla, dato inconsistente)
- **Re-ejecutar el mismo script** (E8: son idempotentes)
- No es necesario limpiar, los scripts manejan `IF NOT EXISTS`

**Tarde (2 horas):**
```sql
-- Validación inmediata
SELECT COUNT(*) FROM respuestas WHERE organizacion_id IS NULL; -- Debe ser 0
SELECT COUNT(*) FROM respuestas WHERE municipio_id IS NULL;    -- Debe ser 0
SELECT COUNT(*) FROM campanas WHERE organizacion_id IS NULL;   -- Debe ser 0
```

**Si hay NULLs:**
- Identificar filas: `SELECT id, campana_id FROM respuestas WHERE organizacion_id IS NULL`
- Corregir manualmente o ejecutar UPDATE nuevamente
- No continuar hasta que todos los NULLs estén resueltos

### Día 4: Scripts 04-05 + Validación

**Mañana (2 horas):**
```sql
4. 04_rls_unificado.sql            -- ~5 min
5. 05_vistas_corregidas.sql        -- ~5 min
```

**Tarde (3 horas): Validación Completa**
```sql
-- Ejecutar test suite completo
\i tests/v3.0_validate.sql
```

**Debe pasar 11/11 tests.** Si falla alguno, corregir antes de continuar.

### Día 5: Corrección y Re-ejecución (Buffer)

- [ ] Corregir errores identificados en validación
- [ ] Re-ejecutar scripts necesarios
- [ ] Validación final completa
- [ ] Documentar cualquier ajuste hecho a scripts

**Checkpoint GO/NO-GO:**
- ✅ Todos los tests pasan
- ✅ RLS funciona (Usuario A no ve datos de B)
- ✅ Encuesta anónima funciona
- ❌ Algún test crítico falla → NO continuar, corregir primero

### Entregables Fase 1
- [x] BD v3.0 funcional en staging
- [x] `00_validate_migration.sql` pasa sin errores
- [x] `tests/v3.0_validate.sql` pasa 11/11

---

## FASE 2a: Corrección de Bugs Pre-Testing (Día 6) — NUEVA

**Objetivo (E9, E22 CORREGIDOS):** Corregir bugs U2-U8 antes de integración.

| Bug | Archivo | Corrección | Tiempo |
|-----|---------|------------|--------|
| U2 | useOrganizacion.js | Agregar `initialLoadDoneRef` | 30 min |
| U3 | app/page.jsx | `e.target` → `e.currentTarget` | 10 min |
| U4 | useOrganizacion.js | Agregar `isFetchingRef` | 30 min |
| U5 | bienvenido/page.jsx + WelcomePopup.jsx | Spinner condicional, keyframes unificados | 30 min |
| U6 | WelcomePopup.jsx | Usar `useRef` para timers | 45 min |
| U7 | useAuthFlow.js | Eliminar `rolSeleccionado` | 15 min |
| U8 | useAuthFlow.js | Agregar `.trim()` a email | 10 min |

**Total:** ~3 horas

### Entregables Fase 2a
- [x] Todos los bugs U2-U8 corregidos
- [x] Código compila sin errores (`npm run build`)
- [x] Smoke test: Login → Bienvenida → Dashboard funciona

---

## FASE 2b: Integración Frontend-Backend (Días 7-9) — CORREGIDA

### Día 7: Componentes Base (E10, E12 CORREGIDOS)

**Mañana: Crear Header compartido (E10)**
```bash
# Nuevo archivo: src/components/layout/Header.jsx
# Este componente se usará en Dashboard, WarRoom, Admin
```
- Crear `Header` con `MunicipioSelector` integrado
- Mostrar: Logo, Org nombre, Municipio selector, User avatar

**Tarde: Actualizar páginas para usar Header**
- Modificar `DashboardPolitico.jsx`: Usar nuevo Header
- RLS filtra por organizacion_id automáticamente (E12: NO agregar filtros redundantes)
- Solo filtrar por `municipio_id` en queries

### Día 8: Formulario y Admin (E13 CORREGIDO)

**Mañana: FormularioEncuesta.jsx**
- Obtener `municipio_id` desde la campaña activa
- En el payload de submit, incluir `municipio_id` y `organizacion_id`
- Mecanismo: Leer de `campanas` table al cargar el formulario

**Tarde: AdminPanel.jsx (E15 CORREGIDO)**
- Implementar `agregarMunicipio()` con recarga de estado
- Agregar `await cargarMunicipios()` después del insert
- Validar límites del plan (UI + mensaje de error)

### Día 9: War Room (E11 CORREGIDO — Día completo)

**Tarea compleja:** Reescribir WarRoom para multi-municipio

**Tareas:**
1. Reescribir `useWarRoomData` hook:
   - Aceptar `municipioId` 
   - Buscar campaña activa del municipio: `campanas` WHERE `municipio_id` = X AND `activa` = true
   - Usar primera campaña encontrada (o la más reciente)
   
2. Modificar `WarRoom.jsx`:
   - Agregar prop `municipioId`
   - Implementar modo comparación: 2 instancias del mapa lado a lado
   - Cada mapa con su propio `municipioId`

3. Actualizar queries para usar `v_metricas_por_seccion`

**Tiempo estimado:** 6-8 horas (día completo)

### Entregables Fase 2b
- [x] Header compartido funcional
- [x] Dashboard filtra por municipio
- [x] Formulario envía contexto correcto
- [x] Admin gestiona municipios
- [x] War Room compara municipios

---

## FASE 3: Testing (Días 10-11) — CORREGIDA

### Recursos (E24 CORREGIDO)
- 2 testers con cuentas en **organizaciones diferentes**
- 1 cuenta superadmin (Héctor)
- 1 cuenta candidato (Paco)

### Día 10: Tests Funcionales y Seguridad

| Test | Usuario | Acción | Resultado |
|------|---------|--------|-----------|
| T1 | Encuestador (Org A) | Login → Formulario | Ve secciones de su municipio |
| T2 | Encuestador | Enviar encuesta | Guarda con mun_id correcto |
| T3 | Analista (Org B) | Login → Dashboard | Ve KPIs de su org, NO de Org A |
| T4 | Analista Org B | Intentar ver campaña Org A | No aparece / datos vacíos |
| T5 | Admin | Agregar municipio | Aparece en selector (E15) |
| T6 | Superadmin | Ver todas las orgs | Acceso concedido |

**Tests de seguridad críticos:**
- [ ] Usuario A (Org A) no ve datos de Usuario B (Org B)
- [ ] RLS bloquea acceso directo a tabla sin auth
- [ ] Encuesta anónima funciona (requiere: campaña activa + URL pública)

### Día 11: Performance y Edge Cases

**Performance (E16 CORREGIDO):**
- Usar Chrome DevTools → Network → Disable cache
- Medir: Dashboard carga <3s, War Room <5s
- Ver en Vercel Analytics (si está configurado)

**Edge Cases:**
- [ ] Cambio rápido de municipio en selector
- [ ] Logout → Login con usuario diferente (misma máquina)
- [ ] Offline → Online (sync de encuestas pendientes)

### Entregables Fase 3
- [x] Todos los tests pasan
- [x] Seguridad validada (no hay data leakage)
- [x] Performance dentro de objetivos

---

## FASE 4: Deploy a Producción (Día 12) — CORREGIDA

### Pre-Deploy (Mañana)

- [ ] Notificar a usuarios: "Mantenimiento programado 3 horas"
- [ ] Backup completo descargado y verificado
- [ ] Scripts SQL listos en orden de ejecución
- [ ] Equipo disponible durante deploy

### Deploy (Tarde) — ORDEN CORREGIDO (E19)

**Hora T+0:00 - T+2:00: Ejecutar SQL + Validar**
```bash
# 1. Ejecutar scripts en producción (mismo orden que staging)
psql -f 01_catalogo_geografico.sql
psql -f 02_organizaciones.sql
psql -f 03_respuestas_contexto.sql  # Puede tomar tiempo (E20)
psql -f 04_rls_unificado.sql
psql -f 05_vistas_corregidas.sql

# 2. Validación OBLIGATORIA antes de continuar
psql -f 00_validate_migration.sql
psql -f tests/v3.0_validate.sql
```

**Checkpoint:** Si validación FALLA → NO continuar, ejecutar rollback.

**Hora T+2:00 - T+2:30: Deploy Frontend (solo si SQL pasó)**
```bash
# 3. Deploy de código solo después de validación exitosa
git push origin main  # o deploy en Vercel
```

**Hora T+2:30 - T+3:00: Smoke Tests en Producción**
- [ ] Login funciona
- [ ] Dashboard carga
- [ ] Agregar una encuesta de prueba

### Rollback Plan (E18 CORREGIDO)

**Opción A: Restore desde backup (Recomendado)**
```bash
# En Supabase Dashboard:
# Backups → Seleccionar backup pre-migración → Restore
# Tiempo: 15-30 minutos
```

**Opción B: Revertir scripts específicos (Solo si se sabe cuál falló)**
```bash
# Ejemplo: Si 04_rls_unificado.sql causó problemas
psql -c "DROP POLICY respuestas_isolation_completa ON respuestas;"
psql -c "-- Recrear políticas anteriores v2.5"
```

**❌ NUNCA usar (E18):**
```sql
-- ESTO NUNCA:
ALTER TABLE respuestas DISABLE ROW LEVEL SECURITY;  -- EXPONE TODOS LOS DATOS
```

### Post-Deploy

- [ ] Monitorear logs de errores (Sentry, Vercel)
- [ ] Invalidar Service Worker (E21): Incrementar versión en manifest

---

## FASE 5: Estabilización (Días 13-15)

- [ ] Monitoreo intensivo (logs cada 2 horas)
- [ ] Bugfixes rápidos si es necesario
- [ ] Documentación de lecciones aprendidas

---

## 📋 Archivos a Crear

### 1. `tests/v3.0_validate.sql` (E6, E23)
```sql
-- Test suite completo (copiar del documento STAGING_TESTING_v3.0_CORREGIDO.md)
-- 11 tests automatizados
```

### 2. `.env.staging` (E5)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_ENV=staging
```

### 3. `src/components/layout/Header.jsx` (E10)
```jsx
// Header compartido con MunicipioSelector
```

---

## ✅ Checkpoints Finales de Aprobación

| Checkpoint | Cuándo | ¿Aprobado? |
|------------|--------|------------|
| Fase 0 | Día 2 | Staging funcional con 3 usuarios |
| Fase 1 | Día 5 | Todos los tests SQL pasan |
| Fase 2a | Día 6 | Bugs U2-U8 corregidos, build exitoso |
| Fase 2b | Día 9 | Integración completa, smoke tests pasan |
| Fase 3 | Día 11 | Tests de seguridad y performance pasan |
| Deploy | Día 12 | SQL validado antes de frontend deploy |

**¿Apruebas este roadmap corregido para comenzar ejecución?**

---

## 📎 Notas de Implementación

### Estimación de tiempo para UPDATE masivo (E20)
- 1,000 respuestas: ~1 minuto
- 10,000 respuestas: ~5-10 minutos
- 100,000 respuestas: ~30-60 minutos

Planificar ventana de mantenimiento según volumen de datos.

### Service Worker Cache (E21)
Invalidar incrementando versión en:
- `public/sw.js` (si existe versión manual)
- O usar `skipWaiting` en el SW para forzar actualización

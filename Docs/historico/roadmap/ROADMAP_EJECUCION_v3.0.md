# 🗺️ Roadmap de Ejecución v3.0 — PulsoElectoral

**Fecha:** 2026-02-26  
**Versión Objetivo:** v3.0 (Multi-Municipio)  
**Estado Actual:** Estructura completa, listo para staging  

---

## 📊 Resumen de Fases

| Fase | Duración | Objetivo | Riesgo |
|------|----------|----------|--------|
| **0** | 1 día | Preparación de ambiente staging | Bajo |
| **1** | 2 días | Migración SQL v3.0 + validación | **Alto** (datos) |
| **2** | 3 días | Integración Frontend-Backend | Medio |
| **3** | 2 días | Testing completo | Medio |
| **4** | 1 día | Deploy a producción | **Alto** (rollback) |
| **5** | 3 días | Estabilización + bugfixes | Medio |
| **Total** | **12 días hábiles** | (~2.5 semanas) | |

---

## FASE 0: Preparación (Día 1)

### Objetivo
Tener un ambiente de staging idéntico a producción para probar sin riesgo.

### Checklist
- [ ] **Backup completo** de producción (punto de restauración)
- [ ] Crear proyecto Supabase staging (pulsoelectoral-staging-v3)
- [ ] Exportar schema + datos de producción (subset de 1000 encuestas)
- [ ] Importar a staging
- [ ] Verificar que v2.5 funciona en staging
- [ ] Documentar credenciales de staging (.env.staging)

### Script de Exportación (Producción → Staging)
```bash
# 1. Backup schema
pg_dump --schema-only --no-owner \
  postgres://user:pass@db.prod.supabase.co:5432/postgres \
  > schema_prod.sql

# 2. Backup subset de datos (últimos 3 meses)
psql postgres://user:pass@db.prod.supabase.co:5432/postgres \
  -c "COPY (SELECT * FROM respuestas WHERE created_at > NOW() - INTERVAL '3 months') TO STDOUT CSV HEADER" \
  > respuestas_subset.csv

# 3. Importar a staging
psql postgres://user:pass@db.staging.supabase.co:5432/postgres -f schema_prod.sql
psql postgres://user:pass@db.staging.supabase.co:5432/postgres \
  -c "COPY respuestas FROM STDIN CSV HEADER" < respuestas_subset.csv
```

### Entregable
✅ Staging funcional con datos reales (subset)

---

## FASE 1: Migración SQL v3.0 (Días 2-3)

### Día 2: Ejecución de Scripts

**Mañana (2 horas):**
```sql
-- Ejecutar en orden estricto:
1. 01_catalogo_geografico.sql      -- Estados, municipios, secciones con mun_id
2. 02_organizaciones.sql           -- Orgs, membresías, acceso a municipios
3. 03_respuestas_contexto.sql      -- Agregar org_id y mun_id a campanas/respuestas
```

**Validación inmediata:**
```sql
-- Verificar que no hay NULLs
SELECT COUNT(*) FROM respuestas WHERE organizacion_id IS NULL; -- Debe ser 0
SELECT COUNT(*) FROM respuestas WHERE municipio_id IS NULL;    -- Debe ser 0
```

**Tarde (2 horas):**
```sql
4. 04_rls_unificado.sql            -- Políticas de seguridad
5. 05_vistas_corregidas.sql        -- Vistas sin cross-joins
6. 00_validate_migration.sql       -- Validación completa
```

### Día 3: Validación y Corrección

**Mañana:**
- [ ] Ejecutar test suite SQL (`tests/v3.0_validate.sql`)
- [ ] Verificar RLS: "Usuario A no ve datos de Usuario B"
- [ ] Probar inserción anónima (encuesta desde formulario)

**Tarde (si hay errores):**
- [ ] Corregir scripts SQL
- [ ] Re-ejecutar validación
- [ ] Documentar cambios en scripts

**Checkpoint GO/NO-GO:**
- ✅ Todos los tests pasan
- ✅ RLS funciona correctamente
- ❌ Algún test crítico falla → Volver a Fase 0, restaurar backup

### Entregable
✅ BD v3.0 funcional en staging con validación completa

---

## FASE 2: Integración Frontend-Backend (Días 4-6)

### Día 4: Layout y Contexto Global

**Tareas:**
1. **Actualizar `layout.jsx`** (ya hecho ✅)
   - Verificar que `OrganizacionProvider` envuelve toda la app

2. **Crear `MunicipioSelector` en Header**
   ```jsx
   // components/layout/Header.jsx
   - Agregar dropdown de municipios si el usuario tiene >1
   - Mostrar solo en páginas protegidas (dashboard, admin)
   ```

3. **Proteger rutas por rol**
   ```jsx
   // middleware.js o HOC withRole
   - /encuesta → solo encuestador
   - /dashboard → analista, admin, superadmin
   - /admin → admin, superadmin
   ```

### Día 5: Páginas Protegidas

**Mañana:**
- [ ] Modificar `DashboardPolitico.jsx`
  - Usar `useOrganizacion` para obtener `municipioActual`
  - Filtrar queries por `municipio_id` y `organizacion_id`
  - Agregar `MunicipioSelector` en header del dashboard

**Tarde:**
- [ ] Modificar `FormularioEncuesta.jsx`
  - Filtrar secciones por `municipio_id`
  - Filtrar colonias por sección seleccionada
  - Guardar encuesta con `municipio_id` automático

### Día 6: Admin y War Room

**Mañana:**
- [ ] Modificar `AdminPanel.jsx`
  - Agregar sección "Municipios" para gestionar acceso
  - Validar límites del plan (`limite_municipios`)

**Tarde:**
- [ ] Modificar `WarRoom.jsx`
  - Aceptar `municipioId` como prop
  - Implementar modo comparación (2 mapas)
  - Usar `v_metricas_por_seccion` en lugar de vista antigua

### Entregable
✅ Frontend integrado con BD v3.0 en staging

---

## FASE 3: Testing (Días 7-8)

### Día 7: Tests Funcionales

| Test | Usuario | Acción | Resultado Esperado |
|------|---------|--------|-------------------|
| T1 | Encuestador | Login → Formulario | Ve solo secciones de su municipio |
| T2 | Encuestador | Enviar encuesta | Guarda con mun_id correcto |
| T3 | Analista | Login → Dashboard | Ve KPIs de su municipio |
| T4 | Analista | Cambiar municipio | Dashboard actualiza datos |
| T5 | Admin | Login → Admin | Puede ver gestión de municipios |
| T6 | Admin | Agregar municipio | Aparece en selector |

### Día 8: Tests de Seguridad y Performance

**Seguridad:**
- [ ] Usuario de Org A intenta ver datos de Org B → 403 o datos vacíos
- [ ] Usuario sin rol de admin intenta acceder a /admin → Redirige
- [ ] Encuesta anónima funciona (sin login)

**Performance:**
- [ ] Dashboard carga en <3s (con 1000+ encuestas)
- [ ] War Room carga en <5s
- [ ] Selector de municipio es instantáneo

**Checkpoint GO/NO-GO:**
- ✅ Todos los tests funcionales pasan
- ✅ Seguridad validada (no hay data leakage)
- ⚠️ Performance lenta → Optimizar índices o reconsiderar deploy

### Entregable
✅ Sistema validado en staging, listo para producción

---

## FASE 4: Deploy a Producción (Día 9)

### Pre-Deploy (Mañana)

- [ ] Notificar a usuarios: "Mantenimiento programado 2 horas"
- [ ] Backup completo de producción (descargar y verificar)
- [ ] Preparar scripts SQL en orden de ejecución
- [ ] Tener rollback plan listo (backup verificado)

### Deploy (Tarde - Ventana de mantenimiento)

**Hora 0:00 - 0:30:**
```bash
# 1. Poner sitio en modo mantenimiento (opcional)
# 2. Ejecutar scripts SQL en producción (mismo orden que staging)
```

**Hora 0:30 - 1:00:**
```bash
# 3. Validación rápida en producción
# 4. Deploy de código frontend (git push → Vercel)
```

**Hora 1:00 - 2:00:**
```bash
# 5. Testing rápido en producción (smoke tests)
# 6. Si todo OK: Quitar modo mantenimiento
# 7. Si falla: Ejecutar rollback
```

### Rollback Plan (Si es necesario)

```bash
# Opción A: Restaurar backup completo (15-30 minutos)
supabase dashboard → backups → restore

# Opción B: Hotfix rápido (si es error menor)
# Revertir código frontend a v2.5
# Desactivar RLS temporalmente si bloquea usuarios
```

### Entregable
✅ v3.0 en producción (o rollback exitoso)

---

## FASE 5: Estabilización (Días 10-12)

### Día 10: Monitoreo Intensivo

- [ ] Revisar logs de errores cada 2 horas
- [ ] Verificar métricas de performance (Vercel Analytics)
- [ ] Estar atento a reportes de usuarios

### Día 11: Bugfixes Rápidos

- [ ] Corregir bugs menores reportados
- [ ] Optimizar queries lentas identificadas
- [ ] Actualizar documentación si es necesario

### Día 12: Cierre

- [ ] Documentar lecciones aprendidas
- [ ] Actualizar manuales de usuario
- [ ] Planear próximas mejoras (v3.1)

### Entregable
✅ v3.0 estable en producción

---

## 🚨 Checkpoints de Decisión

### Checkpoint 1: Post-Fase 1 (Día 3)
**¿Migración SQL exitosa en staging?**
- ✅ SÍ → Continuar a Fase 2
- ❌ NO → Corregir scripts, repetir Fase 1

### Checkpoint 2: Post-Fase 3 (Día 8)
**¿Tests pasan y sistema es estable?**
- ✅ SÍ → Programar deploy (Fase 4)
- ❌ NO → Extender Fase 3, NO hacer deploy

### Checkpoint 3: Durante Fase 4 (Día 9)
**¿Deploy exitoso?**
- ✅ SÍ → Monitorear (Fase 5)
- ❌ NO → Rollback inmediato, planificar nuevo intento

---

## 📋 Recursos Necesarios

| Recurso | Cantidad | Cuándo |
|---------|----------|--------|
| Héctor (Superadmin) | 2 horas/día | Todo el proyecto |
| 1 Tester/Usuario | 4 horas/día | Fase 3 |
| Proyecto Supabase Staging | 1 | Fase 0 |
| Backup storage | 5GB | Siempre |

---

## 🎯 Métricas de Éxito

| Métrica | Objetivo | Cómo medir |
|---------|----------|------------|
| Uptime durante deploy | 99.9% | Logs de Vercel |
| Tiempo de downtime | <30 min | Cronometraje manual |
| Bugs críticos post-deploy | 0 | Reportes de usuarios |
| Performance dashboard | <3s | Vercel Analytics |
| Satisfacción usuarios | >8/10 | Encuesta rápida |

---

## ❓ Preguntas para Confirmar

Antes de empezar, necesito confirmar:

1. **¿Tienes acceso para crear proyecto Supabase staging?** (Necesitamos uno nuevo)

2. **¿Cuál es la mejor ventana para deploy?** (Recomendado: Domingo 2-4 AM)

3. **¿Quién puede hacer testing?** (¿Paco, algún encuestador, equipo?)

4. **¿Hay fecha límite?** (¿Elecciones, evento específico?)

5. **¿Aceptamos riesgo de rollback?** (¿O prefieres prueba más larga en staging?)

---

**¿Aprobamos este roadmap y empezamos con Fase 0?**

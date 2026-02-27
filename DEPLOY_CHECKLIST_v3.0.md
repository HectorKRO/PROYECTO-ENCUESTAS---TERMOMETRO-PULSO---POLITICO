# Checklist de Deploy v3.0

## Información del Deploy
- **Fecha:** ___/___/______
- **Hora inicio:** _______ 
- **Hora fin:** _______
- **Ejecutado por:** __________________
- **Verificado por:** __________________

---

## FASE 1: Staging (Pre-producción)

### Supabase Staging
- [ ] Proyecto creado en https://app.supabase.com
- [ ] URL guardada: `___________________________`
- [ ] Anon Key guardada: `_____________________`

### Scripts SQL Ejecutados
- [ ] 01_catalogo_geografico.sql
- [ ] 02_organizaciones.sql
- [ ] 03_respuestas_contexto.sql
- [ ] 04_rls_unificado.sql
- [ ] 05_vistas_corregidas.sql

### Validación
- [ ] `v3.0_validate.sql` ejecutado → **11/11 tests pasaron**
- [ ] `setup_staging.sql` ejecutado
- [ ] Usuarios de prueba creados (3)
- [ ] Membresías asignadas con UUIDs reales

### Vercel Staging
- [ ] Variables de entorno configuradas
- [ ] Deploy exitoso
- [ ] Build sin errores

---

## FASE 2: Testing E2E en Staging

### Login y Autenticación
- [ ] Login como Héctor (superadmin) funciona
- [ ] Login como Paco (admin) funciona
- [ ] Login como Tester (analista) funciona

### Contexto Multi-municipio
- [ ] Dashboard carga múltiples municipios
- [ ] Cambio de municipio actualiza datos
- [ ] Municipio seleccionado persiste en localStorage

### WarRoom
- [ ] Mapa carga con GeoJSON correcto
- [ ] Modo comparación muestra 2 mapas
- [ ] Selectores de municipio+campaña funcionan
- [ ] Datos de cada lado son independientes

### Formulario de Encuesta
- [ ] Colonias se filtran por municipio actual
- [ ] Secciones cargan desde Supabase
- [ ] Payload incluye `municipio_id` y `organizacion_id`
- [ ] Encuesta se guarda correctamente

### Offline Sync
- [ ] Encuesta guardada en localStorage cuando no hay red
- [ ] Sync exitoso al reconectar
- [ ] Datos sincronizados tienen contexto correcto

---

## FASE 3: Preparar Producción

### Backup
- [ ] Backup de BD actual creado
- [ ] Backup descargado y guardado
- [ ] Tag git de versión actual creado (ej: `v2.5.x` última versión estable antes de v3.0)

### Supabase Producción
- [ ] Proyecto creado
- [ ] URL: `___________________________`
- [ ] Anon Key: `_____________________`
- [ ] Scripts SQL ejecutados (mismo orden que staging)
- [ ] Datos legacy migrados (si aplica)

### Vercel Producción
- [ ] Variables de entorno actualizadas
- [ ] Dominio configurado
- [ ] SSL funcionando

---

## FASE 4: Deploy Producción

### Deploy
- [ ] Tag `v3.0.0` creado en git
- [ ] Deploy ejecutado en Vercel
- [ ] Build exitoso

### Smoke Tests (Post-deploy)
- [ ] https://app.pulsoelectoral.com carga
- [ ] Login funciona
- [ ] Dashboard muestra datos
- [ ] WarRoom carga mapa
- [ ] Formulario envía encuestas

### Verificación SQL (ejecutar en producción)
```sql
\i tests/verify_deploy.sql
```
- [ ] Resultado: **10/10 tests pasaron**

---

## FASE 5: Monitoreo Post-Deploy

### Inmediato (0-2 horas)
- [ ] No hay picos de errores en Sentry/LogRocket
- [ ] Login funciona para todos los usuarios activos
- [ ] Encuestas llegan con `municipio_id` y `organizacion_id`

### 24 horas
- [ ] Métricas de rendimiento estables
- [ ] No hay degradación perceptible
- [ ] Feedback de usuarios positivo

### 1 semana
- [ ] Análisis de uso del modo comparación
- [ ] Decisión sobre próximas mejoras

---

## Rollback (Solo si es necesario)

### Opción 1: Revertir Frontend
```bash
git revert v3.0.0
git push origin main
```
- [ ] Ejecutado
- [ ] Vercel redeployó versión anterior
- [ ] Sitio funciona correctamente

### Opción 2: Restaurar BD
- [ ] Backup restaurado en Supabase
- [ ] Datos verificados
- [ ] Aplicación funciona

---

## Notas y Observaciones

```
_________________________________________________
_________________________________________________
_________________________________________________
_________________________________________________
```

---

## Aprobaciones

**Técnico:** _________________________ **Fecha:** ___/___/______

**Producto:** ________________________ **Fecha:** ___/___/______

**QA:** _____________________________ **Fecha:** ___/___/______

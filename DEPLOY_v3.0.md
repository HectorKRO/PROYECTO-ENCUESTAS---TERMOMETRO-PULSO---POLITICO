# Guía de Deploy v3.0 — Fase 4

**Fecha:** 2026-02-26  
**Versión:** v3.0 (Multi-municipio/Multi-tenant)  
**Estado:** Listo para deploy

---

## Pre-requisitos

- [ ] Acceso a consola Supabase (para crear proyecto)
- [ ] Acceso a Vercel (para deploy frontend)
- [ ] Git con acceso al repositorio
- [ ] Node.js 18+ y npm instalados

---

## PASO 1: Preparar Ambiente de Staging

### 1.1 Crear Proyecto Supabase Staging

1. Ir a https://app.supabase.com
2. Click "New Project"
3. Configurar:
   - **Organization:** PulsoElectoral
   - **Project Name:** `pulsoelectoral-staging`
   - **Database Password:** (generar segura, guardar en 1Password)
   - **Region:** US East (N. Virginia) — más cercano a México
4. Esperar a que se cree (~2 minutos)
5. Guardar:
   - `SUPABASE_URL` (Project Settings > API)
   - `SUPABASE_ANON_KEY` (Project Settings > API)

### 1.2 Ejecutar Scripts SQL (en orden)

Ir a SQL Editor en Supabase y ejecutar **copiando y pegando el contenido** de cada archivo:

**Nota:** El comando `\i` es de psql CLI y no funciona en el SQL Editor web. Abrir cada archivo y copiar su contenido.

1. **Catálogo geográfico:** Copiar contenido de `sql/v3.0/01_catalogo_geografico.sql`
2. **Organizaciones:** Copiar contenido de `sql/v3.0/02_organizaciones.sql`
3. **Respuestas contexto:** Copiar contenido de `sql/v3.0/03_respuestas_contexto.sql`
4. **RLS Unificado:** Copiar contenido de `sql/v3.0/04_rls_unificado.sql`
5. **Vistas corregidas:** Copiar contenido de `sql/v3.0/05_vistas_corregidas.sql`

### 1.3 Validar Migración

Ejecutar copiando y pegando:

```sql
-- Contenido de tests/v3.0_validate.sql
```

**Resultado esperado:** ✅ TODOS LOS TESTS PASARON (11/11)

### 1.4 Setup de Datos de Prueba

```sql
\i tests/setup_staging.sql
```

### 1.5 Crear Usuarios de Prueba

Ir a Authentication > Users > Add User:

| Usuario | Email | Password | Rol Metadata |
|---------|-------|----------|--------------|
| Héctor | `hector@pulsodemo.com` | `(usar gestor de secretos)` | `{"rol": "superadmin"}` |
| Paco | `paco@pulsodemo.com` | `(usar gestor de secretos)` | `{"rol": "admin"}` |
| Tester | `tester@pulsodemo.com` | `(usar gestor de secretos)` | `{"rol": "analista"}` |

**Nota de seguridad:** Las contraseñas deben generarse aleatoriamente y almacenarse en un gestor de secretos (1Password, Bitwarden, etc.). Nunca commitear contraseñas al repositorio.

**IMPORTANTE:** Copiar los UUIDs generados (auth.users.id) para el siguiente paso.

### 1.6 Asignar Membresías

Editar `tests/setup_staging.sql`, reemplazar `<UUID-XXXX>` con los UUIDs reales, luego:

```sql
-- Descomentar y ejecutar la sección 5 de setup_staging.sql
```

### 1.7 Verificar Datos

```sql
-- Debe mostrar 2 organizaciones con 1-2 municipios cada una
SELECT o.nombre, COUNT(om.municipio_id) as municipios
FROM organizaciones o
LEFT JOIN organizacion_municipios om ON o.id = om.organizacion_id
GROUP BY o.id, o.nombre;
```

---

## PASO 2: Deploy Frontend a Staging

### 2.1 Configurar Variables de Entorno (Vercel)

En Vercel Dashboard > Project Settings > Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://staging.pulsoelectoral.com
```

### 2.2 Deploy

```bash
# Local
git checkout main
git pull origin main
npm ci
npm run build

# Si build exitoso:
git push origin main
```

Vercel hará deploy automático.

### 2.3 Verificar Build

- [ ] Build exitoso (sin errores)
- [ ] Acceder a https://staging.pulsoelectoral.com
- [ ] Verificar login carga

---

## PASO 3: Testing E2E en Staging

### 3.1 Login y Contexto

- [ ] Login como Héctor (superadmin)
- [ ] Verificar que carga 2 municipios
- [ ] Cambiar entre municipios

### 3.2 Dashboard

- [ ] KPIs se cargan correctamente
- [ ] Selector de municipio funciona
- [ ] Datos cambian al cambiar municipio

### 3.3 WarRoom

- [ ] Mapa carga correctamente
- [ ] Modo comparación activa 2 mapas
- [ ] Selector de municipio+campaña funciona
- [ ] GeoJSON carga según municipio

### 3.4 Formulario

- [ ] Login como Paco (admin)
- [ ] Iniciar encuesta
- [ ] Colonias se filtran por municipio
- [ ] Enviar encuesta (verificar payload incluye municipio_id y organizacion_id)

### 3.5 Offline Sync

- [ ] Desconectar red
- [ ] Guardar encuesta offline
- [ ] Reconectar y sincronizar
- [ ] Verificar encuesta llegó a BD con contexto correcto

---

## PASO 4: Preparar Producción

### 4.1 Backup Base de Datos Actual

```bash
# En Supabase Dashboard
# Database > Backups > Create Backup
# O usar pg_dump:
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup_pre_v3.0.sql
```

### 4.2 Crear Proyecto Supabase Producción

Repetir PASO 1.1 con:
- **Project Name:** `pulsoelectoral-prod`

### 4.3 Ejecutar Scripts SQL en Producción

Repetir PASO 1.2 - 1.4 (sin datos de prueba)

### 4.4 Migrar Datos Legacy (si aplica)

```sql
-- Ejecutar script de migración de datos existentes
-- (Ver sql/v3.0/03_respuestas_contexto.sql)
```

---

## PASO 5: Deploy a Producción

### 5.1 Configurar Variables de Entorno (Producción)

```
NEXT_PUBLIC_SUPABASE_URL=https://prod-xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://app.pulsoelectoral.com
```

### 5.2 Deploy Production

```bash
git tag v3.0.0
git push origin v3.0.0
```

Vercel hará deploy automático de la tag.

### 5.3 Smoke Tests

- [ ] Homepage carga
- [ ] Login funciona
- [ ] Dashboard carga datos
- [ ] WarRoom muestra mapa
- [ ] Formulario envía encuestas

---

## Plan de Rollback

### Si algo falla:

**Opción 1: Revertir Frontend (Rápido)**
```bash
git revert v3.0.0
git push origin main
```

**Opción 2: Restaurar BD (Solo si es crítico)**
1. Ir a Supabase Dashboard > Database > Backups
2. Seleccionar backup pre-v3.0
3. Click "Restore"

**⚠️ NUNCA desactivar RLS manualmente como forma de "arreglar" problemas.**

---

## Post-Deploy Checklist

### Inmediato (0-2 horas)
- [ ] Monitor de errores (Sentry/LogRocket) sin picos
- [ ] Tasa de éxito de login normal
- [ ] Encuestas llegando a BD con municipio_id y organizacion_id

### 24 horas
- [ ] Revisión de métricas de rendimiento
- [ ] Feedback de usuarios piloto

### 1 semana
- [ ] Análisis de uso del modo comparación
- [ ] Decidir prioridad de mejoras pendientes

---

## Contactos de Emergencia

- **DevOps:** [nombre]@[email]
- **DBA:** [nombre]@[email]
- **Producto:** [nombre]@[email]

---

## Anexos

### A. Verificación Rápida de BD

```sql
-- Verificar RLS activo
SELECT tablename, relrowsecurity 
FROM pg_tables 
JOIN pg_class ON tablename = relname
WHERE schemaname = 'public' 
AND tablename IN ('respuestas', 'campanas', 'encuestadores');

-- Verificar columnas multi-tenant
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE column_name IN ('organizacion_id', 'municipio_id')
AND table_schema = 'public';
```

### B. Verificación de Payload

```javascript
// En consola del navegador, después de enviar encuesta:
// Debe incluir municipio_id y organizacion_id
```

---

**Fecha de deploy planificada:** ___/___/______  
**Ejecutado por:** ______________________  
**Verificado por:** ______________________

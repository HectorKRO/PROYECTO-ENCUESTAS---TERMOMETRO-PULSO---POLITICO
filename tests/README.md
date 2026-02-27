# Tests y Validación — PulsoElectoral v3.0

## Archivos de Test

### 1. `v3.0_validate.sql` (CRÍTICO)
**Ejecutar antes de cualquier deploy a producción**

Suite de 11 tests automatizados que validan:
- Columnas multi-tenant existen
- Foreign keys válidas
- RLS habilitado
- Políticas de aislamiento correctas
- Índices creados
- Datos geográficos cargados
- Integridad de datos

**Uso:**
```sql
\i tests/v3.0_validate.sql
```

**Resultado esperado:** ✅ TODOS LOS TESTS PASARON (11/11)

---

### 2. `verify_deploy.sql` (POST-DEPLOY)
**Ejecutar después de completar el deploy**

Valida que el deploy fue exitoso verificando:
- RLS activo en tablas críticas
- Columnas multi-tenant presentes
- Umbral de duración correcto (30s)
- Organizaciones y municipios disponibles
- Vistas creadas
- Funciones de auditoría activas

**Uso:**
```sql
\i tests/verify_deploy.sql
```

**Resultado esperado:** 10/10 tests pasaron

---

### 3. `setup_staging.sql` (STAGING)
**Crear ambiente de prueba con datos demo**

Crea:
- 2 organizaciones de prueba (Partido Verde, Movimiento Ciudadano)
- Municipios asignados
- Campañas de prueba
- Instrucciones para crear usuarios

**Uso:**
```sql
\i tests/setup_staging.sql
```

**Nota:** Después de ejecutar, crear usuarios manualmente en Supabase Auth y ejecutar la sección 5 con UUIDs reales.

---

## Página de Testing Web

### `/test/v3.0` (Frontend)

URL: `https://tu-app.com/test/v3.0`

Permite:
- Visualizar contexto actual (organización, municipios, usuario)
- Cambiar de municipio interactivamente
- Ejecutar tests básicos
- Navegar a componentes principales

**Uso:** Acceder después de login para verificar que el contexto multi-municipio carga correctamente.

---

## Flujo de Validación

### Pre-Deploy (en Staging)

1. **Ejecutar SQL:** `v3.0_validate.sql`
2. **Crear datos:** `setup_staging.sql`
3. **Crear usuarios:** Manualmente en Supabase Auth
4. **Asignar membresías:** Sección 5 de `setup_staging.sql`
5. **Test E2E:** Usar página `/test/v3.0` y validar componentes

### Post-Deploy (en Producción)

1. **Ejecutar SQL:** `verify_deploy.sql`
2. **Smoke tests:** Login, Dashboard, WarRoom, Formulario
3. **Verificar encuestas:** Confirmar que llegan con contexto multi-tenant
4. **Monitorear:** Errores y métricas

---

## Solución de Problemas

### Tests fallan con "columna no existe"

Verificar que se ejecutaron los scripts SQL v3.0 en orden correcto:
1. `01_catalogo_geografico.sql`
2. `02_organizaciones.sql`
3. `03_respuestas_contexto.sql`
4. `04_rls_unificado.sql`
5. `05_vistas_corregidas.sql`

### "No hay organizaciones" o "No hay municipios"

Ejecutar `setup_staging.sql` para crear datos de prueba.

### "Falta política RLS"

Verificar que `04_rls_unificado.sql` se ejecutó correctamente.

---

## Contacto

Para problemas con los tests, contactar al equipo de desarrollo.

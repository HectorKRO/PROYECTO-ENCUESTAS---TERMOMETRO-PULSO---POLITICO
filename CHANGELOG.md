# 📋 Changelog — PulsoElectoral

> Sistema de Encuestas Políticas para Atlixco, Puebla  
> Historial de cambios desde v2.2 (fixed)

---

## 🏷️ Convenciones de Versionado

| Prefijo | Significado |
|---------|-------------|
| **MAJOR** (X.0.0) | Cambios que rompen compatibilidad hacia atrás |
| **MINOR** (x.X.0) | Nuevas funcionalidades, compatibles hacia atrás |
| **PATCH** (x.x.X) | Correcciones de bugs, compatibles hacia atrás |
| **FIX** | Corrección de error identificado |

---

## 📊 Resumen de Versiones

| Versión | Fecha | Estado | Cambios Principales |
|---------|-------|--------|---------------------|
| **v3.1.0** | 2026-02-27 | 🚧 Parche | NavBar global, gestión campañas/candidatos, fixes P1-P4 |
| **v3.0.1** | 2026-02-27 | ✅ Estable | Fix crítico login loop: createBrowserClient + bienvenido rewrite |
| **v3.0.0** | 2026-02-27 | 🚀 Deploy | Deploy v3.0 multi-municipio, superadmin setup, SQL v3.0 |
| **v2.5.1** | 2026-02-26 | ✅ Estable | Fixes de auditoría de equipo (A1-A3, B2, C2, M1-M6) |
| **v2.5.0** | 2026-02-26 | ✅ Estable | Sistema de autenticación email+password |
| **v2.4.1** | 2026-02-26 | ✅ Estable | Fixes críticos War Room (memory leaks, UX) |
| **v2.4.0** | 2026-02-25 | ✅ Estable | Catálogo de colonias INE (417 colonias), War Room v1 |
| **v2.3.0** | 2026-02-25 | ✅ Estable | Secciones electorales 68 oficiales, campos v2.3 |
| **v2.2.x** | 2026-02-24 | 🏛️ Base | Versión inicial de referencia |

---

## 🚧 v3.1.0 (2026-02-27) — "NavBar Global y Gestión de Campañas"

**Estado:** ✅ Auditado y corregido  
**Contexto:** Segundo parche post-deploy. Agrega navegación global consistente, gestión completa de campañas y candidatos, y corrige problemas menores detectados (P1-P4). Auditado: 14 bugs corregidos.

### 🧭 Navegación Global (NavBar)

**Nuevo componente:** `src/components/NavBar.jsx`

- Barra sticky con zIndex: 2000 (mayor que paneles flotantes)
- Logo + links (Dashboard, War Room, Admin) + avatar + logout
- Responsive: menú hamburguesa en móvil
- Modo simple para formulario de encuesta

**Nuevo wrapper:** `src/components/NavBarWrapper.jsx`

- Condicional: no muestra NavBar en /, /login, /bienvenido, /encuesta
- Integrado en `src/app/layout.jsx`

**Alturas estandarizadas:** `src/lib/theme.js`

```javascript
export const NAV_HEIGHT = 56;        // px
export const WARROOM_HEADER = 72;    // px
export const ADMIN_HEADER = 80;      // px
```

### 📋 Gestión de Campañas

**Nuevo:** `src/components/CampanasList.jsx`

- Lista todas las campañas de la organización
- Modal inline para crear nueva campaña
- Botón activar/desactivar campaña
- Navegación a `/admin?campana=UUID`

**Modificado:** `src/app/admin/page.jsx`

- Router condicional: sin `?campana` → CampanasList, con `?campana` → AdminPanel

**SQL:** `sql/v3.1/01_campanas_multitenant.sql`

- Agrega `organizacion_id` a tabla `campanas`
- Crea tabla `candidatos_rivales`
- Políticas RLS actualizadas
- Función `fn_candidatos_reconocimiento()`

### 👥 Gestión de Candidatos

**Nuevo:** `src/components/CandidatosManager.jsx`

- Tabs: Candidatos Principales / Candidatos Rivales
- Crear candidato principal (nombre, cargo, partido, color)
- Crear candidatos rivales (para reconocimiento asistido)
- Activar/desactivar candidatos

**Integrado en:** AdminPanel.jsx (tab "Candidatos")

### 🔧 Cambios en Cascada (Impacto)

| Archivo | Cambio |
|---------|--------|
| `middleware.js` | Agrega `/war-room`, `/perfil` a matcher protegido |
| `useOrganizacion.js` | Expone `signOut()` en el contexto |
| `DashboardPolitico.jsx` | Header sticky con `top: NAV_HEIGHT`, panel lateral ajustado |
| `AdminPanel.jsx` | `minHeight: calc(100vh - NAV_HEIGHT)`, quita sección "Ir a" redundante |
| `WarRoom.jsx` | Altura `calc(100vh - NAV_HEIGHT)`, header fijo `WARROOM_HEADER` |
| `FormularioEncuesta.jsx` | `paddingTop: 44` para mini-header, NavBar simple |
| `perfil/page.jsx` | Elimina botones duplicados (volver/logout), usa `useOrganizacion` |
| `war-room/page.jsx` | Loading usa `calc(100vh - NAV_HEIGHT)` |

### 🐛 Fixes P1-P4

| Fix | Problema | Solución |
|-----|----------|----------|
| P1 | `setCampanaId` declarado pero no usado | Eliminado, usa solo valor inicial |
| P2 | `campanaData` leía `campana.candidato` (mock) | Ahora hace JOIN con tabla `candidatos` |
| P3 | `candidatosRivales` nunca cargaba desde BD | Agregada query a `candidatos_rivales` |
| P4 | `syncLog` era 100% mock | Ahora carga desde `encuestas_pendientes` |

### 🔧 Correcciones de Auditoría (Post-implementación)

#### Bugs Críticos (Build-breaking)

| # | Archivo | Problema | Fix |
|---|---------|----------|-----|
| 1 | `NavBar.jsx` | Faltaba cierre de tag `>` en modo simple | Añadido `>` |
| 2 | `NavBar.jsx` | Faltaba cierre de tag `>` en modo full | Añadido `>` |
| 3 | `AdminPanel.jsx` | Faltaba cierre de tag en header | Añadido `>` |
| 4 | `DashboardPolitico.jsx` | Dos tags sin cierre | Añadidos `>` |
| 5 | `WarRoom.jsx` | Faltaba cierre de tag en header | Añadido `>` |
| 6 | `war-room/page.jsx` | Faltaba cierre de tag en Loading | Añadido `>` |
| 7 | `FormularioEncuesta.jsx` | Botón "Modo Experto" desplazado | Reconstruido en posición correcta |

#### Bugs Importantes (Funcionales)

| # | Archivo | Problema | Fix |
|---|---------|----------|-----|
| 8 | `admin/page.jsx` | `useSearchParams()` sin `<Suspense>` | Agregado wrapper Suspense |
| 9 | `admin/page.jsx` | Doble NavBar (global + explícita) | Eliminada NavBar redundante |
| 10 | `AdminPanel.jsx` | `campana.metaEncuestas` undefined | Corregido a `meta_encuestas` (snake_case) |
| 11 | `AdminPanel.jsx` | `colorPrimario/Secundario` undefined | Usar `candidatoObj?.color_primario` |
| 12 | `AdminPanel.jsx` | `cargo/municipio` undefined | Usar `candidatoObj?.cargo/partido` |
| 13 | `CampanasList.jsx` | Enlace a `/admin/candidatos` inexistente | Reemplazado con mensaje descriptivo |
| 14 | `NavBar.jsx` | Menú móvil nunca visible | Eliminado `display: 'none'` inline, CSS controla visibilidad |

#### Advertencias IDE

| # | Problema | Fix |
|---|----------|-----|
| 15 | `useCallback` importado sin usar | Eliminado import |
| 16 | `candidatosRivales` declarado pero no leído | Variable usada en tab "Candidatos" |
| 17 | `idx` sin usar en `.map()` | Eliminado o renombrado |

---

## 🚀 v3.0.1 (2026-02-27) — "Fix Crítico: Login Loop Resuelto"

**Estado:** ✅ Desplegado en Vercel
**Commits:** `6ba73f6` — fix: createBrowserClient + bienvenido page rewrite
**Contexto:** Durante el primer deploy en producción de v3.0, el flujo de login entraba en un ciclo infinito. El usuario ingresaba credenciales correctas, seleccionaba rol, y el sistema volvía a solicitar el rol repetidamente sin avanzar.

### 🔴 Bug Crítico — Login Loop (Causa Raíz)

#### Problema: `createClient` vs `createBrowserClient`

**Archivo:** `src/lib/supabase.js`

```javascript
// ❌ ANTES — supabase-js clásico, guarda sesión solo en localStorage
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storageKey: 'supabase.auth.token', ... }
});

// ✅ DESPUÉS — SSR client, guarda sesión en cookies (compatible con middleware)
import { createBrowserClient } from '@supabase/ssr';
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**Por qué rompía:** El middleware usa `createServerClient` de `@supabase/ssr`, que lee la sesión desde **cookies HTTP**. El cliente usaba `createClient` de `@supabase/supabase-js`, que persiste la sesión en **localStorage**. El middleware nunca encontraba la sesión → redirigía a `/login` → loop infinito.

**Lección:** En proyectos Next.js con middleware de Supabase, **siempre usar `createBrowserClient`** en el cliente y **`createServerClient`** en el servidor/middleware. Son el par correcto de la librería `@supabase/ssr`.

#### Problema: `bienvenido/page.jsx` con dependencia de Provider

**Archivo:** `src/app/bienvenido/page.jsx` — Reescritura completa

```jsx
// ❌ ANTES — Dependía de WelcomePopup y useOrganizacion (state con race conditions)
// El provider persistía estado de la página /login hacia /bienvenido
// isInitialized=true pero organizacion=null → redirigía a /login antes de cargar

// ✅ DESPUÉS — Lee sesión directamente, sin depender del provider
const init = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) { router.replace('/login'); return; }
  // Muestra bienvenido, redirige según rol guardado en localStorage
  setTimeout(() => {
    const rol = localStorage.getItem('rol_seleccionado');
    switch (rol) {
      case 'encuestador': router.replace('/encuesta');  break;
      case 'analista':    router.replace('/dashboard'); break;
      case 'admin':
      case 'superadmin':  router.replace('/admin');     break;
      default:            router.replace('/dashboard');
    }
  }, 2500);
};
```

**Por qué rompía:** `OrganizacionProvider` en el layout persiste a través de navegaciones. Al llegar a `/bienvenido`, el provider tenía `isInitialized=true` (estado de la página anterior), pero `organizacion=null` porque `loadOrganizacion` no había completado. `WelcomePopup` veía esa condición y redirigía a `/login`. Solución: usar `supabase.auth.getSession()` directo, sin depender del estado del provider.

#### Problema: Race condition en `WelcomePopup.jsx` (fix parcial)

**Archivo:** `src/components/auth/WelcomePopup.jsx`

```javascript
// ❌ ANTES — El guard no incluía loading
if (!isInitialized || timersStartedRef.current) return;

// ✅ DESPUÉS — Esperar que loading sea false también
const { user, organizacion, municipioActual, rol, isInitialized, loading } = useOrganizacion();
if (!isInitialized || loading || timersStartedRef.current) return;
// Dependency array actualizado:
}, [isInitialized, loading, user?.id, router]);
```

**Nota:** Este fix fue insuficiente por sí solo (el bug real era `createClient` vs `createBrowserClient`), pero es correcto para evitar redirects prematuros cuando `isInitialized=true` pero `loading=true`.

### 🟡 Fix — ESLint Missing Dependency en `useOrganizacion.js`

**Archivo:** `src/hooks/useOrganizacion.js`

```javascript
// ❌ ANTES — ESLint react-hooks/exhaustive-deps warning
// Dentro del useEffect de onAuthStateChange se usaba user?.id
// pero añadir 'user' al dep array recrearía la suscripción en cada update

// ✅ DESPUÉS — Patrón ref para capturar valor sin dep frágil
const currentUserIdRef = useRef(null);
useEffect(() => { currentUserIdRef.current = user?.id ?? null; }, [user]);
// Luego usar currentUserIdRef.current dentro del handler
```

**Lección:** Cuando necesitas el valor actual de una variable dentro de un `useEffect` que no debe re-ejecutarse al cambiar esa variable, capturarlo en un `useRef` sincronizado.

### 🗑️ Dependencia Eliminada — `xlsx` (Vulnerabilidad de Seguridad)

- **Paquete:** `xlsx@0.18.5`
- **Severidad:** Alta (arbitrary code execution al parsear archivos maliciosos)
- **Acción:** Eliminado de `package.json` (no estaba en uso en ningún archivo del proyecto)
- **Resultado:** `npm audit` de 1 vulnerabilidad → 0 vulnerabilidades

---

## 🚀 v3.0.0 (2026-02-27) — "Deploy Multi-Municipio + Superadmin Setup"

**Estado:** 🚀 Primer deploy en producción de v3.0
**Contexto:** Primera ejecución de los scripts SQL v3.0 y configuración del usuario fundador superadmin.

### SQL v3.0 — Orden Correcto de Ejecución

**Descubrimiento crítico:** Los scripts v3.0 en `sql/v3.0/` son **migraciones** sobre el schema v2.x, **no instalaciones fresh**. El primer script a ejecutar es el schema histórico.

```text
ORDEN OBLIGATORIO:
1. sql/historico/schema.sql        ← Base v2.x (SIEMPRE PRIMERO)
2. sql/v3.0/01_catalogo_geografico.sql
3. sql/v3.0/02_organizaciones.sql
4. sql/v3.0/03_respuestas_contexto.sql
5. sql/v3.0/04_rls_unificado.sql
6. sql/v3.0/05_vistas_corregidas.sql
7. sql/v3.0/00_validate_migration.sql  ← Solo para verificar (correr AL FINAL)
8. sql/v3.0/07_setup_superadmin.sql
```

**Errores encontrados al ejecutar en orden incorrecto:**

| Error | Causa | Solución |
|-------|-------|----------|
| `relation "estados" does not exist` | `00_validate_migration.sql` ejecutado antes que los otros | Solo ejecutar después de todos los demás |
| `No se encontró la tabla respuestas` (guard de 01) | `historico/schema.sql` no ejecutado primero | Ejecutar schema base antes que cualquier migración v3.0 |
| `invalid input syntax for type uuid: '<UUID-SUPERADMIN>'` | Placeholder no reemplazado en `07_setup_superadmin.sql` | Reemplazar `<UUID-SUPERADMIN>` y `<EMAIL-SUPERADMIN>` antes de ejecutar |

### Script de Superadmin — `sql/v3.0/07_setup_superadmin.sql`

**Creado:** Template con placeholders para configurar al usuario fundador.

```sql
-- Template (reemplazar antes de ejecutar en Supabase SQL Editor):
-- <UUID-SUPERADMIN>  → UUID del usuario en auth.users
-- <EMAIL-SUPERADMIN> → Email del superadmin

UPDATE organizaciones SET nombre = 'PulsoElectoral', email_contacto = '<EMAIL-SUPERADMIN>';
INSERT INTO organizacion_miembros (organizacion_id, user_id, rol)
  SELECT id, '<UUID-SUPERADMIN>', 'superadmin' FROM organizaciones LIMIT 1
  ON CONFLICT DO NOTHING;
SELECT 'Superadmin configurado correctamente' AS resultado;
```

**Seguridad:** El archivo en git contiene solo placeholders genéricos. El UUID y email reales nunca se commitean.

### Hallazgos de Arquitectura

| Concepto | Detalle |
|----------|---------|
| **Middleware scope** | Solo protege `/dashboard/:path*` y `/admin/:path*`. `/bienvenido` y `/login` son públicos. |
| **Cookies vs localStorage** | `@supabase/ssr` ↔ cookies. `@supabase/supabase-js` ↔ localStorage. Nunca mezclar. |
| **Provider persistence** | `OrganizacionProvider` en el root layout persiste estado entre páginas — tener cuidado con race conditions al navegar. |
| **RLS sin políticas** | Si `04_rls_unificado.sql` no se ejecuta, RLS está habilitado pero sin políticas → todas las queries devuelven vacío sin error. |

---

## 🚀 v2.5.8 (2026-02-26) — "Roadmap de Ejecución v3.0 Corregido"

**Estado:** ✅ Roadmap post-auditoría con 24 correcciones aplicadas  
**Documento:** `ROADMAP_EJECUCION_v3.0_CORREGIDO.md`

### Correcciones al Roadmap (E1-E24)

#### Fase 0 — Preparación
| ID | Error | Corrección |
|----|-------|------------|
| E1 | `pg_dump` sin `--schema=public` exporta schemas internos | Agregado flag `--schema=public` |
| E2 | Exportar solo respuestas rompe FKs | Exportar todas las tablas referenciadas con `--table=` |
| E3 | Contraseña en texto plano en bash | Usar `PGPASSWORD` o `.pgpass` |
| E4 | `auth.users` no se exporta | Documentar creación manual de 3 usuarios de prueba en staging |
| E5 | Variables `.env.staging` no definidas | Listar explícitamente: `SUPABASE_URL`, `ANON_KEY` |

#### Fase 1 — Migración SQL
| ID | Error | Corrección |
|----|-------|------------|
| E6 | `tests/v3.0_validate.sql` referenciado pero no existe | Agregado como tarea crear el archivo en Fase 0 |
| E7 | Guards de scripts no documentados | Explicar qué hacer si `RAISE EXCEPTION` ocurre (re-ejecutar) |
| E8 | No se indica que scripts son idempotentes | Documentar explícitamente que pueden re-ejecutarse |

#### Fase 2 — Integración
| ID | Error | Corrección |
|----|-------|------------|
| E9 | Bugs de auditoría no agendados | **Nueva Fase 2a** dedicada a corregir U2-U8 |
| E10 | `Header.jsx` no existe | Crear componente Header desde cero (tarea explícita) |
| E11 | WarRoom subestimado | Asignar día completo (6-8 horas), reescribir hook completamente |
| E12 | Filtro por organizacion_id redundante | RLS ya lo hace, NO filtrar en frontend |
| E13 | Mecanismo de municipio_id en formulario no definido | Especificar: leer de tabla campanas al cargar |
| E14 | Middleware existe pero no protege por rol | Documentar que protege por auth, no por rol (comportamiento aceptado) |

#### Fase 3 — Testing
| ID | Error | Corrección |
|----|-------|------------|
| E15 | Test T6 fallará con bug U7 | Corregir U7 en Fase 2a antes de testing |
| E16 | Tooling de performance no definido | Especificar: Chrome DevTools Network, Vercel Analytics |
| E17 | Setup de encuesta anónima no definido | Documentar requisitos: campaña activa + URL pública |

#### Fase 4 — Deploy
| ID | Error | Corrección |
|----|-------|------------|
| E18 | "Desactivar RLS" es extremadamente peligroso | **Eliminado del rollback plan**. Usar restore backup o revertir scripts específicos |
| E19 | Orden de deploy crea ventana de incompatibilidad | **SQL primero → Validación → Frontend deploy solo si SQL pasó** |
| E20 | UPDATE masivo puede tomar más de 30 min | Agregar estimación de tiempo según volumen de datos |
| E21 | Service Worker cache no invalidado | Documentar incrementar versión en SW |

#### Estructurales
| ID | Error | Corrección |
|----|-------|------------|
| E22 | Fase 2 no incluye corrección de bugs | **Fase 2a creada explícitamente** para U2-U8 |
| E23 | `tests/v3.0_validate.sql` no existe | Agregar creación del archivo como tarea obligatoria |
| E24 | Solo 1 tester listado, se necesitan 2 orgs | Actualizar recursos: 2 testers en orgs diferentes |

### Cambios de Mayor Impacto

1. **Nueva Fase 2a:** Día dedicado exclusivamente a corregir bugs U2-U8 antes de integración
2. **Rollback plan corregido:** Eliminada opción "desactivar RLS", reemplazada por restore backup
3. **Orden de deploy corregido:** SQL → Validación → Frontend (nunca frontend antes de SQL validado)
4. **Duración ajustada:** 13-15 días (antes 12), considerando complejidad real de WarRoom

### Documentos Actualizados
- `ROADMAP_EJECUCION_v3.0_CORREGIDO.md` — Roadmap final listo para ejecución

---

## 🚀 v2.5.7 (2026-02-26) — "Correcciones Post-Implementación v3.0"

**Estado:** ✅ Todos los errores de auditoría corregidos  
**Cambios:** 13 correcciones aplicadas tras auditoría de código (U1-U13)

### Resumen de Correcciones

| ID | Archivo | Error | Corrección |
|----|---------|-------|------------|
| **U1** | `useMunicipioData.js` | `@tanstack/react-query` no instalado | Reescrito con `useEffect` nativo, sin dependencias externas |
| **U2** | `useOrganizacion.js` | Fetch doble con `onAuthStateChange` | Agregado `initialLoadDoneRef` para evitar carga duplicada |
| **U3** | `app/page.jsx` | `e.target` vs `e.currentTarget` | Cambiado a `e.currentTarget` para hover en Link |
| **U4** | `useOrganizacion.js` | Sin guard de concurrencia | Agregado `isFetchingRef` para prevenir llamadas paralelas |
| **U5** | `bienvenido/page.jsx` + `WelcomePopup.jsx` | Spinner siempre visible + duplicación keyframes | Spinner condicional + keyframes unificados en styled-jsx |
| **U6** | `WelcomePopup.jsx` | Timers reiniciaban con cambios de estado | Usar `useRef` para timers y flag `timersStartedRef` |
| **U7** | `useAuthFlow.js` | `rolSeleccionado` código muerto | Eliminado estado innecesario |
| **U8** | `useAuthFlow.js` + `LoginForm.jsx` | Email no trimeado | Agregado `.trim()` al email antes de autenticar |
| **U9** | `useMunicipioData.js` | Guard redundante | Mantenido (inofensivo, mejora robustez) |
| **U10** | `LoginForm.jsx` | Check `if (!rol)` redundante | Mantenido (claridad y seguridad extra) |
| **U11** | `WelcomePopup.jsx` | Avatar vacío si email es '' | Mejorado fallback a 'U' y validación de string vacío |
| **U12** | `RoleSelector.jsx` | Superadmin no tenía opción | Agregada opción "Super Administrador" con icono 👑 |
| **U13** | `layout.jsx` | ServiceWorker fuera del Provider | Documentado como intencional (no necesita contexto) |

### Estado de Archivos Corregidos

| Archivo | Estado | Errores Corregidos |
|---------|--------|-------------------|
| `useOrganizacion.js` | ✅ Estable | U2, U4 |
| `useMunicipioData.js` | ✅ Estable | U1, U9 |
| `useAuthFlow.js` | ✅ Estable | U7, U8 |
| `LoginForm.jsx` | ✅ Estable | U8, U10 |
| `RoleSelector.jsx` | ✅ Estable | U12 |
| `WelcomePopup.jsx` | ✅ Estable | U6, U11 |
| `bienvenido/page.jsx` | ✅ Estable | U5 |
| `app/page.jsx` | ✅ Estable | U3 |

### Notas Técnicas
- Eliminada dependencia de `@tanstack/react-query` (no estaba en package.json)
- Todos los hooks ahora usan patterns nativos de React
- Guards de concurrencia implementados para evitar race conditions
- Manejo de errores robusto en autenticación

---

## 🚀 v2.5.6 (2026-02-26) — "Frontend React v3.0 Implementado"

**Estado:** ✅ Frontend React implementado en el proyecto  
**Cambios:** Todos los componentes, hooks y páginas del sistema multi-municipio creados

### Archivos Creados/Modificados

#### Hooks (src/hooks/)
| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `useOrganizacion.js` | 174 | Context provider con auth state, rol, municipios |
| `useMunicipioData.js` | 49 | Data fetching de secciones/colonias por municipio |
| `useAuthFlow.js` | 45 | Flujo de login/logout con redirección por rol |

#### Componentes de Auth (src/components/auth/)
| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `RoleSelector.jsx` | 70 | Selector de 3 roles (encuestador, analista, admin) |
| `WelcomePopup.jsx` | 168 | Popup fading con saludo personalizado |
| `LoginForm.jsx` | 167 | Formulario login glassmorphism |

#### Páginas (src/app/)
| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `page.jsx` (landing) | 166 | Landing page con hero, features, CTA |
| `login/page.jsx` | 21 | Página login con gradiente de fondo |
| `bienvenido/page.jsx` | 27 | Página intermediaria con popup fading |
| `layout.jsx` | 38 | Layout con OrganizacionProvider |

### Características Implementadas

✅ **Sistema de Roles de 3 Niveles**
- Encuestador → Formulario
- Analista → Dashboard
- Admin → Panel de administración

✅ **Popup de Bienvenida Fading**
- Iniciales del usuario (avatar)
- Nombre personalizado
- Organización y municipio
- Auto-redirección en 3.5 segundos

✅ **Diseño Glassmorphism Coherente**
- Paleta verde-dorada (#07100a, #c9a227)
- Cards con backdrop-filter blur
- Gradientes sutiles
- Espaciado generoso (hierarchy visual)

✅ **Multi-Municipio Ready**
- Hook useMunicipioData para filtrar datos
- Selector de municipio (cuando aplica)
- LocalStorage para persistir selección

### Total de Código Nuevo
- **~1,000 líneas** de React/JavaScript
- **10 archivos** nuevos/modificados
- **100% coherente** con theme.js existente

---

## 🚀 v2.5.5 (2026-02-26) — "Audit Frontend & Staging v3.0"

**Estado:** ✅ Auditoría completada de documentación frontend y staging  
**Cambios:** 16 errores corregidos en guías de implementación

### 🔍 Correcciones Frontend (Audit FE)

| ID | Archivo | Bug | Corrección |
|----|---------|-----|------------|
| **FE-1** | `useMunicipioData.js` | Filtro `.eq('activa', true)` en `secciones_electorales` — columna no existe | Eliminado filtro `activa` de secciones; mantenido solo en colonias donde sí existe |
| **FE-2** | `useOrganizacion.js` | `esSuperadmin: organizacion?.rol` — `rol` está en `organizacion_miembros`, no en `organizaciones` | Corregido: extraer `rol` desde `membresias[0].rol` en lugar de objeto organización |
| **FE-3** | `useOrganizacion.js` | Sintaxis `organizaciones:id(...)` inválida en PostgREST | Corregido a sintaxis válida: `organizaciones(id, nombre, ...)` |
| **FE-4** | `useOrganizacion.js` | Sin suscripción a `onAuthStateChange` | Agregado listener para limpiar/recargar en `SIGNED_IN`/`SIGNED_OUT` |
| **FE-5** | `WarRoom.jsx` | Cambio de firma `useWarRoomData(municipioId)` no especificado | Documentado: hook requiere reescritura para aceptar `municipioId` y obtener campañas activas del municipio |
| **FE-6** | `DashboardPolitico.jsx` | `.single()` sin filtrar `organizacion_id` — puede devolver múltiples filas | Agregado filtro `.eq('organizacion_id', org.id)` antes de `.single()` |
| **FE-7** | `AdminPanel.jsx` | `agregarMunicipio()` sin recarga de estado después de insert | Agregada recarga de `municipiosOrg` vía refetch después de insert exitoso |
| **FE-8** | `AdminPanel.jsx` | Límite de municipios validado solo en cliente | Agregada nota de validación server-side requerida en edge function |
| **FE-9** | `useOrganizacion.js` | Sin flag `isInitialized` para prevenir re-renders | Agregado estado `isInitialized` para manejar loading inicial |

### 🔍 Correcciones Staging/Testing (Audit ST)

| ID | Archivo | Bug | Corrección |
|----|---------|-----|------------|
| **ST-1** | `STAGING_TESTING_v3.0.md` | `\i prod_schema_backup.sql` no funciona en Supabase SQL Editor | Corregido: usar copiar/pegar contenido o psql CLI, no meta-comando `\i` |
| **ST-2** | Test T7 | `pg_tables WHERE rowsecurity = true` — columna no existe | Corregido a `pg_class WHERE relname = 'respuestas' AND relrowsecurity = true` |
| **ST-3** | Rollback A | `dropdb postgres / createdb postgres` — no funciona en Supabase Cloud | Corregido: usar Point-in-Time Recovery o Restore from backup en Dashboard |
| **ST-4** | Rollback B | `WHERE organizacion_id IS NULL` inoperante post-migración (NOT NULL constraints) | Corregido: debe hacerse `DROP NOT NULL` primero o usar backup restoration |
| **ST-5** | Test T10 | Verificar por patrón `%municipio%` es frágil | Corregido: verificar índices específicos por nombre exacto |
| **ST-6** | Test suite | Falta test para política `encuesta_publica_insertar_v3` (anon INSERT) | Agregado test específico para política de inserción anónima |
| **ST-7** | Sección 2 | `pg_dump --where=` no existe | Corregido a método alternativo usando `COPY ... WHERE` o exportar tabla completa |

### 📋 Estado de Documentación v3.0

| Documento | Estado | Errores Corregidos |
|-----------|--------|-------------------|
| `FRONTEND_MULTI_MUNICIPIO_v3.0.md` | ✅ Auditado y corregido | 9 errores (2 críticos, 3 altos, 3 medios, 1 bajo) |
| `STAGING_TESTING_v3.0.md` | ✅ Auditado y corregido | 7 errores (2 altos, 4 medios, 1 bajo) |

### 📝 Notas
- Todos los errores de sintaxis SQL y PostgREST corregidos
- Documentación ahora alineada con capacidades reales de Supabase
- Guías de rollback realistas para entorno cloud gestionado

---

## 🚀 v2.5.4 (2026-02-26) — "Audit v3.0 — Correcciones Finales"

**Estado:** ✅ Scripts SQL v3.0 auditados y corregidos  
**Cambios:** 10 correcciones adicionales aplicadas tras auditoría de scripts

### 🔍 Correcciones Audit v3.0

| Archivo | Bug | Corrección |
|---------|-----|------------|
| **02_organizaciones.sql** | B1 | Guard añadido: verifica que `municipios` existe y que `municipio_id=1` (Atlixco) está presente antes de continuar |
| **02_organizaciones.sql** | B3 | `ON CONFLICT DO UPDATE SET nombre/plan` → `DO NOTHING` — protege cambios manuales en re-ejecuciones |
| **03_respuestas_contexto.sql** | C1 | Eliminado `EXCEPTION WHEN others` → `RAISE NOTICE`. Reemplazado por `COUNT(*)` explícito + `RAISE EXCEPTION` si quedan NULLs antes del `ALTER TABLE` |
| **03_respuestas_contexto.sql** | C3 | Guard añadido que verifica `municipios` y `organizaciones` existen al inicio del script |
| **05_vistas_corregidas.sql** | E1 | `COUNT(*)` → `COUNT(r.id)` en todos los denominadores de `v_metricas_por_campana` — evita que campañas vacías muestren 0% en lugar de NULL |
| **06_template_nuevo_municipio.sql** | F1 | Eliminado `\set` (no funciona en Supabase SQL Editor). Template reescrito con `DO $$ DECLARE` para variables |
| **06_template_nuevo_municipio.sql** | F2 | `ON CONFLICT DO UPDATE` → `DO NOTHING` en secciones — evita reasignar secciones existentes a municipio incorrecto |
| **00_validate_migration.sql** | G1 | `Count < 5` demasiado débil → reemplazado por checks de nombre específico: `respuestas_isolation_completa`, políticas en organizaciones |
| **00_validate_migration.sql** | G3 | Añadida verificación explícita de la política anon con mensaje claro "encuestas anónimas BLOQUEADAS" si falta |

### 📋 Estado de Scripts v3.0

| Script | Estado | Bugs Corregidos |
|--------|--------|-----------------|
| `01_catalogo_geografico.sql` | ✅ Estable | - |
| `02_organizaciones.sql` | ✅ Auditado | B1, B3 |
| `03_respuestas_contexto.sql` | ✅ Auditado | C1, C3 |
| `04_rls_unificado.sql` | ✅ Estable | - |
| `05_vistas_corregidas.sql` | ✅ Auditado | E1 |
| `06_template_nuevo_municipio.sql` | ✅ Auditado | F1, F2 |
| `00_validate_migration.sql` | ✅ Auditado | G1, G3 |

### 📝 Notas
- Errores del IDE son falsos positivos del linter T-SQL (SQL Server) sobre sintaxis PostgreSQL válida
- No afectan la ejecución en Supabase

---

## 🚀 v2.5.3 (2026-02-26) — "Revisión de Roadmap Multi-Municipio"

**Estado:** ✅ Revisión completada  
**Cambios:** 16 bugs corregidos en la planificación de arquitectura multi-municipio

### 🔍 Auditoría de Roadmap v3.0

Se realizó revisión exhaustiva del roadmap multi-municipio identificando **16 bugs críticos, altos y de diseño** en los scripts SQL propuestos.

---

### 🚨 Bugs Críticos (Habrían roto la migración)

| # | Fase | Problema | Corrección |
|---|------|----------|------------|
| **1-5** | Fase 1 | Intentar cambiar PK de `secciones_electorales` a compuesta `(seccion, municipio_id)` → cascada de FKs rotas en `colonias` y `respuestas` | **No se cambia la PK.** `municipio_id` se agrega como columna regular. Los números INE son únicos dentro de Puebla |
| **6** | Fase 3 (script 06) | `UPDATE respuestas` leía `c.municipio_id` antes de que existiera en `campanas` → error "column does not exist" | **Reordenado:** `ALTER campanas` → `UPDATE campanas` → `ALTER respuestas` → `UPDATE respuestas` |
| **11** | Fase 4 (scripts 07+08) | Dos políticas `FOR ALL` = `OR` en PostgreSQL, no `AND`. La restricción de municipio era ignorada | **Fusionadas** en una sola política con `AND` explícito entre condición de org y condición de municipio |

---

### ⚠️ Bugs Altos (Datos incorrectos o inseguros)

| # | Problema | Corrección |
|---|----------|------------|
| **9** | Políticas v2.x no se eliminaban → coexistían con las nuevas (comportamiento `OR`) | Script 07 ahora hace `DROP POLICY` de **todas las políticas anteriores** primero |
| **12** | Superadmin sin filtro de org → veía datos de todas las organizaciones | Agregado `AND organizacion_id = respuestas.organizacion_id` a la condición de superadmin |
| **7-8** | Sin validación post-migración, sin prerequisite guards | Agregados `RAISE EXCEPTION` si quedan NULLs; guards `IF NOT EXISTS` al inicio de cada script |

---

### 🔧 Bugs de Diseño (Problemáticos a largo plazo)

| # | Problema | Corrección |
|---|----------|------------|
| **10** | `get_current_organizacion()` — función definida pero nunca usada por ninguna política | **Eliminada** (código muerto) |
| **13** | `v_comparacion_campanas` hacía cross-join N×(N-1) → explosión de filas | **Reemplazada** por `v_metricas_por_campana`; la lógica de comparación se traslada al frontend |
| **15** | Template Fase 6 usaba `ON CONFLICT (seccion, municipio_id)` — constraint que no existe | Corregido a `ON CONFLICT (seccion)` (PK simple sin cambiar) |

---

### 📊 Resumen de Correcciones

| Categoría | Cantidad | Impacto si no se corregía |
|-----------|----------|---------------------------|
| Críticos | 3 (bugs 1-6, 11) | Migración falla, datos corruptos, seguridad comprometida |
| Altos | 3 (bugs 7-9, 12) | Data leakage entre organizaciones, datos inconsistentes |
| Diseño | 3 (bugs 10, 13, 15) | Performance pobre, código muerto, errores de constraint |
| **Total** | **9 únicos** (16 contando grupos) | **Roadmap ahora estable** |

---

### 🏗️ Decisiones Arquitectónicas Corregidas

#### 1. PK de Secciones Electorales
```sql
-- ❌ ANTES (roadmap original)
PRIMARY KEY (seccion, municipio_id)  -- Compuesta, rompe FKs

-- ✅ DESPUÉS (corregido)
PRIMARY KEY (seccion)  -- Simple, mantenemos como está
-- municipio_id es columna regular con índice
```

#### 2. Políticas RLS
```sql
-- ❌ ANTES (dos políticas = OR implícito)
CREATE POLICY "org_isolation" ...;
CREATE POLICY "municipio_restriction" ...;

-- ✅ DESPUÉS (una política = AND explícito)
CREATE POLICY "isolation_completa" ...
  USING (
    organizacion_id IN (SELECT ...)  -- Condición org
    AND 
    (municipio_id IN (SELECT ...) OR rol = 'superadmin')  -- Condición municipio
  );
```

#### 3. Vistas Comparativas
```sql
-- ❌ ANTES (explosión combinatoria)
CREATE VIEW v_comparacion_campanas AS
SELECT c1.*, c2.*, (c1.valor - c2.valor)  -- N*(N-1) filas
FROM campanas c1, campanas c2 WHERE c1.id != c2.id;

-- ✅ DESPUÉS (métricas limpias, comparación en frontend)
CREATE VIEW v_metricas_por_campana AS
SELECT campana_id, municipio_id, COUNT(*), AVG(...)  -- 1 fila por campaña
FROM respuestas GROUP BY campana_id, municipio_id;
-- El frontend hace la comparación matemática
```

---

### 🎯 Estado del Roadmap Corregido

| Componente | Estado |
|------------|--------|
| Arquitectura PK | ✅ Estable (PK simple preservada) |
| Migración de datos | ✅ Secuencia corregida (sin referencias circulares) |
| RLS policies | ✅ Una política unificada con AND |
| Vistas comparativas | ✅ Simplificadas, lógica en frontend |
| Template nuevos municipios | ✅ Constraint correcto |
| Scripts SQL | 🔄 Por escribir con correcciones aplicadas |

---

### 📝 Lecciones Aprendidas

1. **No cambiar PKs existentes** con datos y FKs establecidos → cascada impredecible
2. **Probar migraciones** con datos reales (no solo en BD vacía)
3. **PostgreSQL policies** con múltiples `FOR ALL` = `OR`, no `AND` → revisar siempre
4. **Validación post-migración** obligatoria (`RAISE EXCEPTION` si hay NULLs)
5. **Cross-joins en vistas** pueden explotar silenciosamente → revisar cardinalidad

---

## 🚀 v2.5.2 (2026-02-26) — "Reorganización SQL"

**Estado:** ✅ Producción lista  
**Cambios:** Reorganización completa del directorio `sql/`

### Reestructuración de Archivos SQL

#### Archivos Eliminados (3)
| Archivo | Razón |
|---------|-------|
| `setup_password_auth.sql` | Deprecado — auth por password integrado en `schema.sql` |
| `fix_colonias_tipo_constraint.sql` | Absorbido en `migracion_v2.4_estructura.sql` |
| `migracion_colonias_v2.4.sql` | Reemplazado por separación DDL/Datos |

#### Archivos Creados (3)
| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `migracion_v2.4_estructura.sql` | ~36 | Solo DDL: verificación de tabla + ALTER TABLE para constraint de tipos INE |
| `seed_colonias_atlixco.sql` | ~432 | Solo datos: 417 colonias con `ON CONFLICT DO NOTHING` (idempotente) |
| `EJECUTAR_EN_ORDEN.sql` | ~104 | Guía de ejecución con 3 flujos documentados |

#### Estado Final del Directorio `sql/` (8 archivos)

| # | Archivo | Propósito | Flujo |
|---|---------|-----------|-------|
| 1 | `EJECUTAR_EN_ORDEN.sql` | 📋 Guía de orden de ejecución | Documentación |
| 2 | `schema.sql` | 🏗️ Esquema base completo | Obligatorio |
| 3 | `setup_admin_user.sql` | 👤 Crear admin inicial | Setup 1 vez |
| 4 | `migracion_v2.3.sql` | ⬆️ Upgrade v2.2 → v2.3 | Condicional |
| 5 | `migracion_v2.4_fix_colonias.sql` | 🛠️ Crear tabla colonias | Condicional |
| 6 | `migracion_v2.4_estructura.sql` | 🔧 Constraint tipos INE | Upgrade v2.4 |
| 7 | `seed_colonias_atlixco.sql` | 🌎 417 colonias (datos) | Post-estructura |
| 8 | `fix_supabase_security_linter.sql` | 🔒 Security fixes | Emergencia |
| 9 | `alertas_supabase.sql` | 🔔 Sistema de alertas | Opcional |

### Flujos Documentados en `EJECUTAR_EN_ORDEN.sql`

1. **Instalación Nueva** — Para BD vacía
2. **Upgrade desde v2.2** — Migración completa de estructura antigua
3. **Upgrade desde v2.3** — Solo cambios de v2.4 en adelante

### Beneficios de la Reorganización

- ✅ **Separación DDL/Datos**: Estructura y datos independientes
- ✅ **Idempotencia**: Todos los scripts pueden ejecutarse múltiples veces sin error
- ✅ **Claridad**: Guía única de ejecución (`EJECUTAR_EN_ORDEN.sql`)
- ✅ **Mantenible**: 8 archivos vs 10, responsabilidades claras
- ✅ **Escalable**: Base lista para agregar más municipios

---

## 🚀 v2.5.1 (2026-02-26) — "Release Candidate 1"

**Estado:** ✅ Producción lista  
**Cambios:** 13 fixes de auditoría interna aplicados

### Issues Resueltos

#### 🔴 C2 — Sincronización Offline Automática
- **Archivo:** `src/app/sw-register.jsx`
- **Cambio:** Agrega `window.addEventListener('online', handleOnline)`
- **Impacto:** Las encuestas offline se sincronizan automáticamente al recuperar conexión a internet
- **Antes:** Requería interacción manual del usuario
- **Después:** Sincronización transparente en background

#### 🔴 A1 — Precisión GPS Mejorada
- **Archivo:** `src/components/FormularioEncuesta.jsx`
- **Cambio:** `maximumAge` GPS cambiado de `60000ms` → `10000ms`
- **Impacto:** Coordenadas de más de 10 segundos ya no se aceptan (mayor precisión de ubicación)

#### 🔴 A2 — Rango de Validación Corregido
- **Archivo:** `src/app/api/sync-offline/route.js`
- **Cambio:** Rango de `intencion_voto` y `simpatia` cambiado de `1-5` → `0-5`
- **Impacto:** El valor 0 ("No responde") ya no falla la validación
- **Nota:** Antes rechazaba encuestas legítimas con "No responde"

#### 🔴 A3 — Prevención de Duplicados
- **Archivo:** `src/lib/supabase.js`
- **Cambio:** Agrega flag `_syncInProgress` con bloqueo `try/finally`
- **Impacto:** Previene registros duplicados por sincronizaciones simultáneas
- **Escenario:** Usuario con conexión intermitente que hace múltiples clicks

#### 🔵 B2 — Magic Numbers → Constantes
- **Archivo:** `src/components/FormularioEncuesta.jsx`
- **Cambio:** Magic numbers extraídos a constantes nombradas
- **Constantes nuevas:**
  ```javascript
  GPS_TIMEOUT_MS     = 15000  // Tiempo máximo esperando señal
  GPS_MAX_AGE_MS     = 10000  // Solo coordenadas de máx 10s atrás
  GPS_RETRY_DELAY_MS = 3000   // Espera entre reintentos
  GPS_MAX_RETRIES    = 2      // Intentos máximos
  ```

#### 🟡 M1 — Lazy Initialization campanaId
- **Archivo:** `src/components/AdminPanel.jsx`
- **Cambio:** `campanaId` se lee del URL en el estado inicial (lazy initializer)
- **Impacto:** Elimina el doble-render inicial
- **Antes:** `useState(null)` + `useEffect` que actualizaba → 2 renders
- **Después:** `useState(() => leerURL())` → 1 render

#### 🟡 M2 — Condición de ID Real Clarificada
- **Archivo:** `src/components/AdminPanel.jsx`
- **Cambio:** Supabase solo se llama si el ID contiene `-` (formato UUID real)
- **Impacto:** Evita llamadas a Supabase con IDs de mock (números enteros)
- **Lógica:** `typeof id === 'string' && id.includes('-')`

#### 🟡 M3 — Umbral de Duración Reducido
- **Archivo:** `src/app/api/sync-offline/route.js`
- **Cambio:** Umbral `duracion_segundos` bajado de `< 45` → `< 30` segundos
- **Impacto:** Encuestadores expertos ya no son rechazados por velocidad legítima
- **Nota:** 45s era demasiado restrictivo para usuarios experimentados

#### 🟡 M4 — UI de Errores Mejorada
- **Archivo:** `src/components/AdminPanel.jsx`
- **Cambio:** `alert()` reemplazado por `setError(...)`
- **Impacto:** El error aparece en el banner de UI existente y se limpia a los 5s
- **Antes:** Alert nativo del navegador (UX pobre)
- **Después:** Banner integrado en el diseño

#### 🟡 M5 — Escape CSV Implementado
- **Archivo:** `src/lib/exportData.js` (ya existía, consolidado)
- **Nota:** Función `escapeCSV()` ya estaba implementada en v2.4.x

#### 🟡 M6 — Import Estático
- **Archivo:** `src/lib/exportData.js`
- **Cambio:** `await import('./supabase')` convertido a import estático al inicio
- **Impacto:** Elimina delay en exportación de datos
- **Antes:** Import dinámico causaba micro-delay
- **Después:** Import estático, código inmediatamente disponible

---

## 🚀 v2.5.0 (2026-02-26) — "Autenticación Robusta"

**Estado:** ✅ Producción lista  
**Commits:** `75bcb27` — feat: cambiar sistema de autenticación de Magic Link a email+password

### Cambios Principales

#### Sistema de Autenticación Refactorizado
- **Motivación:** Magic Links tenían problemas de entrega de emails y UX inconsistente
- **Nuevo sistema:** Email + Password tradicional
- **Archivos afectados:**
  - `src/app/login/page.jsx` — UI de login con password
  - `src/lib/supabase.js` — Helpers de auth actualizados
  - `sql/setup_password_auth.sql` — Nuevo script de configuración
  - `sql/setup_admin_user.sql` — Setup de usuario admin inicial

#### Seguridad
- Hash de passwords gestionado por Supabase Auth
- Políticas RLS actualizadas para soportar ambos métodos
- Rate limiting en endpoints de auth

---

## 🚀 v2.4.1 (2026-02-26) — "War Room Estable"

**Estado:** ✅ Producción lista  
**Documentación:** `Docs/WAR_ROOM_FIXES_v2.4.1.md`

### 🚨 Fixes Críticos (2)

#### 1. Memory Leak en Fetch GeoJSON
- **Archivo:** `src/components/WarRoom.jsx`
- **Problema:** Fetch sin AbortController causaba actualizaciones en componente desmontado
- **Solución:** Implementado `AbortController` con cleanup

#### 2. Loading State Bloqueante
- **Archivo:** `src/components/WarRoom.jsx`
- **Problema:** `if (loading) return <div>...</div>` reemplazaba toda la UI
- **Solución:** Overlay semitransparente que permite ver contenido mientras carga

### ⚠️ Fixes de Alto Impacto (6)

#### 3. Legend Recreado en Cada Render
- Componente memoizado + estilos extraídos a constantes

#### 4. StatsPanel Callbacks sin Memoizar
- Todos los handlers con `useCallback`

#### 5. CSV Export sin Escape
- Función `escapeCSV()` implementada para datos con comas

#### 6. Mapa de Comparación Incompleto
- Agregado GeoJSON con `geoDataWithStats2` para modo comparación

#### 7. Estado no Limpiado al Cambiar Campaña
- `setData(null)` en validación de campaña

#### 8. Errores No Mostrados en UI
- Componente de error visible en el mapa

### 🔧 Fixes de Medio Impacto (4)

- Handlers inline → `useCallback`
- Supabase sin timeout → `fetchWithTimeout()` de 10s
- Sin feedback de actualización → Indicador visual
- Objetos style inline → Constantes extraídas

---

## 🚀 v2.4.0 (2026-02-25) — "Atlixco Territorial"

**Estado:** ✅ Producción lista  
**Documentación:** `Docs/WAR_ROOM_GUIDE.md`

### Nuevas Funcionalidades

#### 🗺️ War Room (Sala de Guerra)
- Mapa coroplético interactivo de las 68 secciones electorales
- Visualización por intención de voto (colores: verde → rojo)
- Drill-down por colonias (417 colonias INE)
- Modo comparación lado a lado de dos campañas
- Exportación de CSV por sección y colonia
- Heatmap de densidad de encuestas

#### 🏘️ Catálogo de Colonias INE
- **Archivo:** `sql/migracion_colonias_v2.4.sql`
- **Total:** 417 colonias oficiales del INE
- **Campos:** nombre, seccion_id, tipo, codigo_postal
- **Constraint:** Tipos validados (COLONIA, FRACCIONAMIENTO, PUEBLO, etc.)

### Base de Datos

#### Nueva Tabla: `colonias`
```sql
CREATE TABLE colonias (
  id UUID PRIMARY KEY,
  nombre TEXT NOT NULL,
  seccion_id TEXT REFERENCES secciones_electorales(seccion),
  tipo TEXT CHECK (tipo IN ('COLONIA', 'FRACCIONAMIENTO', ...)),
  codigo_postal TEXT,
  UNIQUE(nombre, seccion_id)
);
```

#### Nueva Vista: `v_resultados_por_colonia`
```sql
-- Resultados agregados por colonia para el War Room
```

#### RLS para Colonias
```sql
-- Lectura pública (catálogo)
CREATE POLICY "colonias_lectura_publica" ON colonias
  FOR SELECT TO anon, authenticated USING (true);
```

### Componentes Nuevos
- `src/components/WarRoom.jsx` — Componente principal del mapa
- `src/app/war-room/page.jsx` — Página Next.js
- `public/data/atlixco_secciones.geojson` — Polígonos GeoJSON

---

## 🚀 v2.3.0 (2026-02-25) — "Estructura Oficial"

**Estado:** ✅ Producción lista  
**Migración:** `sql/migracion_v2.3.sql`

### Cambios Críticos

#### 1. Secciones Electorales — Estructura Corregida
- **Antes:** ID numérico autoincremental (SERIAL)
- **Después:** `seccion` TEXT como PRIMARY KEY (número INE oficial)
- **Total:** 68 secciones oficiales INE (0154-0221)
- **Eliminadas:** Secciones fantasma 0225, 0228, 0229 (no existen en INE)

#### 2. Respuestas — FK Actualizada
- **Cambio:** `respuestas.seccion_id` de `INT` → `TEXT`
- **Impacto:** Referencia directa al número de sección INE
- **Padding:** IDs numéricos convertidos con LPAD (4 dígitos)

### Nuevos Campos (Análisis Político Avanzado)

```sql
-- Participación electoral
participacion_anterior TEXT CHECK (IN ('si','no','ns'))

-- Identificación partidista
identificacion_partido TEXT

-- Contacto para seguimiento
whatsapp_contacto TEXT
consentimiento_contacto BOOLEAN DEFAULT false

-- Evidencia fotográfica
foto_evidencia_url TEXT
```

### Vistas Actualizadas

#### `v_resultados_por_seccion`
- Actualizada para usar `seccion_id` como TEXT
- Incluye JOIN con `secciones_electorales`

#### `v_demograficos`
- Agregados campos nuevos a la agregación

#### `v_contactos_seguimiento`
- Nueva vista para exportar contactos con consentimiento

### Índices de Performance

```sql
-- WhatsApp para campañas de seguimiento
CREATE INDEX idx_respuestas_whatsapp ON respuestas(whatsapp_contacto) 
  WHERE consentimiento_contacto = true;

-- Agrupación por partido
CREATE INDEX idx_respuestas_partido ON respuestas(identificacion_partido);

-- Índice compuesto actualizado para TEXT
CREATE INDEX idx_respuestas_campana_seccion ON respuestas(campana_id, seccion_id)
  WHERE completada = true;
```

---

## 🏛️ v2.2.x — "Punto de Partida"

**Fecha:** 2026-02-24  
**Estado:** Versión base de referencia

### Características Implementadas

#### Sistema Base
- ✅ Formulario de encuestas en campo
- ✅ Dashboard analítico con KPIs
- ✅ Sincronización offline básica
- ✅ Autenticación OTP (Magic Links)
- ✅ Exportación CSV
- ✅ PWA con Service Worker

#### Estructura de Datos
- Tablas: `candidatos`, `campanas`, `encuestadores`, `respuestas`
- Secciones: 70 aprox (con algunas incorrectas)
- Campos base de encuesta: demográficos, reconocimiento, intención, simpatía

### Limitaciones Conocidas (resueltas en versiones posteriores)

| Issue | Descripción | Fix en |
|-------|-------------|--------|
| Secciones incorrectas | 0225, 0228, 0229 no existen en INE | v2.3 |
| seccion_id numérico | Desincronización con catálogo INE | v2.3 |
| Sin catálogo de colonias | Colonias ingresadas como texto libre | v2.4 |
| Sin mapa territorial | Solo datos tabulares | v2.4 |
| Magic Links | Problemas de entrega de email | v2.5 |

---

## 📈 Métricas del Proyecto

### Líneas de Código (aproximadas)

| Versión | Frontend | SQL | Total |
|---------|----------|-----|-------|
| v2.2.x | ~3,000 | ~300 | ~3,300 |
| v2.3.0 | ~3,200 | ~650 | ~3,850 |
| v2.4.0 | ~4,500 | ~1,100 | ~5,600 |
| v2.4.1 | ~4,800 | ~1,100 | ~5,900 |
| v2.5.0 | ~4,900 | ~1,200 | ~6,100 |
| v2.5.1 | ~4,950 | ~1,200 | ~6,150 |

### Issues Resueltos por Versión

```
v2.2.x ─┬─ 5 críticos → v2.3.0
        ├─ 12 altos   → v2.4.0
        └─ 8 medios   → v2.4.1

v2.3.0 ─┬─ 3 críticos → v2.4.0
        └─ 6 altos    → v2.4.1

v2.4.0 ─┬─ 2 críticos → v2.4.1
        └─ 6 altos    → v2.4.1

v2.4.1 ─┬─ 0 críticos ✓
        └─ 0 altos   ✓

v2.5.0 ─┬─ 0 críticos ✓
        └─ 2 medios   → v2.5.1

v2.5.1 ─┬─ 0 críticos ✓
        ├─ 0 altos   ✓
        └─ 0 medios  ✓
```

---

## 🗂️ Archivos de Migración SQL

| Versión | Archivo | Descripción |
|---------|---------|-------------|
| v2.3 | `sql/migracion_v2.3.sql` | Cambio de seccion_id a TEXT, campos v2.3 |
| v2.4 | `sql/migracion_colonias_v2.4.sql` | 417 colonias INE |
| v2.4 | `sql/migracion_v2.4_fix_colonias.sql` | Fix constraint tipos colonias |
| v2.5 | `sql/setup_password_auth.sql` | Configuración auth por password |
| v2.5 | `sql/setup_admin_user.sql` | Usuario admin inicial |

---

## ✅ Estado Actual (v2.5.1)

### Módulos Verificados

| Módulo | Estado | Cobertura Tests |
|--------|--------|-----------------|
| Formulario de Encuestas | ✅ Estable | GPS, validaciones, offline |
| Dashboard Analítico | ✅ Estable | KPIs, tendencias, demografía |
| War Room | ✅ Estable | Mapa, comparación, export CSV |
| Admin Panel | ✅ Estable | Configuración, encuestadores |
| Sincronización Offline | ✅ Estable | Auto-sync, queue, duplicados |
| Autenticación | ✅ Estable | Login, sesiones, RLS |
| Base de Datos | ✅ Estable | 68 secciones, 417 colonias |

### Próximos Pasos (Opcionales)

- [ ] Implementar heatmap real con `leaflet.heat`
- [ ] Agregar clustering de colonias en mapa
- [ ] Modo offline con cache de tiles del mapa
- [ ] Comparación temporal (misma campaña, fechas distintas)
- [ ] Análisis de sentimiento con NLP

---

## 📝 Notas de Compatibilidad

### Hacia Atrás (Backward Compatibility)
- ✅ Todas las versiones desde v2.3.0 son compatibles con datos v2.2.x
- ✅ Migraciones SQL son idempotentes (pueden ejecutarse múltiples veces)
- ✅ Datos exportados en CSV son compatibles entre versiones

### Dependencias
- Node.js 18.x+
- Next.js 15.x
- React 19.x
- Supabase 2.x

---

*Última actualización: 2026-02-26*  
*Versión documentada: v2.5.1*

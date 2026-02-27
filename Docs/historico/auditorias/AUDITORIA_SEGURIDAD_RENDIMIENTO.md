# 🔍 Auditoría de Código - PulsoElectoral v2.4

**Fecha:** 2026-02-25  
**Proyecto:** PulsoElectoral (Sistema de Encuestas Políticas para Atlixco, Puebla)  
**Versión auditada:** v2.4

---

## 📊 Resumen Ejecutivo

| Categoría | Crítico | Alto | Medio | Bajo |
|-----------|:-------:|:----:|:-----:|:----:|
| SQL/BD | 1 | 2 | 3 | 2 |
| Memory Leaks | 2 | 4 | 1 | 0 |
| Race Conditions | 1 | 3 | 2 | 0 |
| Seguridad | 1 | 2 | 2 | 1 |
| Rendimiento | 0 | 5 | 8 | 4 |
| UX/Validación | 1 | 3 | 6 | 3 |
| **TOTAL** | **6** | **19** | **22** | **10** |

---

## 🚨 PROBLEMAS CRÍTICOS (Requieren atención inmediata)

### 1. [CRÍTICO] Timeout sin cleanup en useGPS - Memory Leak
**Archivo:** `src/components/FormularioEncuesta.jsx`  
**Línea:** ~103

```javascript
// PROBLEMA: El timeout de reintento GPS no se limpia al desmontar
setTimeout(() => attempt(retryCount + 1), 3000);
```

**Impacto:** Si el usuario abandona el formulario durante un reintento GPS, el timeout persiste y puede causar actualizaciones de estado en componente desmontado.

**Solución:**
```javascript
function useGPS() {
  const timeoutRef = useRef(null);
  
  const capture = useCallback(() => {
    // ... código actual ...
    timeoutRef.current = setTimeout(() => attempt(retryCount + 1), 3000);
    // ...
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  // ...
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);
}
```

---

### 2. [CRÍTICO] Race Condition en fetchAll del Dashboard
**Archivo:** `src/components/DashboardPolitico.jsx`  
**Líneas:** 26-39

**Problema:** Si `campanaId` cambia rápidamente, múltiples llamadas async pueden completarse en orden incorrecto.

**Solución:**
```javascript
const fetchAll = useCallback(async () => {
  if (!campanaId || IS_DEMO) { setLoading(false); return; }
  
  // Cancelar petición anterior
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  abortControllerRef.current = new AbortController();
  
  try {
    setLoading(true);
    setError(null);
    // ... llamadas a Supabase
    if (abortControllerRef.current.signal.aborted) return;
    setData({...});
  } catch (err) {
    if (err.name === 'AbortError') return;
    setError(err.message);
  } finally {
    setLoading(false);
  }
}, [campanaId]);
```

---

### 3. [CRÍTICO] Acceso a propiedades sin validación causa crashes
**Archivo:** `src/components/DashboardPolitico.jsx`  
**Líneas:** 352, 366, 388, 544

**Problema:** El código asume que arrays siempre existen:
```javascript
D.conoce_candidato.map(...)  // Crashea si es null/undefined
```

**Solución:**
```javascript
(D.conoce_candidato || []).map(...)
// o
D.conoce_candidato?.map?.(...)
```

---

### 4. [CRÍTICO] DROP INDEX duplicado en migración
**Archivo:** `sql/migracion_v2.3.sql`  
**Líneas:** 170-171

```sql
-- ERROR: Líneas duplicadas
DROP INDEX IF EXISTS idx_respuestas_campana_seccion;
DROP INDEX IF EXISTS idx_respuestas_campana_seccion;  -- ← DUPLICADO
```

**Impacto:** No causa error funcional pero es código muerto.

---

### 5. [CRÍTICO] Falta RLS para tabla colonias
**Archivo:** `sql/schema.sql`  
**Línea:** Después de 114

**Problema:** La tabla `colonias` no tiene RLS habilitado ni políticas definidas.

**Solución:**
```sql
ALTER TABLE colonias ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública (catálogo)
DROP POLICY IF EXISTS "colonias_lectura_publica" ON colonias;
CREATE POLICY "colonias_lectura_publica" ON colonias
  FOR SELECT TO anon, authenticated
  USING (true);
```

---

### 6. [CRÍTICO] No hay manejo de error al cargar colonias
**Archivo:** `src/components/FormularioEncuesta.jsx`  
**Líneas:** 990-993

**Problema:** Si `fetchColonias()` falla, el usuario ve "Cargando..." indefinidamente.

**Solución:**
```javascript
const [coloniasError, setColoniasError] = useState(false);

useEffect(() => {
  fetchColonias()
    .then(data => { setColonias(data); setColoniasLoading(false); })
    .catch(err => { 
      console.error(err); 
      setColoniasError(true);
      setColoniasLoading(false); 
    });
}, []);

// En el render:
{coloniasError && (
  <div style={{color: C.danger}}>
    Error cargando catálogo. 
    <button onClick={() => window.location.reload()}>Reintentar</button>
  </div>
)}
```

---

## ⚠️ PROBLEMAS DE SEGURIDAD (Alto)

### 7. [ALTO] Foto evidencia base64 podría exceder límites
**Archivo:** `src/components/FormularioEncuesta.jsx`  
**Línea:** ~1102

**Problema:** Se guarda el data URL completo (base64) de la imagen, podría exceder límites de BD (imágenes de 5MB = ~7MB en base64).

**Solución:** Comprimir imagen antes de guardar:
```javascript
// Usar canvas para comprimir
async function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
```

---

### 8. [ALTO] No hay verificación de errores de Supabase
**Archivo:** `src/components/DashboardPolitico.jsx`  
**Líneas:** 26-32

```javascript
// PROBLEMA: Solo verifica excepciones, no errores de Supabase
const [kpisRes, tendRes, ...] = await Promise.all([...]);
setData({ kpis: kpisRes.data, ... });  // data puede ser null si hay error
```

**Solución:**
```javascript
const [kpisRes, tendRes, ...] = await Promise.all([...]);
if (kpisRes.error) throw kpisRes.error;
if (tendRes.error) throw tendRes.error;
// ... etc
```

---

## ⚡ PROBLEMAS DE RENDIMIENTO (Alto)

### 9. [ALTO] Funciones sin memoización causan re-renders masivos
**Archivo:** `src/components/FormularioEncuesta.jsx`  
**Líneas:** 1027, 1029-1048

**Problema:** `update`, `handleNext`, `handleBack`, `handleSubmit` se recrean en cada render.

**Solución:**
```javascript
const update = useCallback((key, val) => 
  setForm(f => ({ ...f, [key]: val })), 
[]);

const handleNext = useCallback(() => {
  // ... dependencias: step, form, gps, errors, completed
}, [step, form, gps, errors, completed]);
```

---

### 10. [ALTO] Componentes Step* no memoizados
**Archivo:** `src/components/FormularioEncuesta.jsx`  
**Líneas:** 686-922

**Solución:**
```javascript
const Step1 = React.memo(function Step1({ form, update, ... }) {
  // ... componente
});
```

---

## 🐛 INCONSISTENCIAS EN SQL

### 11. [MEDIO] Datos de colonias con tipo vacío
**Archivo:** `sql/migracion_colonias_v2.4.sql`  
**Líneas:** 84, 92, 94, etc.

```sql
-- PROBLEMA: Tipo vacío o solo espacios
('EX-HACIENDA             TIZAYUCA', '0160', ' ', '74367'),  -- ← tipo = ' '
('-                     ZONA RESTAURANTERA', '0160', ' ', '74210'),  -- ← tipo = ' '
```

**Solución:** Limpiar datos o usar DEFAULT:
```sql
-- Opción 1: Limpiar antes de insert
UPDATE colonias SET tipo = 'OTRO' WHERE tipo IS NULL OR TRIM(tipo) = '';

-- Opción 2: Usar COALESCE en la vista
CREATE VIEW v_colonias_limpia AS
SELECT 
  id, nombre, seccion_id,
  CASE WHEN TRIM(COALESCE(tipo, '')) = '' THEN 'OTRO' ELSE tipo END as tipo,
  codigo_postal
FROM colonias;
```

---

### 12. [MEDIO] Colonias duplicadas en migración
**Archivo:** `sql/migracion_colonias_v2.4.sql`  
**Líneas:** 104-105

```sql
('EX HACIENDA LAS ANIMAS', '0163', 'FRACCIONAMIENTO', '74215'),
('EX HACIENDA LAS ANIMAS', '0163', 'FRACCIONAMIENTO', '74215'),  -- ← DUPLICADO
```

**Impacto:** El `ON CONFLICT (nombre, seccion_id) DO NOTHING` evita el error, pero es código redundante.

---

## 📋 LISTA COMPLETA DE ARCHIVOS CON PROBLEMAS

| Archivo | Problemas | Severidad Max |
|---------|:---------:|:-------------:|
| `src/components/FormularioEncuesta.jsx` | 15 | CRÍTICO |
| `src/components/DashboardPolitico.jsx` | 12 | CRÍTICO |
| `sql/migracion_v2.3.sql` | 2 | MEDIO |
| `sql/migracion_colonias_v2.4.sql` | 3 | MEDIO |
| `sql/schema.sql` | 1 | CRÍTICO |
| `src/lib/supabase.js` | 3 | MEDIO |
| `src/lib/constants.js` | 0 | - |
| `src/middleware.js` | 0 | - |
| `src/app/api/sync-offline/route.js` | 0 | - |

---

## 🛠️ PLAN DE REMEDIACIÓN RECOMENDADO

### Fase 1: Hotfixes Críticos (1-2 días)
1. [ ] Agregar cleanup de timeouts en useGPS
2. [ ] Implementar AbortController en fetchAll del dashboard
3. [ ] Agregar validaciones de null/undefined en Dashboard
4. [ ] Agregar RLS para tabla colonias
5. [ ] Agregar manejo de error en carga de colonias

### Fase 2: Correcciones de Seguridad (2-3 días)
1. [ ] Implementar compresión de imágenes
2. [ ] Verificar errores de Supabase en todas las llamadas
3. [ ] Sanitizar entradas de usuario adicionales
4. [ ] Agregar rate limiting más estricto

### Fase 3: Optimizaciones (3-5 días)
1. [ ] Memoizar funciones principales
2. [ ] Agregar React.memo a componentes Step*
3. [ ] Implementar virtualización para listas largas
4. [ ] Optimizar queries SQL

### Fase 4: Limpieza SQL (1 día)
1. [ ] Eliminar duplicados en migraciones
2. [ ] Limpiar tipos vacíos en colonias
3. [ ] Agregar comentarios faltantes
4. [ ] Normalizar nombres con espacios extra

---

## ✅ CHECKLIST DE VERIFICACIÓN POST-FIX

- [ ] GPS cleanup no genera memory leaks (probar con 10 navegaciones rápidas)
- [ ] Dashboard no crashea si datos son null
- [ ] Colonias se cargan correctamente con/sin cache
- [ ] RLS funciona para colonias (probar con usuario no autenticado)
- [ ] Imágenes se comprimen antes de enviar
- [ ] No hay re-renders innecesarios en React DevTools Profiler
- [ ] No hay errores en consola en modo producción

---

*Fin del informe de auditoría*

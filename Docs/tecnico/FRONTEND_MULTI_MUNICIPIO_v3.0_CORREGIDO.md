# 🎨 Frontend Multi-Municipio v3.0 — CORREGIDO

**Versión:** v3.0 (Post-auditoría FE)  
**Fecha:** 2026-02-26  
**Estado:** Guía de implementación corregida

---

## 📋 Resumen de Cambios Post-Auditoría

| ID | Error Original | Corrección |
|----|----------------|------------|
| FE-1 | Filtro `.eq('activa', true)` en secciones (columna no existe) | Eliminado filtro, mantenido solo en colonias |
| FE-2 | `organizacion.rol` (rol está en membresía) | Extraer desde `membresias[0].rol` |
| FE-3 | Sintaxis `organizaciones:id(...)` inválida | Corregido a `organizaciones(id, ...)` |
| FE-4 | Sin suscripción a `onAuthStateChange` | Agregado listener de auth state |
| FE-5 | Firma de `useWarRoomData` no especificada | Documentado cambio requerido |
| FE-6 | `.single()` sin filtrar organización | Agregado filtro `organizacion_id` |
| FE-7 | Sin recarga de estado en admin | Agregado refetch post-insert |
| FE-8 | Validación solo en cliente | Nota de validación server-side |
| FE-9 | Sin flag `isInitialized` | Agregado estado de inicialización |

---

## 1. HOOKS Y UTILIDADES

### 1.1 Hook: useOrganizacion (CORREGIDO)

**Archivo:** `src/hooks/useOrganizacion.js`

```javascript
'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useOrganizacion() {
  const [organizacion, setOrganizacion] = useState(null);
  const [rol, setRol] = useState(null);  // ✅ FE-2: Rol separado de organización
  const [municipios, setMunicipios] = useState([]);
  const [municipioActual, setMunicipioActual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);  // ✅ FE-9
  const [error, setError] = useState(null);

  const loadOrganizacion = useCallback(async () => {
    try {
      setLoading(true);
      
      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setOrganizacion(null);
        setRol(null);
        setIsInitialized(true);  // ✅ FE-9
        return;
      }

      // ✅ FE-3: Sintaxis PostgREST corregida (sin :id)
      const { data: membresias, error: errMembresias } = await supabase
        .from('organizacion_miembros')
        .select(`
          organizacion_id,
          rol,
          organizaciones (
            id, nombre, tipo, plan, limite_municipios, limite_campanas, activa
          )
        `)
        .eq('user_id', user.id)
        .eq('activo', true);

      if (errMembresias) throw errMembresias;
      
      if (!membresias || membresias.length === 0) {
        setError('Usuario no pertenece a ninguna organización');
        setIsInitialized(true);  // ✅ FE-9
        return;
      }

      // ✅ FE-2: Extraer rol desde membresía, no desde organización
      const primeraMembresia = membresias[0];
      setRol(primeraMembresia.rol);
      setOrganizacion(primeraMembresia.organizaciones);

      // Cargar municipios de la organización
      const { data: municipiosOrg, error: errMun } = await supabase
        .from('organizacion_municipios')
        .select(`
          municipio_id,
          municipios (id, nombre, latitud_centro, longitud_centro)
        `)
        .eq('organizacion_id', primeraMembresia.organizacion_id);

      if (errMun) throw errMun;

      const munList = municipiosOrg?.map(m => m.municipios) || [];
      setMunicipios(munList);
      
      // Municipio default: primero de la lista o guardado en localStorage
      const savedMun = localStorage.getItem('municipio_actual_id');
      const defaultMun = munList.find(m => m.id.toString() === savedMun) || munList[0];
      setMunicipioActual(defaultMun);

    } catch (err) {
      console.error('Error cargando organización:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsInitialized(true);  // ✅ FE-9
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    loadOrganizacion();
  }, [loadOrganizacion]);

  // ✅ FE-4: Suscripción a cambios de auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          // Limpiar estado al hacer logout
          setOrganizacion(null);
          setRol(null);
          setMunicipios([]);
          setMunicipioActual(null);
          localStorage.removeItem('municipio_actual_id');
        } else if (event === 'SIGNED_IN') {
          // Recargar al hacer login
          loadOrganizacion();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadOrganizacion]);

  // Cambiar municipio actual
  const cambiarMunicipio = useCallback((municipioId) => {
    const mun = municipios.find(m => m.id === municipioId);
    if (mun) {
      setMunicipioActual(mun);
      localStorage.setItem('municipio_actual_id', mun.id);
    }
  }, [municipios]);

  return {
    organizacion,
    rol,  // ✅ FE-2: Exponer rol directamente
    municipios,
    municipioActual,
    cambiarMunicipio,
    loading,
    isInitialized,  // ✅ FE-9
    error,
    esSuperadmin: rol === 'superadmin',  // ✅ FE-2: Usar rol, no organizacion.rol
    recargar: loadOrganizacion
  };
}
```

---

### 1.2 Hook: useMunicipioData (CORREGIDO)

**Archivo:** `src/hooks/useMunicipioData.js`

```javascript
'use client';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useMunicipioData(municipioId) {
  // ✅ FE-1: Eliminado filtro .eq('activa', true) de secciones
  // La tabla secciones_electorales no tiene columna 'activa'
  const { data: secciones, isLoading: loadingSecciones } = useQuery({
    queryKey: ['secciones', municipioId],
    queryFn: async () => {
      if (!municipioId) return [];
      const { data, error } = await supabase
        .from('secciones_electorales')
        .select('seccion, nombre_zona, tipo, lista_nominal, latitud_centro, longitud_centro')
        .eq('municipio_id', municipioId)
        .order('seccion');
      if (error) throw error;
      return data || [];
    },
    enabled: !!municipioId
  });

  // ✅ FE-1: Mantenido filtro 'activa' en colonias (columna sí existe)
  const { data: colonias, isLoading: loadingColonias } = useQuery({
    queryKey: ['colonias', municipioId],
    queryFn: async () => {
      if (!municipioId) return [];
      const { data, error } = await supabase
        .from('colonias')
        .select('id, nombre, seccion_id, tipo, codigo_postal')
        .eq('municipio_id', municipioId)
        .eq('activa', true)  // ✅ Columna activa existe en colonias
        .order('nombre');
      if (error) throw error;
      return data || [];
    },
    enabled: !!municipioId
  });

  return {
    secciones,
    colonias,
    loading: loadingSecciones || loadingColonias
  };
}
```

---

## 2. COMPONENTES NUEVOS

### 2.1 MunicipioSelector

```jsx
'use client';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { C } from '@/lib/theme';

export function MunicipioSelector() {
  // ✅ FE-9: Usar isInitialized para evitar flash de loading
  const { municipios, municipioActual, cambiarMunicipio, isInitialized } = useOrganizacion();

  if (!isInitialized) return <span style={{ color: C.textMut }}>Cargando...</span>;
  if (municipios.length <= 1) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: C.textSec, fontSize: 12 }}>Municipio:</span>
      <select
        value={municipioActual?.id || ''}
        onChange={(e) => cambiarMunicipio(parseInt(e.target.value))}
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          border: `1px solid ${C.gold}40`,
          background: C.surface,
          color: C.textPri,
          fontSize: 13,
          cursor: 'pointer'
        }}
      >
        {municipios.map(mun => (
          <option key={mun.id} value={mun.id}>
            {mun.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

## 3. COMPONENTES MODIFICADOS

### 3.1 DashboardPolitico (CORREGIDO)

```jsx
'use client';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { MunicipioSelector } from '@/components/MunicipioSelector';

export default function DashboardPolitico() {
  const { organizacion, municipioActual, isInitialized } = useOrganizacion();
  
  const fetchData = useCallback(async () => {
    if (!municipioActual || !organizacion) return;
    
    // ✅ FE-6: Filtrar por organizacion_id antes de .single()
    const { data: kpis } = await supabase
      .from('v_metricas_por_municipio')
      .select('*')
      .eq('municipio_id', municipioActual.id)
      .eq('organizacion_id', organizacion.id)  // ✅ Previene múltiples filas
      .maybeSingle();  // ✅ Usar maybeSingle() en lugar de single() para safety
    
    // ... resto de queries
  }, [municipioActual, organizacion]);

  // ✅ FE-9: Esperar inicialización
  if (!isInitialized) return <Loading />;

  return (
    <div>
      <Header>
        <h1>Dashboard</h1>
        <MunicipioSelector />
      </Header>
      
      <KPIGrid data={kpis} />
    </div>
  );
}
```

---

### 3.2 WarRoom (CORREGIDO)

**Archivo:** `src/components/WarRoom.jsx`

```jsx
'use client';
import { useOrganizacion } from '@/hooks/useOrganizacion';

// ✅ FE-5: Hook useWarRoomData reescrito para aceptar municipioId
function useWarRoomData(municipioId, campanaId = null) {
  const { organizacion } = useOrganizacion();
  const [data, setData] = useState(null);
  
  useEffect(() => {
    if (!municipioId || !organizacion) return;
    
    async function fetchData() {
      // Si no se especifica campanaId, obtener la campaña activa del municipio
      let targetCampanaId = campanaId;
      
      if (!targetCampanaId) {
        const { data: campanas } = await supabase
          .from('campanas')
          .select('id')
          .eq('municipio_id', municipioId)
          .eq('organizacion_id', organizacion.id)
          .eq('activa', true)
          .order('created_at', { ascending: false })
          .limit(1);
        
        targetCampanaId = campanas?.[0]?.id;
      }
      
      if (!targetCampanaId) return;
      
      // Cargar datos de la campaña...
      const { data: result } = await supabase
        .from('v_metricas_por_seccion')
        .select('*')
        .eq('campana_id', targetCampanaId)
        .eq('organizacion_id', organizacion.id);
      
      setData(result);
    }
    
    fetchData();
  }, [municipioId, campanaId, organizacion]);
  
  return { data };
}

export default function WarRoom() {
  const { municipioActual, municipios, isInitialized } = useOrganizacion();
  const [modoComparacion, setModoComparacion] = useState(false);
  const [municipioComparacion, setMunicipioComparacion] = useState(null);

  // ✅ FE-5: Pasar municipioId al hook
  const { data: dataActual } = useWarRoomData(municipioActual?.id);
  const { data: dataComparacion } = useWarRoomData(
    modoComparacion ? municipioComparacion?.id : null
  );

  if (!isInitialized) return <Loading />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header>
        <h1>War Room</h1>
        <MunicipioSelector />
        <button onClick={() => setModoComparacion(!modoComparacion)}>
          {modoComparacion ? '⚡ Comparando' : 'Comparar'}
        </button>
        
        {modoComparacion && (
          <select
            value={municipioComparacion?.id || ''}
            onChange={(e) => {
              const mun = municipios.find(m => m.id === parseInt(e.target.value));
              setMunicipioComparacion(mun);
            }}
          >
            {municipios
              .filter(m => m.id !== municipioActual?.id)
              .map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        )}
      </header>

      {/* Mapas */}
      <div style={{ flex: 1, display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <h3>{municipioActual?.nombre}</h3>
          <Mapa data={dataActual} />
        </div>
        
        {modoComparacion && (
          <div style={{ flex: 1 }}>
            <h3>{municipioComparacion?.nombre}</h3>
            <Mapa data={dataComparacion} />
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 3.3 AdminPanel (CORREGIDO)

```jsx
// Sección Municipios corregida

function SeccionMunicipios({ organizacion }) {
  const [municipiosOrg, setMunicipiosOrg] = useState([]);
  const [recargando, setRecargando] = useState(false);

  const cargarMunicipios = useCallback(async () => {
    setRecargando(true);
    const { data } = await supabase
      .from('organizacion_municipios')
      .select('municipio_id, municipios(*)')
      .eq('organizacion_id', organizacion.id);
    
    setMunicipiosOrg(data?.map(d => d.municipios) || []);
    setRecargando(false);
  }, [organizacion.id]);

  useEffect(() => {
    cargarMunicipios();
  }, [cargarMunicipios]);

  const agregarMunicipio = async (municipioId) => {
    // ✅ FE-8: Validación server-side requerida
    // Nota: Esta validación es solo UI. Para seguridad real, 
    // usar edge function o trigger en BD que verifique el límite
    
    const { error } = await supabase
      .from('organizacion_municipios')
      .insert({ organizacion_id: organizacion.id, municipio_id: municipioId });

    if (error) {
      alert('Error: ' + error.message);
      return;
    }

    // ✅ FE-7: Recargar estado después de insert
    await cargarMunicipios();
  };

  return (
    <div>
      <h3>Municipios ({municipiosOrg.length} / {organizacion.limite_municipios})</h3>
      {recargando && <span>Actualizando...</span>}
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {municipiosOrg.map(mun => (
          <div key={mun.id} style={{ padding: '8px 16px', background: '#eee', borderRadius: 20 }}>
            {mun.nombre}
          </div>
        ))}
      </div>

      {municipiosOrg.length < organizacion.limite_municipios && (
        <select onChange={(e) => agregarMunicipio(parseInt(e.target.value))} defaultValue="">
          <option value="" disabled>Agregar municipio...</option>
          {/* Opciones filtradas */}
        </select>
      )}
    </div>
  );
}
```

---

## 4. CHECKLIST CORREGIDO

### Paso 1: Hooks y Contexto
- [x] Crear `useOrganizacion.js` (con auth listener, rol separado)
- [x] Crear `useMunicipioData.js` (sin filtro 'activa' en secciones)
- [x] Crear `OrganizacionContext` con `isInitialized`
- [ ] Modificar `layout.jsx` para incluir provider

### Paso 2: Componentes
- [x] `MunicipioSelector` (usa `isInitialized`)
- [ ] `OrgBadge` (muestra nombre de org)
- [ ] Reescribir `useWarRoomData` (aceptar `municipioId`)
- [ ] Modificar `DashboardPolitico` (filtro org + maybeSingle)
- [ ] Modificar `AdminPanel` (recarga post-insert)

### Tests a realizar
- [ ] Usuario A no ve datos de Usuario B (validar RLS)
- [ ] Cambio de usuario en misma pestaña (auth state change)
- [ ] Cambio de municipio actualiza datos
- [ ] Admin puede agregar municipio y aparece inmediatamente

---

**Fin de documentación corregida**

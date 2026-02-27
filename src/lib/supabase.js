// lib/supabase.js — Cliente unificado + helpers
import { createBrowserClient } from '@supabase/ssr';
import { OFFLINE_KEY, sanitizePayload } from './constants';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let _client = null;

// ✅ FIX: Validación de configuración
function validateConfig() {
  if (!url || !key) {
    const missing = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !key && 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].filter(Boolean);
    console.warn(`[Supabase] Missing environment variables: ${missing.join(', ')}`);
    return false;
  }
  try {
    new URL(url);
  } catch {
    console.error('[Supabase] Invalid SUPABASE_URL format');
    return false;
  }
  return true;
}

export function getSupabase() {
  if (!_client) {
    if (!validateConfig()) {
      return createMockClient();
    }
    // createBrowserClient guarda la sesión en cookies (no solo localStorage)
    // para que el middleware del servidor pueda leerla correctamente
    _client = createBrowserClient(url, key);
  }
  return _client;
}

// ✅ FIX v2.3: Mock completo que soporta el chaining del dashboard
function createMockClient() {
  console.log('[Supabase] Using mock client (demo mode)');
  
  const mockData = {
    v_kpis_campana: {
      campana_id: 'mock-campana',
      total_encuestas: 347,
      pct_reconocimiento: 61.4,
      pct_intencion_positiva: 48.2,
      pct_imagen_positiva: 54.7,
      promedio_intencion: 3.8,
      hoy: 23,
      meta: 400
    },
    v_tendencia_semanal: [
      { semana: 'Sem 1\n6-Ene', reconocimiento: 45, intencion: 38, simpatia: 40 },
      { semana: 'Sem 2\n13-Ene', reconocimiento: 51, intencion: 42, simpatia: 46 },
      { semana: 'Sem 3\n20-Ene', reconocimiento: 55, intencion: 44, simpatia: 49 },
      { semana: 'Sem 4\n27-Ene', reconocimiento: 58, intencion: 46, simpatia: 52 },
      { semana: 'Sem 5\n3-Feb', reconocimiento: 61, intencion: 48, simpatia: 55 },
    ],
    v_resultados_por_seccion: [
      { seccion_id: '0154', nombre_zona: 'Centro Histórico', total: 48, promedio_intencion: 4.2, pct_intencion_positiva: 62, pct_reconocimiento: 75 },
      { seccion_id: '0158', nombre_zona: 'Barrio Santiago', total: 41, promedio_intencion: 3.9, pct_intencion_positiva: 58, pct_reconocimiento: 68 },
      { seccion_id: '0166', nombre_zona: 'Col. Revolución', total: 33, promedio_intencion: 3.5, pct_intencion_positiva: 52, pct_reconocimiento: 61 },
    ],
    v_agenda_ciudadana: [
      { problema: 'Seguridad pública', menciones: 215, pct: 62 },
      { problema: 'Empleo', menciones: 191, pct: 55 },
      { problema: 'Infraestructura', menciones: 167, pct: 48 },
      { problema: 'Agua y servicios', menciones: 149, pct: 43 },
    ],
    v_demograficos: [
      { genero: 'M', edad_rango: '25-34', total: 94, promedio_intencion: 4.1, pct_intencion_positiva: 51 },
      { genero: 'F', edad_rango: '35-44', total: 78, promedio_intencion: 4.3, pct_intencion_positiva: 54 },
    ],
    respuestas: [],
    // DEMO-1 FIX: Mock data para organizacion_miembros
    // Estructura con join a organizaciones (como espera useOrganizacion.js)
    organizacion_miembros: [
      { 
        user_id: 'mock-user', 
        organizacion_id: 'mock-org-1', 
        rol: 'admin', 
        activo: true,
        organizaciones: {
          id: 'mock-org-1', 
          nombre: 'Organización Demo', 
          tipo: 'candidato', 
          plan: 'profesional', 
          activa: true, 
          limite_municipios: 5, 
          limite_campanas: 10 
        }
      }
    ],
    organizaciones: [
      { id: 'mock-org-1', nombre: 'Organización Demo', tipo: 'candidato', plan: 'profesional', activa: true, limite_municipios: 5, limite_campanas: 10 }
    ],
    // DEMO-1 FIX Parte 2: Mock data con join anidado para useOrganizacion.js:69-84
    organizacion_municipios: [
      { 
        organizacion_id: 'mock-org-1', 
        municipio_id: 1,
        municipios: { id: 1, nombre: 'Atlixco', latitud_centro: 18.9088, longitud_centro: -98.4321 }
      },
      { 
        organizacion_id: 'mock-org-1', 
        municipio_id: 2,
        municipios: { id: 2, nombre: 'San Martín Texmelucan', latitud_centro: 19.2847, longitud_centro: -98.4331 }
      }
    ],
    municipios: [
      { id: 1, nombre: 'Atlixco', latitud_centro: 18.9088, longitud_centro: -98.4321 },
      { id: 2, nombre: 'San Martín Texmelucan', latitud_centro: 19.2847, longitud_centro: -98.4331 }
    ]
  };

  // Builder pattern para queries mock
  const createQueryBuilder = (table, existingFilters = {}, existingLimit = null) => {
    let filters = { ...existingFilters };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let ordering = null;
    let limitCount = existingLimit;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let selecting = '*';
    
    // Función para aplicar filtros a los datos
    const applyFilters = (data) => {
      if (!Array.isArray(data)) return data;
      let result = data;
      for (const [col, val] of Object.entries(filters)) {
        result = result.filter(row => row[col] === val);
      }
      if (limitCount) {
        result = result.slice(0, limitCount);
      }
      return result;
    };
    
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      select: (cols) => {
        return createQueryBuilder(table, filters, limitCount);
      },
      eq: (col, val) => {
        filters[col] = val;
        return createQueryBuilder(table, filters, limitCount);
      },
      order: (col, opts) => {
        ordering = { col, ...opts };
        return createQueryBuilder(table, filters, limitCount);
      },
      limit: (n) => {
        limitCount = n;
        return createQueryBuilder(table, filters, limitCount);
      },
      single: async () => {
        let data = mockData[table];
        if (!data) return { data: null, error: new Error(`Table ${table} not found in mock`) };
        if (Array.isArray(data)) {
          data = applyFilters(data);
          return { data: data[0] || null, error: null };
        }
        return { data, error: null };
      },
      then: (callback) => {
        let data = mockData[table];
        if (Array.isArray(data)) {
          data = applyFilters(data);
        }
        return Promise.resolve(callback({ data, error: null }));
      }
    };
  };

  return {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'mock-user', email: 'demo@ejemplo.com' } } }, error: null }),
      signInWithOtp: async () => ({ data: null, error: null }),
      // BUG-C4 FIX: Agregar signInWithPassword para modo demo
      signInWithPassword: async ({ email, password: _password }) => ({  // eslint-disable-line @typescript-eslint/no-unused-vars 
        data: { 
          user: { id: 'mock-user', email: email || 'demo@ejemplo.com' },
          session: { access_token: 'mock-token', expires_at: Date.now() + 3600000 }
        }, 
        error: null 
      }),
      // F4-BUG-03 FIX: Agregar getUser para OrganizacionProvider
      getUser: async () => ({ 
        data: { user: { id: 'mock-user', email: 'demo@ejemplo.com' } }, 
        error: null 
      }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: (cb) => {
        cb('SIGNED_IN', { user: { id: 'mock-user' } });
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    from: (table) => ({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      select: (cols) => createQueryBuilder(table),
      insert: (data) => ({
        select: () => ({
          single: async () => ({ 
            data: { ...data, id: 'mock-' + Date.now() }, 
            error: null 
          })
        })
      }),
    }),
    channel: (name) => ({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      on: (event, filter, callback) => ({
        subscribe: () => {
          console.log(`[Mock] Subscribed to channel: ${name}`);
          return { unsubscribe: () => {} };
        }
      }),
    }),
    removeChannel: () => {},
  };
}

export const supabase = getSupabase();

// ─── Auth helpers ────────────────────────────────────────────────────────────
export async function signInWithMagicLink(email, redirectPath = '/dashboard') {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}${redirectPath}`,
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

// ─── Data helpers ────────────────────────────────────────────────────────────
export async function insertRespuesta(payload) {
  const clean = sanitizePayload(payload);
  const { data, error } = await supabase.from('respuestas').insert(clean).select().single();
  if (error) throw error;
  return data;
}

export async function fetchKPIs(campanaId) {
  const { data, error } = await supabase.from('v_kpis_campana').select('*').eq('campana_id', campanaId).single();
  if (error) throw error;
  return data;
}

export async function fetchTendencia(campanaId) {
  const { data, error } = await supabase.from('v_tendencia_semanal').select('*').eq('campana_id', campanaId).order('semana', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchSecciones(campanaId) {
  const { data, error } = await supabase.from('v_resultados_por_seccion').select('*').eq('campana_id', campanaId);
  if (error) throw error;
  return data;
}

export async function fetchDemografia(campanaId) {
  const { data, error } = await supabase.from('v_demograficos').select('*').eq('campana_id', campanaId);
  if (error) throw error;
  return data;
}

export async function fetchAgenda(campanaId) {
  const { data, error } = await supabase.from('v_agenda_ciudadana').select('*').eq('campana_id', campanaId).limit(10);
  if (error) throw error;
  return data;
}

export async function fetchComentarios(campanaId, limite = 50) {
  const { data, error } = await supabase
    .from('respuestas')
    .select('comentario_final, seccion_id, created_at')
    .eq('campana_id', campanaId)
    .not('comentario_final', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data;
}

// ─── COLONIAS con Cacheo Inteligente (v3.0 - Multi-municipio) ─────────────────
const COLONIAS_CACHE_PREFIX = 'colonias_cache_v3_';
const COLONIAS_CACHE_TIMESTAMP_PREFIX = 'colonias_ts_v3_';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Carga colonias desde Supabase con cacheo localStorage (v3.0 - Multi-municipio)
 * 
 * @param {Object} options
 * @param {number} options.municipioId - ID del municipio (REQUERIDO v3.0)
 * @param {boolean} options.forceRefresh - Forzar recarga desde API
 * @param {boolean} options.skipCache - Omitir cache completamente
 * 
 * Estrategia:
 * 1. Primero devuelve cache local específico por municipio
 * 2. Si hay internet, refresca cache en background
 * 3. Si no hay cache y no hay internet, devuelve error
 */
export async function fetchColonias(options = {}) {
  const { municipioId, forceRefresh = false, skipCache = false } = options;
  
  // v3.0: municipioId es requerido
  if (!municipioId) {
    console.warn('[Colonias] municipioId es requerido en v3.0');
    return [];
  }
  
  const cacheKey = `${COLONIAS_CACHE_PREFIX}${municipioId}`;
  const cacheTsKey = `${COLONIAS_CACHE_TIMESTAMP_PREFIX}${municipioId}`;
  
  // 1. Intentar obtener del cache específico del municipio
  if (!skipCache && typeof window !== 'undefined') {
    const cached = localStorage.getItem(cacheKey);
    const timestamp = localStorage.getItem(cacheTsKey);
    const now = Date.now();
    
    if (cached && timestamp) {
      const age = now - parseInt(timestamp);
      // Cache válido si tiene menos de 24 horas
      if (age < CACHE_DURATION_MS && !forceRefresh) {
        try {
          // S1 FIX: try-catch para JSON.parse
          const colonias = JSON.parse(cached);
          console.log(`[Colonias] Cache hit for municipio ${municipioId}: ${colonias.length} colonias`);
          return colonias;
        } catch (e) {
          console.error('[Colonias] Cache corrupto, limpiando...', e);
          localStorage.removeItem(cacheKey);
          localStorage.removeItem(cacheTsKey);
          // Continuar a fetch desde API
        }
      }
    }
  }
  
  // 2. Cargar desde Supabase filtrado por municipio
  try {
    const { data, error } = await supabase
      .from('colonias')
      .select('id, nombre, seccion_id, tipo, codigo_postal, municipio_id')
      .eq('municipio_id', municipioId)
      .eq('activa', true)
      .order('nombre');
    
    if (error) throw error;
    
    // Guardar en cache específico por municipio
    if (typeof window !== 'undefined' && data) {
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(cacheTsKey, Date.now().toString());
      console.log(`[Colonias] Fetch from API for municipio ${municipioId}: ${data.length} colonias cached`);
    }
    
    return data || [];
  } catch (err) {
    console.error(`[Colonias] Error fetching for municipio ${municipioId}:`, err);
    
    // 3. Fallback a cache aunque esté expirado
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          // S1 FIX: try-catch para JSON.parse
          console.log(`[Colonias] Fallback to expired cache for municipio ${municipioId}`);
          return JSON.parse(cached);
        } catch (e) {
          console.error('[Colonias] Fallback cache corrupto, limpiando...', e);
          localStorage.removeItem(cacheKey);
          localStorage.removeItem(cacheTsKey);
        }
      }
    }
    
    throw err;
  }
}

/**
 * Invalida el cache de colonias para un municipio específico o todos
 * @param {number|null} municipioId - Si null, invalida todos los municipios
 */
export function invalidateColoniasCache(municipioId = null) {
  if (typeof window === 'undefined') return;
  
  if (municipioId) {
    localStorage.removeItem(`${COLONIAS_CACHE_PREFIX}${municipioId}`);
    localStorage.removeItem(`${COLONIAS_CACHE_TIMESTAMP_PREFIX}${municipioId}`);
    console.log(`[Colonias] Cache invalidated for municipio ${municipioId}`);
  } else {
    // Invalidar todos los caches de colonias
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(COLONIAS_CACHE_PREFIX) || key.startsWith(COLONIAS_CACHE_TIMESTAMP_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    console.log('[Colonias] All caches invalidated');
  }
}

// ─── Offline sync ────────────────────────────────────────────────────────────
// ✅ FIX A3: Flag global para prevenir sincronizaciones simultáneas (race condition)
let _syncInProgress = false;

export function savePendingOffline(payload) {
  if (typeof window === 'undefined') return false;
  try {
    const pending = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
    pending.push({ ...sanitizePayload(payload), _savedAt: new Date().toISOString() });
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(pending));
    return true;
  } catch (e) {
    console.error('Error guardando offline:', e);
    return false;
  }
}

export function getPendingCount() {
  if (typeof window === 'undefined') return 0;
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]').length; }
  catch { return 0; }
}

export async function syncOfflineQueue() {
  if (typeof window === 'undefined') return { synced: 0, failed: 0 };
  // ✅ FIX A3: Prevenir ejecuciones simultáneas que causarían registros duplicados
  if (_syncInProgress) {
    console.log('[Sync] Ya hay una sincronización en progreso, omitiendo.');
    return { synced: 0, failed: 0 };
  }

  const raw = localStorage.getItem(OFFLINE_KEY);
  if (!raw) return { synced: 0, failed: 0 };

  _syncInProgress = true;
  const queue = JSON.parse(raw);
  let synced = 0, failed = 0;
  const remaining = [];

  try {
    for (const enc of queue) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _savedAt, ...payload } = enc;
        await insertRespuesta(payload);
        synced++;
      } catch {
        remaining.push(enc);
        failed++;
      }
    }

    if (remaining.length === 0) localStorage.removeItem(OFFLINE_KEY);
    else localStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
  } finally {
    _syncInProgress = false;
  }

  return { synced, failed };
}

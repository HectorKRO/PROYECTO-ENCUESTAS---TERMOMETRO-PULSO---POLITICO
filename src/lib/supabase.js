// lib/supabase.js — Cliente unificado + helpers
import { createClient } from '@supabase/supabase-js';
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
    _client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } },
    });
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
    respuestas: []
  };

  // Builder pattern para queries mock
  const createQueryBuilder = (table) => {
    let filters = {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let ordering = null;
    let limitCount = null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let selecting = '*';
    
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      select: (cols) => {
        return createQueryBuilder(table);
      },
      eq: (col, val) => {
        filters[col] = val;
        return createQueryBuilder(table);
      },
      order: (col, opts) => {
        ordering = { col, ...opts };
        return createQueryBuilder(table);
      },
      limit: (n) => {
        limitCount = n;
        return createQueryBuilder(table);
      },
      single: async () => {
        const data = mockData[table];
        if (!data) return { data: null, error: new Error(`Table ${table} not found in mock`) };
        return { 
          data: Array.isArray(data) ? data[0] : data, 
          error: null 
        };
      },
      then: (callback) => {
        // Para soportar await directo
        let data = mockData[table];
        if (Array.isArray(data) && limitCount) {
          data = data.slice(0, limitCount);
        }
        return Promise.resolve(callback({ data, error: null }));
      }
    };
  };

  return {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'mock-user', email: 'demo@ejemplo.com' } } }, error: null }),
      signInWithOtp: async () => ({ data: null, error: null }),
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

// ─── COLONIAS con Cacheo Inteligente (v2.4) ────────────────────────────────────
const COLONIAS_CACHE_KEY = 'colonias_atlixco_cache';
const COLONIAS_CACHE_TIMESTAMP_KEY = 'colonias_atlixco_timestamp';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Carga colonias desde Supabase con cacheo localStorage
 * Estrategia: 
 * 1. Primero devuelve cache local (respuesta instantánea)
 * 2. Si hay internet, refresca cache en background
 * 3. Si no hay cache y no hay internet, devuelve error
 */
export async function fetchColonias(options = {}) {
  const { forceRefresh = false, skipCache = false } = options;
  
  // 1. Intentar obtener del cache primero (para respuesta rápida)
  if (!skipCache && typeof window !== 'undefined') {
    const cached = localStorage.getItem(COLONIAS_CACHE_KEY);
    const timestamp = localStorage.getItem(COLONIAS_CACHE_TIMESTAMP_KEY);
    const now = Date.now();
    
    if (cached && timestamp) {
      const age = now - parseInt(timestamp);
      // Cache válido si tiene menos de 24 horas
      if (age < CACHE_DURATION_MS && !forceRefresh) {
        const colonias = JSON.parse(cached);
        console.log(`[Colonias] Cache hit: ${colonias.length} colonias`);
        return colonias;
      }
    }
  }
  
  // 2. Si no hay cache o está expirado, cargar desde Supabase
  try {
    const { data, error } = await supabase
      .from('colonias')
      .select('id, nombre, seccion_id, tipo, codigo_postal')
      .eq('activa', true)
      .order('nombre');
    
    if (error) throw error;
    
    // Guardar en cache
    if (typeof window !== 'undefined' && data) {
      localStorage.setItem(COLONIAS_CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(COLONIAS_CACHE_TIMESTAMP_KEY, Date.now().toString());
      console.log(`[Colonias] Fetch from API: ${data.length} colonias cached`);
    }
    
    return data || [];
  } catch (err) {
    console.error('[Colonias] Error fetching:', err);
    
    // 3. Fallback a cache aunque esté expirado (mejor que nada)
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(COLONIAS_CACHE_KEY);
      if (cached) {
        console.log('[Colonias] Fallback to expired cache');
        return JSON.parse(cached);
      }
    }
    
    throw err;
  }
}

/**
 * Invalida el cache de colonias (útil después de actualizaciones)
 */
export function invalidateColoniasCache() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(COLONIAS_CACHE_KEY);
  localStorage.removeItem(COLONIAS_CACHE_TIMESTAMP_KEY);
  console.log('[Colonias] Cache invalidated');
}

// ─── Offline sync ────────────────────────────────────────────────────────────
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
  const raw = localStorage.getItem(OFFLINE_KEY);
  if (!raw) return { synced: 0, failed: 0 };

  const queue = JSON.parse(raw);
  let synced = 0, failed = 0;
  const remaining = [];

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

  return { synced, failed };
}

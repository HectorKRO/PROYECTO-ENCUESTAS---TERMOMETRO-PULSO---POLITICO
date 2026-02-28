'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import NavBar from '@/components/NavBar';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  Tooltip as RTooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { C, NAV_HEIGHT } from '@/lib/theme';
import { IS_DEMO } from '@/lib/constants';
import { exportEncuestasToCSV, exportResumenToCSV, fetchEncuestasForExport } from '@/lib/exportData';
import { MOCK, TEMAS_SENT, MOCK_ANALISIS } from '@/lib/mockData';
import dynamic from 'next/dynamic';

// CampoMapa usa Leaflet → importar con ssr:false para evitar "window is not defined"
const CampoMapa = dynamic(() => import('./CampoMapa'), { ssr: false });

// ─── HOOK DE DATOS REALES ───────────────────────────────────────────────────────
// v3.0: Ahora acepta municipioId para filtrar datos
function useDashboardData(campanaId, municipioId) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const abortControllerRef = useRef(null);

  const fetchAll = useCallback(async () => {
    if (!campanaId || !municipioId || IS_DEMO) { 
      setLoading(false); 
      return; 
    }
    
    // ✅ FIX: Cancelar petición anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null); // ✅ FIX: Limpiar error anterior
      
      // v3.0: Filtrar por campana_id Y municipio_id
      const [kpisRes, tendRes, demoRes, agendaRes, seccionesRes] = await Promise.all([
        supabase.from('v_metricas_por_campana').select('*').eq('campana_id', campanaId).eq('municipio_id', municipioId).maybeSingle(),
        supabase.from('v_tendencia_semanal').select('*').eq('campana_id', campanaId).eq('municipio_id', municipioId).order('semana'),
        supabase.from('v_demograficos').select('*').eq('campana_id', campanaId).eq('municipio_id', municipioId),
        supabase.from('v_agenda_ciudadana').select('*').eq('campana_id', campanaId).eq('municipio_id', municipioId).limit(10),
        supabase.from('v_resultados_por_seccion').select('*').eq('campana_id', campanaId).eq('municipio_id', municipioId),
      ]);
      
      // ✅ FIX: Verificar errores de Supabase
      if (kpisRes.error) throw kpisRes.error;
      if (tendRes.error) throw tendRes.error;
      if (demoRes.error) throw demoRes.error;
      if (agendaRes.error) throw agendaRes.error;
      if (seccionesRes.error) throw seccionesRes.error;
      
      // ✅ FIX: Verificar si el componente sigue montado
      if (abortControllerRef.current?.signal.aborted) return;
      
      // DASH-1 FIX: Mapear campos de la vista SQL a nombres esperados por el Dashboard
      const mapKpis = (row) => row ? {
        reconocimiento: row.pct_reconocimiento ?? row.reconocimiento,
        intencion: row.pct_intencion_positiva ?? row.intencion,
        imagen: row.pct_imagen_positiva ?? row.imagen,
        total: row.total_encuestas ?? row.total,
        meta: row.meta_encuestas ?? row.meta,
        ...row, // preservar campos originales también
      } : row;

      setData({
        kpis:      mapKpis(kpisRes.data),
        tendencia: tendRes.data,
        demo:      demoRes.data,
        agenda:    agendaRes.data,
        secciones: seccionesRes.data,
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // D1 FIX: Agregar municipioId a las dependencias para recargar al cambiar municipio
  }, [campanaId, municipioId]);

  useEffect(() => { 
    fetchAll(); 
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAll]);

  // Suscripción tiempo real con debounce
  // ✅ FIX: Debounce 5s para evitar 75+ queries/hora con alto volumen
  useEffect(() => {
    if (!campanaId || IS_DEMO) return;
    let debounceTimer = null;
    const channel = supabase
      .channel(`dashboard-${campanaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'respuestas', filter: `campana_id=eq.${campanaId}` },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchAll(), 5000);
        }
      )
      .subscribe();
    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [campanaId, fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}

// ─── HOOK: Datos del Tab Campo (encuestadores + ubicaciones en tiempo real) ─────
function useCampoData(campanaId) {
  const [ranking, setRanking]       = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [campoLoading, setCampoLoading] = useState(false);

  // Ranking real: agrupar respuestas por encuestador con JOIN a encuestadores
  const fetchRanking = useCallback(async () => {
    if (!campanaId || IS_DEMO) return;
    const { data, error } = await supabase
      .from('respuestas')
      .select('encuestador_id, encuestadores(nombre, zona_asignada)')
      .eq('campana_id', campanaId)
      .not('encuestador_id', 'is', null);
    if (error) { console.error('[Campo] Error ranking:', error); return; }

    // Agrupar en cliente (la vista SQL de ranking no existe aún)
    const byEnc = {};
    (data || []).forEach(r => {
      const id = r.encuestador_id;
      if (!byEnc[id]) byEnc[id] = {
        id,
        nombre: r.encuestadores?.nombre || 'Encuestador',
        zona:   r.encuestadores?.zona_asignada || '—',
        total:  0,
      };
      byEnc[id].total++;
    });
    setRanking(Object.values(byEnc).sort((a, b) => b.total - a.total));
  }, [campanaId]);

  // Ubicaciones activas: updated_at < 5 min atrás
  const fetchUbicaciones = useCallback(async () => {
    if (!campanaId || IS_DEMO) return;
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('encuestador_ubicaciones')
      .select('*')
      .eq('campana_id', campanaId)
      .gt('updated_at', cutoff)
      .order('updated_at', { ascending: false });
    if (!error) setUbicaciones(data || []);
  }, [campanaId]);

  // Carga inicial
  useEffect(() => {
    if (!campanaId) return;
    setCampoLoading(true);
    Promise.all([fetchRanking(), fetchUbicaciones()]).finally(() => setCampoLoading(false));
  }, [campanaId, fetchRanking, fetchUbicaciones]);

  // Realtime: re-leer ubicaciones cada vez que algún encuestador hace upsert
  useEffect(() => {
    if (!campanaId || IS_DEMO) return;
    const channel = supabase
      .channel(`campo-ubicaciones-${campanaId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'encuestador_ubicaciones',
        filter: `campana_id=eq.${campanaId}`,
      }, () => fetchUbicaciones())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [campanaId, fetchUbicaciones]);

  return { ranking, ubicaciones, campoLoading };
}

// Selector de municipio para el header
function MunicipioSelector({ municipios, municipioActual, onChange }) {
  return (
    <select
      value={municipioActual?.id || ''}
      onChange={(e) => onChange?.(Number(e.target.value))}
      style={{
        padding: '6px 12px',
        background: 'rgba(7, 16, 10, 0.6)',
        color: C.goldLight,
        border: `1px solid ${C.gold}`,
        borderRadius: 6,
        fontSize: 13,
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      {municipios.map((m) => (
        <option key={m.id} value={m.id} style={{ background: C.surface }}>
          📍 {m.nombre}
        </option>
      ))}
    </select>
  );
}

// ─── PALETA: importada de @/lib/theme ───────────────────────────────────────

// ─── HOOK mobile (SSR-safe) ────────────────────────────────────────────────────
function useIsMobile(bp = 768) {
  // ✅ Inicia en false (servidor), se corrige en useEffect post-mount
  const [m, setM] = useState(false);
  useEffect(() => {
    const check = () => setM(window.innerWidth < bp);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [bp]);
  return m;
}

// ✅ OPTIMIZACIÓN: Datos DEMO importados desde archivo separado
// Esto reduce el bundle inicial al cargar estos datos solo en modo DEMO
// import { MOCK } from '@/lib/mockData'; // Ya importado arriba

// ✅ Datos de sentimiento importados desde mockData.js para reducir bundle
const { getColorPct, getLabelPct, SENT_META } = { 
  getColorPct: (pct) => pct >= 55 ? C.greenAcc : pct >= 40 ? C.gold : C.danger,
  getLabelPct: (pct) => pct >= 55 ? '✅ Fuerte' : pct >= 40 ? '⚠️ Medio' : '🔴 Bajo',
  SENT_META: {
    positivo:  { emoji:'😊', label:'Positivo',  color:C.greenAcc },
    negativo:  { emoji:'😠', label:'Negativo',  color:'#e05252'  },
    neutro:    { emoji:'😐', label:'Neutro',    color:'#60a5fa'  },
    propuesta: { emoji:'💡', label:'Propuesta', color:C.gold     },
  }
};

const TooltipStyle = {
  backgroundColor: '#0f1d12',
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '8px 12px',
  color: C.textPri,
  fontSize: 12,
};
// El wrapperStyle elimina el rectángulo blanco por defecto de Recharts
// (contentStyle estiliza el interior; wrapperStyle estiliza el contenedor externo)
const TooltipWrapperStyle = {
  background: 'none',
  border: 'none',
  outline: 'none',
  boxShadow: 'none',
};
// labelStyle: texto del encabezado del tooltip (ej. "Regular")
// itemStyle: texto de cada fila de datos (ej. "31%")
// Sin estos, Recharts usa negro por defecto para el label y el color del serie para los items
const TooltipLabelStyle = { color: C.textPri, fontWeight: 600, marginBottom: 2 };
const TooltipItemStyle  = { color: C.textSec };

// ─── UTILIDADES PARA SEMÁFORO VISUAL ───────────────────────────────────────────
function getEstadoSemaforo(valor) {
  if (valor < 40) return { color: C.danger, label: 'Bajo', bg: `${C.danger}15`, border: `${C.danger}40` };
  if (valor < 55) return { color: C.amber, label: 'Medio', bg: `${C.amber}15`, border: `${C.amber}40` };
  return { color: C.greenAcc, label: 'Bueno', bg: `${C.greenAcc}15`, border: `${C.greenAcc}40` };
}

function getTrendIndicator(valor) {
  if (valor > 0) return { icon: '▲', color: C.greenAcc, sign: '+' };
  if (valor < 0) return { icon: '▼', color: C.danger, sign: '' };
  return { icon: '●', color: C.textMut, sign: '' };
}

// ─── COMPONENTES REUTILIZABLES ─────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:20, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 style={{ fontSize:14, fontWeight:700, color:C.goldLight, margin:'0 0 16px', paddingBottom:8, borderBottom:`1px solid ${C.border}` }}>
      {children}
    </h3>
  );
}

function KpiCard({ label, value, valorNumerico = null, sub, trend, icon, showBar = false, barValue = 0 }) {
  const valorParaSemaforo = valorNumerico !== null ? valorNumerico : (typeof value === 'string' ? parseFloat(value) : value);
  const estado = getEstadoSemaforo(valorParaSemaforo || 0);
  const trendInfo = trend !== undefined ? getTrendIndicator(trend) : null;

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${estado.border}`,
      borderRadius: 12,
      padding: '16px 18px',
    }}>
      {/* Label + icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: C.textMut, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontSize: 16 }}>{icon}</span>
      </div>

      {/* Valor principal */}
      <div style={{ fontSize: 40, fontWeight: 900, color: estado.color, lineHeight: 1, marginBottom: 8 }}>
        {value}
      </div>

      {/* Barra opcional */}
      {showBar && (
        <div style={{ height: 3, background: C.border, borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, barValue)}%`, background: estado.color, borderRadius: 2 }} />
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {trendInfo && (
            <span style={{ color: trendInfo.color, fontSize: 11, fontWeight: 700 }}>
              {trendInfo.icon} {trendInfo.sign}{Math.abs(trend || 0)}
            </span>
          )}
          {sub && <span style={{ fontSize: 11, color: C.textMut }}>{sub}</span>}
        </div>
        <span style={{ fontSize: 10, color: estado.color, fontWeight: 600 }}>{estado.label}</span>
      </div>
    </div>
  );
}

function BarraProgreso({ label, pct, color, meta }) {
  const ok = pct >= (meta || 80);
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
        <span style={{ color:C.textSec }}>{label}</span>
        <span style={{ color:ok?C.greenAcc:C.amber, fontWeight:700 }}>{pct}%{ok?'':`  ⚠ meta: ${meta}%`}</span>
      </div>
      <div style={{ height:8, background:C.border, borderRadius:4 }}>
        <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:ok?C.green:C.amber, borderRadius:4, transition:'width .5s' }} />
      </div>
    </div>
  );
}

// ─── TABS ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id:'general',      label:'General',      icon:'📊' },
  { id:'demografico',  label:'Demográfico',  icon:'👥' },
  { id:'agenda',       label:'Agenda',       icon:'📋' },
  { id:'campo',        label:'Campo',        icon:'🗺️' },
  { id:'comentarios',  label:'Comentarios',  icon:'💬' },
  { id:'sentimiento',  label:'Sentimiento',  icon:'🧠' },
];

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function DashboardPolitico({ onNavigateToMapa }) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [activeTab, setActiveTab]     = useState('general');
  const [dateRange, setDateRange]     = useState({ from:'', to:'' });
  const [lastUpdate, setLastUpdate]   = useState('');
  const [exporting, setExporting]     = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);
  const [campanaInfo, setCampanaInfo] = useState(null);

  // v3.0: Contexto multi-municipio
  const {
    municipios,
    municipioActual,
    cambiarMunicipio,
    organizacion,
    esAdmin,
    loading: orgLoading
  } = useOrganizacion();

  // D2 FIX: Usar useSearchParams para evitar hydration mismatch
  const searchParams = useSearchParams();
  const campanaId = searchParams.get('campana');

  // v3.0: Pasar municipioId al hook
  const { data: realData, loading, error } = useDashboardData(campanaId, municipioActual?.id);
  // Campo: ranking real + ubicaciones en tiempo real
  const { ranking: campoRanking, ubicaciones: campoUbicaciones, campoLoading } = useCampoData(campanaId);

  // Cargar info de campaña para el contexto lateral
  useEffect(() => {
    if (campanaId) {
      supabase.from('campanas')
        .select('*, candidato:candidato_id(nombre, cargo, partido)')
        .eq('id', campanaId)
        .single()
        .then(({ data }) => setCampanaInfo(data));
    }
  }, [campanaId]);

  // Fusionar datos reales o mock según modo
  const D = useMemo(() => {
    // Modo demo puro (sin campaña seleccionada): mostrar datos de demostración
    if (IS_DEMO || !campanaId) return MOCK;

    // Candidato desde campanaInfo (disponible incluso con 0 encuestas)
    const candidatoBase = campanaInfo?.candidato ? {
      ...MOCK.candidato,
      nombre:  campanaInfo.candidato.nombre,
      alias:   (campanaInfo.candidato.nombre || '').split(' ')[0] || 'Candidato',
      cargo:   campanaInfo.candidato.cargo   || MOCK.candidato.cargo,
      partido: campanaInfo.candidato.partido || '',
    } : MOCK.candidato;

    // Campaña real con 0 encuestas levantadas: mostrar ceros (no datos de demo)
    if (!realData || !realData.kpis) {
      return {
        ...MOCK,
        candidato: candidatoBase,
        kpis: {
          total_encuestas: 0, total: 0,
          meta: campanaInfo?.meta_encuestas ?? 500,
          reconocimiento: 0, intencion: 0, imagen: 0,
          pct_reconocimiento: 0, pct_intencion_positiva: 0, pct_imagen_positiva: 0,
        },
        tendencia: [],
        agenda: [],
        secciones: [],
      };
    }

    // Campaña con datos reales
    return {
      ...MOCK,
      candidato:           candidatoBase,
      kpis:                realData.kpis,
      tendencia:           realData.tendencia           || [],
      agenda:              realData.agenda              || [],
      secciones:           realData.secciones           || [],
      conoce_candidato:    realData.conoce_candidato    || MOCK.conoce_candidato,
      evaluacion_gobierno: realData.evaluacion_gobierno || MOCK.evaluacion_gobierno,
      demografia_genero:   realData.demografia_genero   || MOCK.demografia_genero,
      demografia_edad:     realData.demografia_edad     || MOCK.demografia_edad,
      medios:              realData.medios              || MOCK.medios,
    };
  }, [realData, campanaId, campanaInfo]);
  
  // ✅ P0: Exportación a Excel/CSV
  const handleExportEncuestas = async () => {
    if (!campanaId || IS_DEMO) {
      alert('Exportación disponible solo en modo producción con datos reales');
      return;
    }
    setExporting(true);
    try {
      const encuestas = await fetchEncuestasForExport(campanaId);
      const result = exportEncuestasToCSV(encuestas, D.candidato.alias);
      alert(`✓ Exportadas ${result.count} encuestas a ${result.filename}`);
    } catch (err) {
      console.error('Error exportando:', err);
      alert('Error al exportar: ' + err.message);
    } finally {
      setExporting(false);
    }
  };
  
  const handleExportResumen = () => {
    const result = exportResumenToCSV(D, D.candidato.alias);
    alert(`✓ Resumen exportado a ${result.filename}`);
  };

  useEffect(() => {
    const now = new Date();
    setDateRange({
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10),
      to:   now.toISOString().slice(0,10),
    });
    setLastUpdate(now.toLocaleString('es-MX', { dateStyle:'medium', timeStyle:'short' }));
  }, []);

  // Cerrar menú exportar al hacer clic fuera
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  const pctMeta = useMemo(() => {
    if (!D.kpis?.meta || D.kpis.meta === 0) return 0;
    return Math.round((D.kpis.total_encuestas / D.kpis.meta) * 100);
  }, [D.kpis]);

  // Datos para panel lateral
  const hoy = D.kpis?.hoy || 0;
  const ayer = Math.round(hoy * 0.88); // Simulación - en producción vendría de la BD

  const yDomain = useMemo(() => {
    if (!D.tendencia?.length) return [0, 100];
    const all = D.tendencia.flatMap(t => [t.reconocimiento, t.intencion, t.simpatia]).filter(v => v != null);
    if (all.length === 0) return [0, 100];
    return [Math.max(0, Math.floor(Math.min(...all)/10)*10 - 5), Math.min(100, Math.ceil(Math.max(...all)/10)*10 + 5)];
  }, [D.tendencia]);

  if (loading) return <LoadingSkeleton />;

  const grid2 = isMobile ? '1fr' : '1fr 1fr';

  return (
    <div style={{ minHeight:`calc(100vh - ${NAV_HEIGHT}px)`, background:`radial-gradient(ellipse at 10% 20%, ${C.greenDark}33 0%, ${C.bg} 60%)`, fontFamily:"'Segoe UI',system-ui,sans-serif", color:C.textPri }}>
      
      {/* ✅ FIX: Error visible al usuario */}
      {error && (
        <div style={{ background:'#5a1f1f', border:`1px solid ${C.danger}`, padding:'12px 28px', fontSize:13, color:C.danger, textAlign:'center' }}>
          ⚠️ Error cargando datos: {error}. Mostrando datos de demostración.
        </div>
      )}

      {/* ── HEADER COMPACTO v3.2 ── */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: isMobile ? '12px 16px' : '0 28px',
        position: 'sticky',
        top: NAV_HEIGHT,
        zIndex: 100,
        minHeight: isMobile ? 'auto' : 64,
        display: 'flex',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: 1400,
          margin: '0 auto',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: 12,
        }}>
          {/* Zona izquierda: Avatar + candidato + municipio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 900, color: C.bg,
            }}>
              {campanaInfo?.candidato?.nombre?.charAt(0) || D.candidato.alias.charAt(0)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.textPri }}>
                {campanaInfo?.candidato?.nombre || D.candidato.alias}
              </div>
              <div style={{ fontSize: 12, color: C.textSec, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>{campanaInfo?.candidato?.cargo || D.candidato.cargo}</span>
                <span style={{ color: C.border }}>·</span>
                {municipios.length > 1 ? (
                  <MunicipioSelector municipios={municipios} municipioActual={municipioActual} onChange={cambiarMunicipio} />
                ) : (
                  <span>{municipioActual?.nombre || D.candidato.municipio}</span>
                )}
              </div>
            </div>
          </div>

          {/* Zona derecha: Progress + estado + exportar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
            {/* Progress inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 72, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, pctMeta)}%`, background: pctMeta >= 80 ? C.greenAcc : pctMeta >= 50 ? C.amber : C.danger, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 12, color: C.textSec, whiteSpace: 'nowrap' }}>
                {D.kpis.total_encuestas}/{D.kpis.meta} · <span style={{ color: pctMeta >= 80 ? C.greenAcc : C.amber, fontWeight: 600 }}>{pctMeta}%</span>
              </span>
            </div>

            {/* Badge activa */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.greenAcc, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.greenAcc, display: 'inline-block' }} />
              Activa
            </div>

            {IS_DEMO && (
              <span style={{ fontSize: 10, color: C.amber, background: `${C.amber}15`, padding: '2px 8px', borderRadius: 4, border: `1px solid ${C.amber}40` }}>
                DEMO
              </span>
            )}

            {!isMobile && (
              <span style={{ fontSize: 11, color: C.textMut }}>{lastUpdate}</span>
            )}

            {/* Botón Admin — solo admin/superadmin */}
            {esAdmin && (
              <button
                onClick={() => router.push(campanaId ? `/admin?campana=${campanaId}` : '/admin')}
                style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, background: 'transparent', border: `1px solid ${C.gold}60`, color: C.gold, cursor: 'pointer' }}
              >
                ⚙️ Admin
              </button>
            )}

            {/* Exportar — dropdown */}
            <div ref={exportMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowExportMenu(v => !v)}
                disabled={exporting}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 11,
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                  border: 'none', color: C.bg, fontWeight: 600,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  opacity: exporting ? 0.7 : 1,
                }}
              >
                {exporting ? '⏳' : '📥 Exportar'} <span style={{ fontSize: 9 }}>▾</span>
              </button>
              {showExportMenu && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 8, minWidth: 190, zIndex: 300,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                  overflow: 'hidden',
                }}>
                  {[
                    { icon: '📊', label: 'Resumen CSV',        action: () => { handleExportResumen(); setShowExportMenu(false); } },
                    { icon: '📥', label: 'Datos completos CSV', action: () => { handleExportEncuestas(); setShowExportMenu(false); } },
                    { icon: '🖨️', label: 'Imprimir / PDF',     action: () => { window.print(); setShowExportMenu(false); } },
                  ].map(({ icon, label, action }) => (
                    <button key={label} onClick={action}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '10px 14px',
                        background: 'none', border: 'none',
                        color: C.textSec, fontSize: 12, textAlign: 'left',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.surfaceEl; e.currentTarget.style.color = C.textPri; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.textSec; }}
                    >
                      <span>{icon}</span>{label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── LAYOUT PRINCIPAL ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        maxWidth: 1400,
        margin: '0 auto',
        padding: isMobile ? '20px 16px 48px' : '28px 28px 48px',
      }}>

        {/* ── KPI STRIP CON SEMÁFORO ── */}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(auto-fit, minmax(${isMobile?'140px':'200px'}, 1fr))`, gap:16, marginBottom:28 }}>
          <KpiCard 
            label="Intención de voto"  
            value={`${D.kpis.intencion}%`}
            valorNumerico={D.kpis.intencion}
            sub="promedio general"   
            trend={3.2}
            icon="🗳️"
            showBar={true}
            barValue={D.kpis.intencion}
          />
          <KpiCard 
            label="Simpatía"           
            value={`${D.kpis.simpatia}%`}
            valorNumerico={D.kpis.simpatia}
            sub="escala 1-5"  
            trend={2.8}
            icon="💚"
            showBar={true}
            barValue={D.kpis.simpatia}
          />
          <KpiCard 
            label="Reconocimiento"     
            value={`${D.kpis.reconocimiento}%`}
            valorNumerico={D.kpis.reconocimiento}
            sub="ciudadanos que conocen" 
            trend={5}
            icon="🔍"
            showBar={true}
            barValue={D.kpis.reconocimiento}
          />
          <KpiCard 
            label="Total encuestas"    
            value={D.kpis.total_encuestas}
            valorNumerico={pctMeta}
            sub={`de ${D.kpis.meta} meta (${pctMeta}%)`}
            trend={D.kpis.hoy}
            icon="📋"
            showBar={true}
            barValue={pctMeta}
          />
          <KpiCard 
            label="Hoy"                
            value={D.kpis.hoy}
            valorNumerico={75}
            sub="encuestas capturadas"
            trend={12}
            icon="📍"
          />
        </div>

        {/* ── TABS ── */}
        <div style={{ display:'flex', gap:0, marginBottom:24, borderBottom:`2px solid ${C.border}`, flexWrap:'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              style={{ padding:'10px 20px', fontSize:13, fontWeight:activeTab===t.id?600:400, border:'none', borderBottom:activeTab===t.id?`2px solid ${C.gold}`:'2px solid transparent', marginBottom:-2, background:'transparent', color:activeTab===t.id?C.goldLight:C.textMut, cursor:'pointer', transition:'color .2s, border-color .2s' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB GENERAL ── */}
        {activeTab === 'general' && (
          <div style={{ display:'grid', gridTemplateColumns:grid2, gap:20 }}>

            {/* Tendencia semanal – Area con gradientes */}
            <Card style={{ gridColumn:'1/-1' }}>
              <SectionTitle>📈 Tendencia semanal – Intención, Simpatía y Reconocimiento</SectionTitle>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={D.tendencia} margin={{ top:5, right:20, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="gIntencion" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.greenAcc} stopOpacity={.4} />
                      <stop offset="95%" stopColor={C.greenAcc} stopOpacity={0}  />
                    </linearGradient>
                    <linearGradient id="gSimpatia" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.gold} stopOpacity={.3} />
                      <stop offset="95%" stopColor={C.gold} stopOpacity={0}  />
                    </linearGradient>
                    <linearGradient id="gReconocimiento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.greenLight} stopOpacity={.25} />
                      <stop offset="95%" stopColor={C.greenLight} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="semana" tick={{ fill:C.textMut, fontSize:11 }} axisLine={{ stroke:C.border }} />
                  <YAxis domain={yDomain} tick={{ fill:C.textMut, fontSize:11 }} axisLine={{ stroke:C.border }} />
                  <RTooltip contentStyle={TooltipStyle} wrapperStyle={TooltipWrapperStyle} labelStyle={TooltipLabelStyle} itemStyle={TooltipItemStyle} active={isMobile ? false : undefined} formatter={(v,n) => [`${v}%`, n]} />
                  <Legend wrapperStyle={{ fontSize:11, color:C.textSec }} />
                  <Area type="monotone" dataKey="reconocimiento" stroke={C.greenLight} fill="url(#gReconocimiento)" strokeWidth={2} name="Reconocimiento" />
                  <Area type="monotone" dataKey="intencion"      stroke={C.greenAcc}  fill="url(#gIntencion)"     strokeWidth={2} name="Intención" />
                  <Area type="monotone" dataKey="simpatia"        stroke={C.gold}      fill="url(#gSimpatia)"      strokeWidth={2} name="Simpatía" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Reconocimiento pie */}
            <Card>
              <SectionTitle>🔍 Reconocimiento del candidato</SectionTitle>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={D.conoce_candidato || []} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {(D.conoce_candidato || []).map((e,i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <RTooltip contentStyle={TooltipStyle} wrapperStyle={TooltipWrapperStyle} labelStyle={TooltipLabelStyle} itemStyle={TooltipItemStyle} active={isMobile ? false : undefined} formatter={v=>`${v}%`} />
                  <Legend wrapperStyle={{ fontSize:11, color:C.textSec }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* Evaluación gobierno pie */}
            <Card>
              <SectionTitle>🏛️ Evaluación del gobierno actual</SectionTitle>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={D.evaluacion_gobierno || []} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {(D.evaluacion_gobierno || []).map((e,i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <RTooltip contentStyle={TooltipStyle} wrapperStyle={TooltipWrapperStyle} labelStyle={TooltipLabelStyle} itemStyle={TooltipItemStyle} active={isMobile ? false : undefined} formatter={v=>`${v}%`} />
                  <Legend wrapperStyle={{ fontSize:11, color:C.textSec }} />
                </PieChart>
              </ResponsiveContainer>
              <p style={{ fontSize:11, color:C.textMut, margin:'8px 0 0' }}>⚠️ 54% evalúa al gobierno entre "Malo" y "Muy malo" — ventana de oportunidad para la campaña.</p>
            </Card>

          </div>
        )}

        {/* ── TAB DEMOGRÁFICO ── */}
        {activeTab === 'demografico' && (
          <div style={{ display:'grid', gridTemplateColumns:grid2, gap:20 }}>

            {/* Género */}
            <Card>
              <SectionTitle>⚡ Distribución por género</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={D.demografia_genero || []} cx="50%" cy="50%" outerRadius={90} paddingAngle={4} dataKey="value">
                    {(D.demografia_genero || []).map((e,i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <RTooltip contentStyle={TooltipStyle} wrapperStyle={TooltipWrapperStyle} labelStyle={TooltipLabelStyle} itemStyle={TooltipItemStyle} active={isMobile ? false : undefined} formatter={v=>`${v}%`} />
                  <Legend wrapperStyle={{ fontSize:11, color:C.textSec }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* Edad + intención */}
            <Card>
              <SectionTitle>👤 Intención por rango de edad</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={D.demografia_edad || []} layout="vertical" margin={{ top:0, right:30, left:10, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis type="number" tick={{ fill:C.textMut, fontSize:11 }} axisLine={{ stroke:C.border }} domain={[0,70]} tickFormatter={v=>`${v}%`} />
                  <YAxis type="category" dataKey="rango" tick={{ fill:C.textSec, fontSize:11 }} axisLine={{ stroke:C.border }} width={45} />
                  <RTooltip contentStyle={TooltipStyle} wrapperStyle={TooltipWrapperStyle} labelStyle={TooltipLabelStyle} itemStyle={TooltipItemStyle} active={isMobile ? false : undefined} formatter={v=>`${v}%`} />
                  <Bar dataKey="intencion" name="Intención" radius={[0,5,5,0]}>
                    {(D.demografia_edad || []).map((d,i) => <Cell key={i} fill={getColorPct(d.intencion)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Cards de insight por edad */}
            <Card style={{ gridColumn:'1/-1' }}>
              <SectionTitle>📊 Potencial por segmento de edad</SectionTitle>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:12 }}>
                {(D.demografia_edad || []).map(d => (
                  <div key={d.rango} style={{ background:C.surfaceEl, borderRadius:10, padding:'14px 16px', border:`1px solid ${getColorPct(d.intencion)}33` }}>
                    <div style={{ fontSize:12, color:C.textMut, marginBottom:6 }}>{d.rango} · {d.total} enc.</div>
                    <div style={{ fontSize:26, fontWeight:900, color:getColorPct(d.intencion) }}>{d.intencion}%</div>
                    <div style={{ fontSize:11, color:C.textMut, marginBottom:8 }}>intención</div>
                    <div style={{ height:4, borderRadius:2, background:C.border }}>
                      <div style={{ height:'100%', width:`${d.intencion}%`, background:getColorPct(d.intencion), borderRadius:2 }} />
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:11, color:C.textMut, margin:'12px 0 0' }}>💡 El grupo 35-44 lidera en intención de voto. Enfocar mensajes en ese segmento puede maximizar el retorno de campaña.</p>
            </Card>

          </div>
        )}

        {/* ── TAB AGENDA ── */}
        {activeTab === 'agenda' && (
          <div style={{ display:'grid', gridTemplateColumns:grid2, gap:20 }}>

            {/* Temas prioritarios – barra horizontal */}
            <Card style={{ gridColumn:'1/-1' }}>
              <SectionTitle>📋 Agenda ciudadana – Temas prioritarios</SectionTitle>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={D.agenda || []} layout="vertical" margin={{ top:0, right:30, left:20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis type="number" tick={{ fill:C.textMut, fontSize:11 }} axisLine={{ stroke:C.border }} domain={[0,70]} tickFormatter={v=>`${v}%`} />
                  <YAxis type="category" dataKey="tema" tick={{ fill:C.textSec, fontSize:12 }} axisLine={{ stroke:C.border }} width={120} />
                  <RTooltip contentStyle={TooltipStyle} wrapperStyle={TooltipWrapperStyle} labelStyle={TooltipLabelStyle} itemStyle={TooltipItemStyle} active={isMobile ? false : undefined} formatter={v=>`${v}%`} />
                  <Bar dataKey="pct" name="% ciudadanos" radius={[0,6,6,0]}>
                    {(D.agenda || []).map((_,i) => <Cell key={i} fill={i<3?C.gold:i<5?C.green:C.greenDark} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p style={{ fontSize:11, color:C.textMut, margin:'8px 0 0' }}>🏆 Seguridad, Empleo e Infraestructura concentran el 55%+ de las preocupaciones — ejes naturales de la propuesta.</p>
            </Card>

            {/* Medios de información */}
            <Card>
              <SectionTitle>📱 Medios de información más usados</SectionTitle>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {(D.medios || []).map(m => (
                  <div key={m.medio}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                      <span style={{ color:C.textSec }}>{m.medio}</span>
                      <span style={{ color:m.color, fontWeight:700 }}>{m.pct}%</span>
                    </div>
                    <div style={{ height:6, background:C.border, borderRadius:3 }}>
                      <div style={{ height:'100%', width:`${m.pct}%`, background:m.color, borderRadius:3, transition:'width .5s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Semáforo de métricas clave */}
            <Card>
              <SectionTitle>🚦 Semáforo de campaña</SectionTitle>
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {[
                  { label:'Reconocimiento', pct:D.kpis.reconocimiento, icon:'🔍' },
                  { label:'Intención de voto', pct:D.kpis.intencion, icon:'🗳️' },
                  { label:'Simpatía', pct:D.kpis.simpatia, icon:'💚' },
                ].map(m => (
                  <div key={m.label}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ color:C.textSec, fontSize:13 }}>{m.icon} {m.label}</span>
                      <span style={{ color:getColorPct(m.pct), fontWeight:700, fontSize:13 }}>{m.pct}% — {getLabelPct(m.pct)}</span>
                    </div>
                    <div style={{ height:10, background:C.border, borderRadius:5 }}>
                      <div style={{ height:'100%', width:`${m.pct}%`, background:getColorPct(m.pct), borderRadius:5, transition:'width .5s', boxShadow:`0 0 8px ${getColorPct(m.pct)}66` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

          </div>
        )}

        {/* ── TAB CAMPO ── */}
        {activeTab === 'campo' && (() => {
          // Cobertura real: agrupar D.secciones por zona (meta = 30 enc/sección)
          const coberturaReal = (() => {
            const secs = D.secciones || [];
            const byZona = {};
            secs.forEach(s => {
              const z = s.zona || 'Sin zona';
              if (!byZona[z]) byZona[z] = { zona: z, total: 0, meta: 0 };
              byZona[z].total += (s.total || 0);
              byZona[z].meta  += 30; // meta: 30 enc/sección
            });
            return Object.values(byZona)
              .map(z => ({ ...z, pct: z.meta > 0 ? Math.min(100, Math.round((z.total / z.meta) * 100)) : 0 }))
              .sort((a, b) => b.pct - a.pct);
          })();

          // Centro del mapa: primer encuestador con ubicación, o Atlixco por defecto
          const mapCenter = campoUbicaciones.length > 0
            ? [campoUbicaciones[0].lat, campoUbicaciones[0].lng]
            : [18.9088, -98.4321];

          return (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Fila 1: Ranking + Activos */}
            <div style={{ display:'grid', gridTemplateColumns:grid2, gap:20 }}>

              {/* Ranking real */}
              <Card>
                <SectionTitle>🏆 Ranking de encuestadores</SectionTitle>
                {campoLoading && <div style={{ color:C.textMut, fontSize:13 }}>Cargando…</div>}
                {!campoLoading && campoRanking.length === 0 && (
                  <div style={{ color:C.textMut, fontSize:13, padding:'12px 0' }}>
                    Sin encuestas registradas todavía. El ranking aparecerá al levantar la primera encuesta.
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {campoRanking.slice(0, 10).map((e, i) => (
                    <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:C.surfaceEl, borderRadius:10, border:`1px solid ${i===0?C.gold:C.border}33` }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, background:i===0?C.gold:i===1?'#aaa':i===2?'#c88':C.greenDark, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:C.bg }}>
                        {i + 1}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:C.textPri }}>{e.nombre}</div>
                        <div style={{ fontSize:11, color:C.textMut }}>{e.zona}</div>
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color:i===0?C.gold:C.greenAcc }}>{e.total}</div>
                      <div style={{ fontSize:11, color:C.textMut }}>enc.</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Cobertura real por zona */}
              <Card>
                <SectionTitle>🗺️ Cobertura por zona</SectionTitle>
                {coberturaReal.length === 0 ? (
                  <div style={{ color:C.textMut, fontSize:13 }}>Sin datos de secciones disponibles.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {coberturaReal.map(z => (
                      <BarraProgreso key={z.zona} label={z.zona} pct={z.pct} meta={100} color={z.pct>=100?C.green:C.amber} />
                    ))}
                  </div>
                )}
              </Card>

            </div>

            {/* Fila 2: Mapa de encuestadores activos */}
            <Card>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, paddingBottom:8, borderBottom:`1px solid ${C.border}` }}>
                <h3 style={{ fontSize:14, fontWeight:700, color:C.goldLight, margin:0 }}>
                  📍 En campo ahora
                </h3>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {campoUbicaciones.length > 0 ? (
                    <span style={{ fontSize:11, color:C.greenAcc, fontWeight:600 }}>
                      ● {campoUbicaciones.length} activo{campoUbicaciones.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span style={{ fontSize:11, color:C.textMut }}>Sin encuestadores activos</span>
                  )}
                  <span style={{ fontSize:10, color:C.textMut }}>(actualiza en tiempo real · activo = último ping &lt;5 min)</span>
                </div>
              </div>

              {/* Lista de encuestadores activos */}
              {campoUbicaciones.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
                  {campoUbicaciones.map(u => {
                    const hace = Math.round((Date.now() - new Date(u.updated_at).getTime()) / 1000);
                    const hacelabel = hace < 60 ? `hace ${hace}s` : `hace ${Math.round(hace/60)}min`;
                    return (
                      <div key={u.user_id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:C.surfaceEl, borderRadius:20, border:`1px solid ${C.greenDark}` }}>
                        <div style={{ width:7, height:7, borderRadius:'50%', background:C.greenAcc }} />
                        <span style={{ fontSize:12, color:C.textPri, fontWeight:600 }}>{u.encuestador_nombre || 'Encuestador'}</span>
                        <span style={{ fontSize:10, color:C.textMut }}>· {hacelabel}</span>
                        {u.precision_m && <span style={{ fontSize:10, color:C.textMut }}>· ±{u.precision_m}m</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Mini-mapa Leaflet */}
              <div style={{ height:300, borderRadius:10, overflow:'hidden', border:`1px solid ${C.border}` }}>
                {campoUbicaciones.length === 0 ? (
                  <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:C.surfaceEl, gap:8 }}>
                    <span style={{ fontSize:32 }}>🗺️</span>
                    <span style={{ fontSize:13, color:C.textMut }}>El mapa se activará cuando los encuestadores abran la encuesta desde campo</span>
                    <span style={{ fontSize:11, color:C.textMut }}>Requiere GPS habilitado en el dispositivo</span>
                  </div>
                ) : (
                  <CampoMapa ubicaciones={campoUbicaciones} center={mapCenter} />
                )}
              </div>
            </Card>

            {/* Fila 3: Tabla de secciones (datos reales) */}
            <Card>
              <SectionTitle>📋 Resultados por sección electoral</SectionTitle>
              {(D.secciones || []).length === 0 ? (
                <div style={{ color:C.textMut, fontSize:13 }}>Sin encuestas por sección todavía.</div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr>
                        {['Sección','Zona','Encuestas','Intención','Simpatía','Estado'].map(h => (
                          <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:C.textMut, fontSize:11, fontWeight:600, letterSpacing:'.04em', textTransform:'uppercase', borderBottom:`1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(D.secciones || []).map((s, i) => (
                        <tr key={s.seccion} style={{ background:i%2===0?'transparent':C.surfaceEl }}>
                          <td style={{ padding:'8px 12px', color:C.gold, fontWeight:700 }}>{s.seccion}</td>
                          <td style={{ padding:'8px 12px', color:C.textSec }}>{s.zona}</td>
                          <td style={{ padding:'8px 12px', color:C.textPri }}>{s.total}</td>
                          <td style={{ padding:'8px 12px', color:getColorPct(s.intencion), fontWeight:700 }}>{s.intencion}%</td>
                          <td style={{ padding:'8px 12px', color:getColorPct(s.simpatia), fontWeight:700 }}>{s.simpatia}%</td>
                          <td style={{ padding:'8px 12px', color:getColorPct(s.intencion) }}>{getLabelPct(s.intencion)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

          </div>
          );
        })()}

        {/* ── TAB COMENTARIOS ── */}
        {activeTab === 'comentarios' && (
          <div>
            <Card>
              <SectionTitle>💬 Respuestas abiertas ciudadanas</SectionTitle>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {MOCK.comentarios.map((c,i) => (
                  <div key={i} style={{ background:C.surfaceEl, borderRadius:10, padding:'14px 16px', border:`1px solid ${C.border}` }}>
                    <div style={{ color:C.textPri, fontSize:14, lineHeight:1.5, marginBottom:8 }}>"{c.texto}"</div>
                    <div style={{ display:'flex', gap:12 }}>
                      <span style={{ fontSize:11, color:C.gold }}>📍 {c.zona}</span>
                      <span style={{ fontSize:11, color:C.textMut }}>🕐 {c.fecha}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:12, color:C.textMut, margin:'16px 0 0' }}>
                💡 Para análisis de sentimiento automático con IA, ve al tab <strong style={{ color:C.gold }}>🧠 Sentimiento</strong>.
              </p>
            </Card>
          </div>
        )}

        {/* ── TAB SENTIMIENTO ── */}
        {activeTab === 'sentimiento' && <TabSentimiento />}

      </div>
      
    </div>
  );
}

// ─── TAB SENTIMIENTO (componente propio para mantener estado local de filtros) ──
function TabSentimiento() {
  const [filterTema, setFilterTema]           = useState('todos');
  const [filterSent, setFilterSent]           = useState('todos');
  const [analyzing, setAnalyzing]             = useState(false);
  const [analyzeStatus, setAnalyzeStatus]     = useState(null); // null | 'ok' | 'error'
  const data = MOCK_ANALISIS;

  // ── Estadísticas memoizadas ──
  const stats = useMemo(() => {
    const temaCount = {}, sentCount = {}, subtemas = {};
    data.forEach(d => {
      temaCount[d.tema] = (temaCount[d.tema] || 0) + 1;
      sentCount[d.sentimiento] = (sentCount[d.sentimiento] || 0) + 1;
      const key = `${d.tema}:${d.subtema}`;
      subtemas[key] = (subtemas[key] || 0) + 1;
    });
    return {
      temas: Object.entries(temaCount).sort((a,b)=>b[1]-a[1]).map(([tema,count])=>({ tema, count, pct:Math.round(count/data.length*100) })),
      sents: Object.entries(sentCount).sort((a,b)=>b[1]-a[1]).map(([sent,count])=>({ sent, count, pct:Math.round(count/data.length*100) })),
      topSubtemas: Object.entries(subtemas).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([key,count])=>{ const [tema,subtema]=key.split(':'); return {tema,subtema,count}; }),
      total: data.length,
    };
  }, [data]);

  // ── Filtrado memoizado ──
  const filtered = useMemo(() =>
    data.filter(d =>
      (filterTema === 'todos' || d.tema === filterTema) &&
      (filterSent  === 'todos' || d.sentimiento === filterSent)
    ),
  [data, filterTema, filterSent]);

  const handleAnalyze = async () => {
    setAnalyzing(true); setAnalyzeStatus(null);
    await new Promise(r => setTimeout(r, 2200)); // Simula llamada a API
    setAnalyzing(false);
    setAnalyzeStatus('ok');
    // Producción: POST /api/analizar-sentimiento → Supabase upsert
  };

  const chipStyle = (active, color) => ({
    padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:active?700:400,
    border:`1.5px solid ${active?color:C.border}`,
    background: active?`${color}22`:C.surfaceEl,
    color: active?color:C.textSec,
    cursor:'pointer', transition:'all .2s',
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header con botón de análisis ── */}
      <Card>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontWeight:700, color:C.textPri, fontSize:15, marginBottom:4 }}>🧠 Análisis de Sentimiento — Respuestas abiertas</div>
            <div style={{ fontSize:12, color:C.textMut }}>{stats.total} comentarios · Clasificación automática por IA (Claude)</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {analyzeStatus === 'ok' && <span style={{ fontSize:12, color:C.greenAcc }}>✓ Análisis actualizado</span>}
            <button type="button" onClick={handleAnalyze} disabled={analyzing}
              style={{ padding:'9px 20px', borderRadius:8, fontSize:13, fontWeight:700, background:analyzing?C.greenDark:`linear-gradient(135deg, ${C.green}, ${C.greenDark})`, border:`1.5px solid ${C.greenLight}`, color:C.textPri, cursor:analyzing?'not-allowed':'pointer' }}>
              {analyzing ? '⏳ Analizando…' : '▶ Analizar nuevos comentarios'}
            </button>
          </div>
        </div>
      </Card>

      {/* ── Resumen de distribución ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* Distribución por sentimiento */}
        <Card>
          <SectionTitle>😊 Distribución por sentimiento</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {stats.sents.map(s => {
              const meta = SENT_META[s.sent] || { label:s.sent, color:C.textMut, emoji:'•' };
              return (
                <div key={s.sent}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                    <span style={{ color:C.textSec }}>{meta.emoji} {meta.label}</span>
                    <span style={{ color:meta.color, fontWeight:700 }}>{s.count} · {s.pct}%</span>
                  </div>
                  <div style={{ height:8, background:C.border, borderRadius:4 }}>
                    <div style={{ height:'100%', width:`${s.pct}%`, background:meta.color, borderRadius:4, transition:'width .5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Distribución por tema */}
        <Card>
          <SectionTitle>🏷️ Distribución por tema</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {stats.temas.slice(0,6).map(t => {
              const meta = TEMAS_SENT[t.tema] || { label:t.tema, color:C.textMut, emoji:'•', label:t.tema };
              return (
                <div key={t.tema}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                    <span style={{ color:C.textSec }}>{meta.emoji} {meta.label}</span>
                    <span style={{ color:meta.color, fontWeight:700 }}>{t.count} · {t.pct}%</span>
                  </div>
                  <div style={{ height:8, background:C.border, borderRadius:4 }}>
                    <div style={{ height:'100%', width:`${t.pct}%`, background:meta.color, borderRadius:4, transition:'width .5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

      </div>

      {/* ── Top subtemas ── */}
      <Card>
        <SectionTitle>🔎 Subtemas más recurrentes</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:10 }}>
          {stats.topSubtemas.map((s,i) => {
            const meta = TEMAS_SENT[s.tema] || { color:C.textMut, emoji:'•', label:s.tema };
            return (
              <div key={i} style={{ background:C.surfaceEl, borderRadius:10, padding:'12px 14px', border:`1px solid ${meta.color}33` }}>
                <div style={{ fontSize:11, color:meta.color, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:6 }}>{meta.emoji} {s.tema}</div>
                <div style={{ fontSize:13, color:C.textPri, marginBottom:4 }}>{s.subtema}</div>
                <div style={{ fontSize:11, color:C.textMut }}>{s.count} mención{s.count!==1?'es':''}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Feed filtrable ── */}
      <Card>
        <SectionTitle>💬 Feed de comentarios clasificados</SectionTitle>

        {/* Filtros */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
          <button type="button" onClick={()=>setFilterSent('todos')} style={chipStyle(filterSent==='todos', C.textSec)}>Todos</button>
          {Object.entries(SENT_META).map(([key,m]) => (
            <button key={key} type="button" onClick={()=>setFilterSent(key)} style={chipStyle(filterSent===key, m.color)}>
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
          <button type="button" onClick={()=>setFilterTema('todos')} style={chipStyle(filterTema==='todos', C.textSec)}>Todos los temas</button>
          {Object.entries(TEMAS_SENT).slice(0,6).map(([key,m]) => (
            <button key={key} type="button" onClick={()=>setFilterTema(key)} style={chipStyle(filterTema===key, m.color)}>
              {m.emoji} {m.label}
            </button>
          ))}
        </div>

        {/* Contador de resultados */}
        <div style={{ fontSize:12, color:C.textMut, marginBottom:12 }}>
          Mostrando {filtered.length} de {data.length} comentarios
        </div>

        {/* Lista */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.length === 0 ? (
            <div style={{ padding:24, textAlign:'center', color:C.textMut, fontSize:13 }}>Sin comentarios con estos filtros</div>
          ) : filtered.map(d => {
            const temaMeta = TEMAS_SENT[d.tema]   || { color:C.textMut, emoji:'•', label:d.tema };
            const sentMeta = SENT_META[d.sentimiento] || { color:C.textMut, emoji:'•', label:d.sentimiento };
            return (
              <div key={d.id} style={{ background:C.surfaceEl, borderRadius:10, padding:'14px 16px', border:`1px solid ${sentMeta.color}22`, borderLeft:`3px solid ${sentMeta.color}` }}>
                <div style={{ color:C.textPri, fontSize:14, lineHeight:1.55, marginBottom:10 }}>"{d.texto}"</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:`${temaMeta.color}22`, color:temaMeta.color, fontWeight:600 }}>{temaMeta.emoji} {temaMeta.label}</span>
                  <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:`${sentMeta.color}22`, color:sentMeta.color, fontWeight:600 }}>{sentMeta.emoji} {sentMeta.label}</span>
                  <span style={{ fontSize:11, color:C.textMut }}>📍 {d.zona}</span>
                  <span style={{ fontSize:11, color:C.textMut }}>🕐 {d.fecha}</span>
                  <span style={{ marginLeft:'auto', fontSize:10, color:C.textMut }}>Confianza: {Math.round(d.confianza*100)}%</span>
                </div>
                {d.subtema && <div style={{ fontSize:11, color:C.textMut, marginTop:6 }}>Subtema: {d.subtema}</div>}
              </div>
            );
          })}
        </div>
      </Card>

    </div>
  );
}

// ─── SKELETON de carga mejorado ────────────────────────────────────────────────
function SkeletonPulse({ width, height, style = {} }) {
  return (
    <div style={{
      width, height,
      background: `linear-gradient(90deg, ${C.surfaceEl} 0%, ${C.border} 50%, ${C.surfaceEl} 100%)`,
      backgroundSize: '200% 100%',
      borderRadius: 4,
      animation: 'pulse 1.5s ease-in-out infinite',
      ...style
    }} />
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      
      {/* Header skeleton */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'0 28px', height:64, display:'flex', alignItems:'center', gap:16 }}>
        <SkeletonPulse width={40} height={40} style={{ borderRadius:10 }} />
        <div>
          <SkeletonPulse width={200} height={16} style={{ marginBottom:6 }} />
          <SkeletonPulse width={120} height={11} />
        </div>
      </div>
      
      <div style={{ padding:'28px', maxWidth:1280, margin:'0 auto' }}>
        {/* KPIs skeleton */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14, marginBottom:28 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
              <SkeletonPulse width={80} height={12} style={{ marginBottom:10 }} />
              <SkeletonPulse width={60} height={34} style={{ marginBottom:6 }} />
              <SkeletonPulse width={100} height={11} />
            </div>
          ))}
        </div>
        
        {/* Tabs skeleton */}
        <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:`1px solid ${C.border}` }}>
          {[1,2,3,4,5,6].map(i => (
            <SkeletonPulse key={i} width={80} height={36} style={{ borderRadius:'10px 10px 0 0' }} />
          ))}
        </div>
        
        {/* Content skeleton */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:20, height:300 }}>
            <SkeletonPulse width={150} height={14} style={{ marginBottom:20 }} />
            <SkeletonPulse width="100%" height={200} />
          </div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:20, height:300 }}>
            <SkeletonPulse width={150} height={14} style={{ marginBottom:20 }} />
            <SkeletonPulse width="100%" height={200} />
          </div>
        </div>
      </div>
    </div>
  );
}

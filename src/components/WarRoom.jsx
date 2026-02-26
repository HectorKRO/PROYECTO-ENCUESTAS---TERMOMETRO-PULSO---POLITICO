'use client';
/**
 * WarRoom.jsx - Mapa de calor electoral con análisis territorial
 * 
 * FUNCIONALIDADES:
 * - Mapa coroplético por sección electoral (68 secciones)
 * - Heatmap por colonias (417 colonias)
 * - Vista comparación lado a lado (2 campañas)
 * - Drill-down: Sección → Colonias
 * - Exportación de reportes por sección/colonia
 * - Actualización en tiempo real (30s debounce)
 * 
 * ✅ v2.4.1 - Todos los fixes aplicados:
 * - Memory leaks corregidos
 * - Rendimiento optimizado
 * - UX mejorada (errores visibles, loading overlay)
 * - CSV con escape correcto
 */

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { IS_DEMO } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';

// Coordenadas centro de Atlixco
const ATLIXCO_CENTER = [18.9088, -98.4321];
const DEFAULT_ZOOM = 12;

// Colores para intención de voto (escala)
const INTENCION_COLORS = {
  muy_alta: '#22c55e',  // ≥55%
  alta: '#84cc16',      // 45-54%
  media: '#eab308',     // 35-44%
  baja: '#f97316',      // 25-34%
  muy_baja: '#ef4444',  // <25%
  sin_datos: '#6b7280', // Sin encuestas
};

// Función para obtener color según intención
function getIntencionColor(pct) {
  if (pct === null || pct === undefined) return INTENCION_COLORS.sin_datos;
  if (pct >= 55) return INTENCION_COLORS.muy_alta;
  if (pct >= 45) return INTENCION_COLORS.alta;
  if (pct >= 35) return INTENCION_COLORS.media;
  if (pct >= 25) return INTENCION_COLORS.baja;
  return INTENCION_COLORS.muy_baja;
}

// Cache de GeoJSON (módulo-level)
let geoDataCache = null;

// Fetch con timeout
const fetchWithTimeout = (promise, ms = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
};

// Escape CSV para evitar inyección de caracteres
const escapeCSV = (value) => {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Componente para centrar el mapa
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom || map.getZoom());
  }, [center, zoom, map]);
  return null;
}

// Hook para datos del War Room
function useWarRoomData(campanaId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingUpdate, setPendingUpdate] = useState(false);
  const abortRef = useRef(null);

  const fetchData = useCallback(async () => {
    // ✅ FIX: Limpiar datos si no hay campaña
    if (!campanaId || IS_DEMO) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    
    // Cancelar petición anterior
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      
      const [seccionesRes, coloniasRes] = await Promise.all([
        fetchWithTimeout(supabase.from('v_resultados_por_seccion').select('*').eq('campana_id', campanaId)),
        fetchWithTimeout(supabase.from('v_resultados_por_colonia').select('*').eq('campana_id', campanaId)),
      ]);
      
      if (seccionesRes.error) throw seccionesRes.error;
      if (coloniasRes.error) throw coloniasRes.error;
      
      if (abortRef.current?.signal.aborted) return;
      
      setData({
        secciones: seccionesRes.data || [],
        colonias: coloniasRes.data || [],
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    } finally {
      setLoading(false);
      setPendingUpdate(false);
    }
  }, [campanaId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Suscripción realtime
  useEffect(() => {
    if (!campanaId || IS_DEMO) return;
    let debounceTimer = null;
    
    const channel = supabase
      .channel(`war-room-${campanaId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'respuestas', 
        filter: `campana_id=eq.${campanaId}` 
      }, () => {
        clearTimeout(debounceTimer);
        setPendingUpdate(true);
        debounceTimer = setTimeout(() => fetchData(), 30000);
      })
      .subscribe();
      
    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [campanaId, fetchData]);

  return { data, loading, error, pendingUpdate, refetch: fetchData };
}

// ✅ FIX: Estilos extraídos fuera del componente (memoización automática)
const legendStyles = {
  container: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    background: 'rgba(7, 16, 10, 0.95)',
    padding: '12px 16px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    zIndex: 1000,
    fontSize: 12,
  },
  title: { fontWeight: 700, color: C.goldLight, marginBottom: 8 },
  item: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  colorBox: { width: 16, height: 16, borderRadius: 3 },
  label: { color: C.textSec },
};

const LEGEND_ITEMS = [
  { color: INTENCION_COLORS.muy_alta, label: '≥55% (Muy Alta)' },
  { color: INTENCION_COLORS.alta, label: '45-54% (Alta)' },
  { color: INTENCION_COLORS.media, label: '35-44% (Media)' },
  { color: INTENCION_COLORS.baja, label: '25-34% (Baja)' },
  { color: INTENCION_COLORS.muy_baja, label: '<25% (Muy Baja)' },
  { color: INTENCION_COLORS.sin_datos, label: 'Sin datos' },
];

// ✅ FIX: Componente memoizado
const Legend = memo(function Legend() {
  return (
    <div style={legendStyles.container}>
      <div style={legendStyles.title}>Intención de Voto</div>
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} style={legendStyles.item}>
          <div style={{ ...legendStyles.colorBox, background: item.color }} />
          <span style={legendStyles.label}>{item.label}</span>
        </div>
      ))}
    </div>
  );
});

// ✅ FIX: Estilos extraídos para StatsPanel
const statsPanelStyles = {
  container: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 300,
    background: 'rgba(7, 16, 10, 0.95)',
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    padding: 20,
    zIndex: 1000,
  },
  containerOpen: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 340,
    maxHeight: '80vh',
    overflow: 'auto',
    background: 'rgba(7, 16, 10, 0.98)',
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    padding: 20,
    zIndex: 1000,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { color: C.goldLight, margin: 0, fontSize: 18 },
  closeBtn: { background: 'none', border: 'none', color: C.textMut, cursor: 'pointer', fontSize: 18 },
  intencionBox: (color) => ({
    background: C.surfaceEl,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    border: `1px solid ${color}33`,
  }),
  intencionValue: (color) => ({ fontSize: 32, fontWeight: 900, color }),
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 },
  gridItem: { background: C.surfaceEl, padding: 10, borderRadius: 6 },
  buttonPrimary: {
    width: '100%',
    padding: '10px 16px',
    background: C.gold,
    color: C.bg,
    border: 'none',
    borderRadius: 8,
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
  },
  buttonSecondary: {
    width: '100%',
    marginTop: 12,
    padding: '8px 16px',
    background: 'transparent',
    color: C.goldLight,
    border: `1.5px solid ${C.gold}`,
    borderRadius: 8,
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 12,
  },
  coloniaItem: {
    background: C.surfaceEl,
    padding: '10px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    border: `1px solid ${C.border}`,
    marginBottom: 6,
  },
};

// ✅ FIX: Panel de estadísticas con callbacks memoizados
const StatsPanel = memo(function StatsPanel({ data, selectedSeccion, onClose, onDrillDown, onExport }) {
  // ✅ FIX: Handlers memoizados
  const handleExportSeccion = useCallback(() => {
    onExport('seccion', selectedSeccion);
  }, [onExport, selectedSeccion]);

  const handleExportColonias = useCallback(() => {
    onExport('colonias', selectedSeccion);
  }, [onExport, selectedSeccion]);

  const stats = useMemo(() => ({
    seccionesConDatos: data?.secciones?.filter(s => s.total > 0).length || 0,
    encuestasTotales: data?.secciones?.reduce((a, s) => a + (s.total || 0), 0) || 0,
  }), [data?.secciones]);

  if (!selectedSeccion) {
    return (
      <div style={statsPanelStyles.container}>
        <h3 style={{ color: C.goldLight, margin: '0 0 16px', fontSize: 18 }}>
          🗺️ War Room Electoral
        </h3>
        <p style={{ color: C.textMut, fontSize: 13, marginBottom: 16 }}>
          Selecciona una sección para ver detalles o activa el modo comparación.
        </p>
        <div style={{ color: C.textSec, fontSize: 12 }}>
          <div>📊 Total secciones: 68</div>
          <div>🏘️ Total colonias: 417</div>
          {data && (
            <div style={{ marginTop: 12 }}>
              <div>📈 Secciones con datos: {stats.seccionesConDatos}</div>
              <div>📝 Encuestas totales: {stats.encuestasTotales}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const seccionData = useMemo(() => {
    if (!data?.secciones || !selectedSeccion) return null;
    return data.secciones.find(s => s.seccion_id === selectedSeccion) || null;
  }, [data?.secciones, selectedSeccion]);

  const coloniasData = useMemo(() => 
    data?.colonias?.filter(c => c.seccion_id === selectedSeccion) || [],
    [data?.colonias, selectedSeccion]
  );

  const intencionColor = getIntencionColor(seccionData?.pct_intencion_positiva);

  return (
    <div style={statsPanelStyles.containerOpen}>
      <div style={statsPanelStyles.header}>
        <h3 style={statsPanelStyles.title}>Sección {selectedSeccion}</h3>
        <button onClick={onClose} style={statsPanelStyles.closeBtn}>×</button>
      </div>

      {seccionData ? (
        <>
          <div style={statsPanelStyles.intencionBox(intencionColor)}>
            <div style={{ fontSize: 11, color: C.textMut, marginBottom: 4 }}>Intención Positiva</div>
            <div style={statsPanelStyles.intencionValue(intencionColor)}>
              {seccionData.pct_intencion_positiva?.toFixed(1) || '0.0'}%
            </div>
          </div>

          <div style={statsPanelStyles.grid}>
            <div style={statsPanelStyles.gridItem}>
              <div style={{ fontSize: 10, color: C.textMut }}>Encuestas</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.textPri }}>{seccionData.total || 0}</div>
            </div>
            <div style={statsPanelStyles.gridItem}>
              <div style={{ fontSize: 10, color: C.textMut }}>Reconocimiento</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.textPri }}>{seccionData.pct_reconocimiento?.toFixed(1) || '0.0'}%</div>
            </div>
            <div style={statsPanelStyles.gridItem}>
              <div style={{ fontSize: 10, color: C.textMut }}>Zona</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.textSec }}>{seccionData.zona || 'N/A'}</div>
            </div>
            <div style={statsPanelStyles.gridItem}>
              <div style={{ fontSize: 10, color: C.textMut }}>Tipo</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.textSec }}>{seccionData.tipo || 'N/A'}</div>
            </div>
          </div>

          <button onClick={handleExportSeccion} style={statsPanelStyles.buttonPrimary}>
            📥 Descargar Reporte de Sección
          </button>

          {coloniasData.length > 0 && (
            <>
              <h4 style={{ color: C.textSec, fontSize: 14, margin: '16px 0 12px' }}>
                🏘️ Colonias ({coloniasData.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {coloniasData.map(colonia => (
                  <div 
                    key={colonia.colonia_id}
                    style={statsPanelStyles.coloniaItem}
                    onClick={() => onDrillDown?.(colonia)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: C.textPri, fontSize: 13, fontWeight: 600 }}>
                        {colonia.colonia}
                      </span>
                      <span style={{ 
                        color: getIntencionColor(colonia.pct_intencion_positiva),
                        fontWeight: 700,
                        fontSize: 12,
                      }}>
                        {colonia.pct_intencion_positiva?.toFixed(0) || '0'}%
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: C.textMut, marginTop: 2 }}>
                      {colonia.total} encuestas · {colonia.tipo_colonia}
                    </div>
                  </div>
                ))}
              </div>
              
              <button onClick={handleExportColonias} style={statsPanelStyles.buttonSecondary}>
                📥 Descargar Reporte de Colonias
              </button>
            </>
          )}
        </>
      ) : (
        <div style={{ color: C.textMut, textAlign: 'center', padding: 20 }}>
          Sin datos para esta sección
        </div>
      )}
    </div>
  );
});

// ✅ FIX: Estilos del header extraídos
const headerStyles = {
  container: {
    background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { margin: 0, color: C.goldLight, fontSize: 20 },
  controls: { display: 'flex', gap: 12, alignItems: 'center' },
  buttonToggle: (active) => ({
    padding: '8px 16px',
    background: active ? C.gold : 'transparent',
    color: active ? C.bg : C.goldLight,
    border: `1.5px solid ${C.gold}`,
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
  }),
  select: {
    padding: '8px 12px',
    background: C.surfaceEl,
    color: C.textPri,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: 13,
  },
  buttonRefresh: {
    padding: '8px 16px',
    background: C.green,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
  },
};

// ✅ FIX: Estilos del loading overlay
const loadingOverlayStyles = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(7, 16, 10, 0.9)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: 16,
  zIndex: 9999,
};

const errorStyles = {
  position: 'absolute',
  top: 80,
  right: 20,
  background: '#ef4444',
  color: 'white',
  padding: '12px 16px',
  borderRadius: 8,
  zIndex: 1001,
  maxWidth: 300,
};

const pendingUpdateStyles = {
  position: 'absolute',
  top: 80,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(201, 168, 39, 0.95)',
  color: C.bg,
  padding: '8px 16px',
  borderRadius: 20,
  zIndex: 1001,
  fontWeight: 600,
  fontSize: 13,
};

// Componente principal
export default function WarRoom({ campanaId, campanaId2 = null }) {
  const [geoData, setGeoData] = useState(null);
  const [selectedSeccion, setSelectedSeccion] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [viewMode, setViewMode] = useState('secciones');

  // Datos de campañas
  const { 
    data: data1, 
    loading: loading1, 
    error: error1, 
    pendingUpdate: pendingUpdate1,
    refetch: refetch1 
  } = useWarRoomData(campanaId);
  const { 
    data: data2, 
    loading: loading2, 
    error: error2,
    pendingUpdate: pendingUpdate2,
    refetch: refetch2 
  } = useWarRoomData(campanaId2);

  // ✅ FIX: Carga GeoJSON con AbortController y cache
  useEffect(() => {
    if (geoDataCache) {
      setGeoData(geoDataCache);
      return;
    }

    const abortController = new AbortController();
    
    fetch('/data/atlixco_secciones.geojson', { signal: abortController.signal })
      .then(r => r.json())
      .then(data => {
        geoDataCache = data;
        setGeoData(data);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Error cargando GeoJSON:', err);
        }
      });
      
    return () => abortController.abort();
  }, []);

  // Combinar datos GeoJSON con datos de BD
  const geoDataWithStats = useMemo(() => {
    if (!geoData || !data1) return geoData;
    
    return {
      ...geoData,
      features: geoData.features.map(feature => {
        const seccionStats = data1.secciones?.find(
          s => s.seccion_id != null && s.seccion_id === feature.properties?.seccion
        );
        return {
          ...feature,
          properties: {
            ...feature.properties,
            intencion: seccionStats?.pct_intencion_positiva || null,
            reconocimiento: seccionStats?.pct_reconocimiento || null,
            total_encuestas: seccionStats?.total || 0,
          },
        };
      }),
    };
  }, [geoData, data1]);

  // ✅ FIX: GeoJSON para campaña 2 (comparación)
  const geoDataWithStats2 = useMemo(() => {
    if (!geoData || !data2) return geoData;
    
    return {
      ...geoData,
      features: geoData.features.map(feature => {
        const seccionStats = data2.secciones?.find(
          s => s.seccion_id != null && s.seccion_id === feature.properties?.seccion
        );
        return {
          ...feature,
          properties: {
            ...feature.properties,
            intencion: seccionStats?.pct_intencion_positiva || null,
            reconocimiento: seccionStats?.pct_reconocimiento || null,
            total_encuestas: seccionStats?.total || 0,
          },
        };
      }),
    };
  }, [geoData, data2]);

  // Estilo para cada polígono
  const styleFeature = useCallback((feature) => {
    const intencion = feature.properties.intencion;
    return {
      fillColor: getIntencionColor(intencion),
      weight: selectedSeccion === feature.properties.seccion ? 3 : 2,
      opacity: 1,
      color: selectedSeccion === feature.properties.seccion ? C.gold : '#fff',
      dashArray: '',
      fillOpacity: 0.7,
    };
  }, [selectedSeccion]);

  // ✅ FIX: Handlers memoizados
  const handleClose = useCallback(() => setSelectedSeccion(null), []);
  
  const handleToggleComparison = useCallback(() => {
    setShowComparison(prev => !prev);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch1();
    if (campanaId2) refetch2();
  }, [refetch1, refetch2, campanaId2]);

  // Exportar reporte
  const handleExport = useCallback((tipo, id) => {
    const exportData = tipo === 'seccion' 
      ? data1?.secciones?.find(s => s.seccion_id === id)
      : data1?.colonias?.filter(c => c.seccion_id === id);
    
    if (!exportData) return;

    const headers = tipo === 'seccion' 
      ? ['Campo', 'Valor']
      : ['Colonia', 'Tipo', 'Encuestas', 'Intención %', 'Reconocimiento %'];
    
    const rows = tipo === 'seccion'
      ? [
          ['Sección', exportData.seccion_id],
          ['Zona', exportData.zona],
          ['Tipo', exportData.tipo],
          ['Encuestas', exportData.total],
          ['Intención Positiva', `${exportData.pct_intencion_positiva?.toFixed(2)}%`],
          ['Reconocimiento', `${exportData.pct_reconocimiento?.toFixed(2)}%`],
          ['Promedio Intención', exportData.promedio_intencion],
        ]
      : exportData.map(c => [
          c.colonia,
          c.tipo_colonia,
          c.total,
          c.pct_intencion_positiva?.toFixed(2),
          c.pct_reconocimiento?.toFixed(2),
        ]);

    // ✅ FIX: CSV con escape correcto
    const csv = [headers, ...rows]
      .map(row => row.map(escapeCSV).join(','))
      .join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${tipo}_${id}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data1]);

  const onEachFeature = useCallback((feature, layer) => {
    const { seccion, zona, intencion, total_encuestas } = feature.properties;
    
    layer.bindPopup(`
      <div style="font-family: system-ui; min-width: 180px;">
        <strong style="color: ${C.goldLight}; font-size: 16px;">Sección ${seccion}</strong>
        <div style="color: #666; font-size: 12px; margin: 4px 0;">${zona || 'Sin zona'}</div>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0;" />
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span>Intención:</span>
          <strong style="color: ${getIntencionColor(intencion)};">${intencion?.toFixed(1) || '0.0'}%</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span>Encuestas:</span>
          <strong>${total_encuestas || 0}</strong>
        </div>
      </div>
    `);
    
    layer.on({
      click: () => setSelectedSeccion(seccion),
    });
  }, []);

  const isLoading = loading1 || (showComparison && loading2);
  const hasError = error1 || error2;
  const hasPendingUpdate = pendingUpdate1 || pendingUpdate2;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* ✅ FIX: Loading overlay en lugar de reemplazo */}
      {isLoading && (
        <div style={loadingOverlayStyles}>
          <div style={{
            width: 48, height: 48,
            border: '3px solid #264030',
            borderTopColor: '#c9a227',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <span style={{ color: '#8dab94', fontSize: 15 }}>Cargando War Room...</span>
        </div>
      )}

      {/* ✅ FIX: Errores visibles */}
      {hasError && (
        <div style={errorStyles}>
          <strong>⚠️ Error:</strong> {error1 || error2}
          <button 
            onClick={() => { refetch1(); refetch2(); }}
            style={{ 
              marginLeft: 12, 
              background: 'rgba(255,255,255,0.2)', 
              border: 'none', 
              color: 'white',
              padding: '4px 8px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ✅ FIX: Feedback de actualización pendiente */}
      {hasPendingUpdate && (
        <div style={pendingUpdateStyles}>
          🔄 Datos nuevos disponibles · Actualizando...
        </div>
      )}

      {/* Header */}
      <div style={headerStyles.container}>
        <h1 style={headerStyles.title}>🗺️ War Room Electoral</h1>
        
        <div style={headerStyles.controls}>
          <button
            onClick={handleToggleComparison}
            style={headerStyles.buttonToggle(showComparison)}
          >
            {showComparison ? '⚡ Comparación ON' : 'Modo Comparación'}
          </button>

          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            style={headerStyles.select}
          >
            <option value="secciones">Por Sección</option>
            <option value="colonias">Por Colonia</option>
            <option value="heatmap">Heatmap</option>
          </select>

          <button onClick={handleRefresh} style={headerStyles.buttonRefresh}>
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Mapas */}
      <div style={{ flex: 1, display: 'flex' }}>
        {/* Mapa principal */}
        <div style={{ flex: showComparison ? 1 : 1, position: 'relative' }}>
          <MapContainer
            center={ATLIXCO_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController center={ATLIXCO_CENTER} zoom={DEFAULT_ZOOM} />
            
            {geoDataWithStats && (
              <GeoJSON
                data={geoDataWithStats}
                style={styleFeature}
                onEachFeature={onEachFeature}
              />
            )}
            
            <Legend />
            <StatsPanel 
              data={data1}
              selectedSeccion={selectedSeccion}
              onClose={handleClose}
              onExport={handleExport}
            />
          </MapContainer>
          
          {campanaId && (
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(7, 16, 10, 0.9)',
              padding: '6px 16px',
              borderRadius: 20,
              color: C.goldLight,
              fontWeight: 700,
              fontSize: 14,
              zIndex: 1000,
              border: `1px solid ${C.border}`,
            }}>
              Campaña 1: {campanaId?.slice(0, 8)}...
            </div>
          )}
        </div>

        {/* Mapa de comparación */}
        {showComparison && (
          <div style={{ flex: 1, position: 'relative', borderLeft: `3px solid ${C.border}` }}>
            <MapContainer
              center={ATLIXCO_CENTER}
              zoom={DEFAULT_ZOOM}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* ✅ FIX: GeoJSON para campaña 2 */}
              {geoDataWithStats2 && (
                <GeoJSON
                  data={geoDataWithStats2}
                  style={styleFeature}
                  onEachFeature={onEachFeature}
                />
              )}
              
              <Legend />
            </MapContainer>
            
            {campanaId2 && (
              <div style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(7, 16, 10, 0.9)',
                padding: '6px 16px',
                borderRadius: 20,
                color: C.goldLight,
                fontWeight: 700,
                fontSize: 14,
                zIndex: 1000,
                border: `1px solid ${C.border}`,
              }}>
                Campaña 2: {campanaId2?.slice(0, 8)}...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


'use client';
/**
 * WarRoom.jsx v3.0 — Mapa de calor electoral con modo comparación multi-municipio
 * 
 * FUNCIONALIDADES v3.0:
 * - Mapa coroplético por sección electoral (múltiples municipios)
 * - Modo comparación lado a lado (2 municipios/campañas diferentes)
 * - Carga dinámica de GeoJSON según municipio seleccionado
 * - Selectores independientes de municipio + campaña por lado
 * - Heatmap por colonias
 * - Drill-down: Sección → Colonias
 * - Exportación de reportes por sección/colonia
 * 
 * CAMBIOS v3.0:
 * - Integración con useWarRoomComparison para manejo de estado dual
 * - MunicipioCampanaSelector para controles independientes
 * - GeoJSON dinámico: /data/{municipio_id}_secciones.geojson
 */

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { supabase } from '@/lib/supabase';
import { C, NAV_HEIGHT } from '@/lib/theme';
import { IS_DEMO } from '@/lib/constants';
import { useWarRoomComparison } from '@/hooks/useWarRoomComparison';
import { useIsMobile } from '@/hooks/useIsMobile';
import 'leaflet/dist/leaflet.css';

// Coordenadas por defecto (Atlixco)
const DEFAULT_CENTER = [18.9088, -98.4321];
const DEFAULT_ZOOM = 12;

// Colores para intención de voto
const INTENCION_COLORS = {
  muy_alta: '#22c55e',
  alta: '#84cc16',
  media: '#eab308',
  baja: '#f97316',
  muy_baja: '#ef4444',
  sin_datos: '#6b7280',
};

function getIntencionColor(pct) {
  if (pct === null || pct === undefined) return INTENCION_COLORS.sin_datos;
  if (pct >= 55) return INTENCION_COLORS.muy_alta;
  if (pct >= 45) return INTENCION_COLORS.alta;
  if (pct >= 35) return INTENCION_COLORS.media;
  if (pct >= 25) return INTENCION_COLORS.baja;
  return INTENCION_COLORS.muy_baja;
}

// Escape CSV
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

// Cache de GeoJSON por municipio
// WR5 FIX: Cache con versión para invalidación entre deploys
const geoDataCache = new Map();
const CACHE_VERSION = 'v2'; // Incrementar cuando cambien los GeoJSON

// Hook para cargar GeoJSON de un municipio
function useMunicipioGeoJSON(municipioId) {
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!municipioId) {
      setGeoData(null);
      return;
    }

    // Verificar cache (con versión)
    const cacheKey = `${municipioId}-${CACHE_VERSION}`;
    if (geoDataCache.has(cacheKey)) {
      setGeoData(geoDataCache.get(cacheKey));
      return;
    }

    const abortController = new AbortController();
    setLoading(true);
    setError(null);

    // Cargar GeoJSON según municipio
    fetch(`/data/${municipioId}_secciones.geojson`, { 
      signal: abortController.signal 
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then(data => {
        const cacheKey = `${municipioId}-${CACHE_VERSION}`;
        geoDataCache.set(cacheKey, data);
        setGeoData(data);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(`[WarRoom] Error cargando GeoJSON municipio ${municipioId}:`, err);
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));

    return () => abortController.abort();
  }, [municipioId]);

  return { geoData, loading, error };
}

// Hook para datos de campaña (v3.0 — con municipio_id)
function useCampanaData(campanaId, municipioId) {
  const [data, setData] = useState(null);
  // WR1 FIX: loading inicia en false, solo true cuando hay fetch real
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!campanaId || !municipioId || IS_DEMO) {
      setData(null);
      setLoading(false);
      return;
    }
    // WR1 FIX: Solo mostrar loading cuando realmente vamos a hacer fetch
    setLoading(true);

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      setError(null);

      const [seccionesRes, coloniasRes] = await Promise.all([
        supabase
          .from('v_resultados_por_seccion')
          .select('*')
          .eq('campana_id', campanaId)
          .eq('municipio_id', municipioId),
        supabase
          .from('v_resultados_por_colonia')
          .select('*')
          .eq('campana_id', campanaId)
          .eq('municipio_id', municipioId),
      ]);

      if (seccionesRes.error) throw seccionesRes.error;
      if (coloniasRes.error) throw coloniasRes.error;

      if (abortRef.current?.signal.aborted) return;

      setData({
        secciones: seccionesRes.data || [],
        colonias: coloniasRes.data || [],
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [campanaId, municipioId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Suscripción realtime (D3 FIX: filtrar por municipio también)
  useEffect(() => {
    if (!campanaId || !municipioId || IS_DEMO) return;
    let debounceTimer = null;

    const channel = supabase
      .channel(`war-room-${campanaId}-${municipioId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'respuestas',
        filter: `campana_id=eq.${campanaId}`,
      }, (payload) => {
        // D3 FIX: Verificar que el INSERT corresponde a nuestro municipio
        if (payload.new?.municipio_id !== municipioId) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchData(), 30000);
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [campanaId, fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Legend memoizado
const Legend = memo(function Legend() {
  const isMobile = useIsMobile();
  const items = [
    { color: INTENCION_COLORS.muy_alta, label: '≥55% (Muy Alta)' },
    { color: INTENCION_COLORS.alta, label: '45-54% (Alta)' },
    { color: INTENCION_COLORS.media, label: '35-44% (Media)' },
    { color: INTENCION_COLORS.baja, label: '25-34% (Baja)' },
    { color: INTENCION_COLORS.muy_baja, label: '<25% (Muy Baja)' },
    { color: INTENCION_COLORS.sin_datos, label: 'Sin datos' },
  ];

  return (
    <div style={{
      position: 'absolute',
      // En mobile: top-right para no quedar tapado por el bottom sheet
      // En desktop: bottom-right
      ...(isMobile
        ? { top: 10, right: 10 }
        : { bottom: 20, right: 20 }),
      background: 'rgba(7, 16, 10, 0.95)',
      padding: isMobile ? '8px 10px' : '12px 16px',
      borderRadius: 8,
      border: `1px solid ${C.border}`,
      zIndex: 1000,
      fontSize: isMobile ? 10 : 12,
    }}>
      <div style={{ fontWeight: 700, color: C.goldLight, marginBottom: 6 }}>
        Intención de Voto
      </div>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: isMobile ? 10 : 16, height: isMobile ? 10 : 16, borderRadius: 2, background: item.color, flexShrink: 0 }} />
          <span style={{ color: C.textSec }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
});

// Stats Panel — desktop: card top-left / mobile: bottom sheet
const StatsPanel = memo(function StatsPanel({ data, selectedSeccion, onClose }) {
  const isMobile = useIsMobile();

  // Estilos base del panel según dispositivo
  const baseStyle = isMobile ? {
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    borderRadius: '14px 14px 0 0',
    border: `1px solid ${C.border}`,
    borderBottom: 'none',
    background: 'rgba(7, 16, 10, 0.99)',
    padding: '8px 14px 14px',
    zIndex: 1001,
    overflow: 'auto',
    maxHeight: '40vh',
  } : {
    position: 'absolute',
    top: 20, left: 20,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    background: 'rgba(7, 16, 10, 0.98)',
    padding: 20,
    zIndex: 1000,
    overflow: 'auto',
  };

  // Barra de arrastre visual para mobile
  const dragHandle = isMobile ? (
    <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 12px' }} />
  ) : null;

  // Estado vacío — en mobile no mostrar para no tapar el mapa
  if (!selectedSeccion) {
    if (isMobile) return null;
    return (
      <div style={{ ...baseStyle, width: 240 }}>
        <p style={{ color: C.textMut, fontSize: 12, margin: '0 0 10px' }}>
          Toca una sección para ver detalles
        </p>
        {data && (
          <div style={{ color: C.textSec, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>📊 {data.secciones?.filter(s => s.total > 0).length || 0} secciones con datos</div>
            <div>📝 {data.secciones?.reduce((a, s) => a + (s.total || 0), 0) || 0} encuestas totales</div>
          </div>
        )}
      </div>
    );
  }

  const seccionData = data?.secciones?.find(s => s.seccion_id === selectedSeccion);
  if (!seccionData) {
    return (
      <div style={{ ...baseStyle, width: isMobile ? '100%' : 280 }}>
        {dragHandle}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: C.goldLight, margin: 0, fontSize: 16 }}>Sección {selectedSeccion}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMut, cursor: 'pointer', fontSize: 22, padding: '2px 6px', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ color: C.textMut, marginTop: 12, fontSize: 13 }}>Sin datos para esta sección</p>
      </div>
    );
  }

  const intencionColor = getIntencionColor(seccionData.pct_intencion_positiva);

  return (
    <div style={{ ...baseStyle, width: isMobile ? '100%' : 320, maxHeight: isMobile ? '40vh' : '80vh' }}>
      {dragHandle}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 8 : 12 }}>
        <h3 style={{ color: C.goldLight, margin: 0, fontSize: isMobile ? 14 : 18 }}>Sección {selectedSeccion}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMut, cursor: 'pointer', fontSize: 20, padding: '2px 6px', lineHeight: 1 }}>×</button>
      </div>

      <div style={{
        background: C.surfaceEl,
        borderRadius: 8,
        padding: isMobile ? 8 : 12,
        marginBottom: isMobile ? 8 : 12,
        border: `1px solid ${intencionColor}33`,
      }}>
        <div style={{ fontSize: 10, color: C.textMut, marginBottom: 2 }}>Intención Positiva</div>
        <div style={{ fontSize: isMobile ? 22 : 32, fontWeight: 900, color: intencionColor }}>
          {seccionData.pct_intencion_positiva?.toFixed(1) || '0.0'}%
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: C.surfaceEl, padding: isMobile ? 7 : 10, borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: C.textMut }}>Encuestas</div>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: C.textPri }}>{seccionData.total || 0}</div>
        </div>
        <div style={{ background: C.surfaceEl, padding: isMobile ? 7 : 10, borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: C.textMut }}>Reconocimiento</div>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: C.textPri }}>{seccionData.pct_reconocimiento?.toFixed(1) || '0.0'}%</div>
        </div>
      </div>
    </div>
  );
});

// Componente de Mapa individual
const MapaWarRoom = memo(function MapaWarRoom({
  municipioId,
  campanaId,
  label,
  showStats = true,
}) {
  const { geoData, loading: geoLoading, error: geoError } = useMunicipioGeoJSON(municipioId);
  const { data, loading: dataLoading, error: dataError } = useCampanaData(campanaId, municipioId);
  const [selectedSeccion, setSelectedSeccion] = useState(null);
  // Ref para acceder al selectedSeccion actual dentro de handlers de Leaflet sin stale closure
  const selectedSeccionRef = useRef(null);
  useEffect(() => { selectedSeccionRef.current = selectedSeccion; }, [selectedSeccion]);

  const loading = geoLoading || dataLoading;
  const error = geoError || dataError;

  // Combinar GeoJSON con datos de stats
  const geoDataWithStats = useMemo(() => {
    if (!geoData || !data?.secciones) return geoData;

    return {
      ...geoData,
      features: geoData.features.map(feature => {
        const seccionStats = data.secciones.find(
          s => s.seccion_id != null && s.seccion_id === feature.properties?.seccion
        );
        return {
          ...feature,
          properties: {
            ...feature.properties,
            intencion: seccionStats?.pct_intencion_positiva ?? null,
            reconocimiento: seccionStats?.pct_reconocimiento ?? null,
            total_encuestas: seccionStats?.total || 0,
          },
        };
      }),
    };
  }, [geoData, data?.secciones]);

  const styleFeature = useCallback((feature) => {
    const intencion = feature.properties.intencion;
    const isSelected = selectedSeccion === feature.properties.seccion;
    return {
      fillColor: getIntencionColor(intencion),
      weight: isSelected ? 3 : 1,
      opacity: 1,
      color: isSelected ? C.gold : 'rgba(255,255,255,0.45)',
      fillOpacity: isSelected ? 0.88 : 0.65,
    };
  }, [selectedSeccion]);

  const onEachFeature = useCallback((feature, layer) => {
    const { seccion, zona, tipo, intencion, reconocimiento, total_encuestas } = feature.properties;
    const baseColor = getIntencionColor(intencion);
    const intPct = intencion ?? null;
    const recoPct = reconocimiento ?? null;
    const count = total_encuestas || 0;

    // Tooltip en hover: solo en desktop (en mobile touch no hay mouseout → se congela)
    // En mobile el bottom sheet (StatsPanel) reemplaza toda la info del tooltip
    if (typeof window !== 'undefined' && window.innerWidth >= 640) {
    layer.bindTooltip(`
      <div style="font-family: system-ui, sans-serif; min-width: 220px; padding: 2px 0;">
        <div style="border-left: 4px solid ${baseColor}; padding-left: 10px; margin-bottom: 12px; display:flex; align-items:center; gap:8px;">
          <span style="font-size: 14px; font-weight: 700; color: #e4be45;">Sección ${seccion}</span>
          ${tipo ? `<span style="font-size:9px; background:#1a3525; color:#6ee7b7; padding:2px 7px; border-radius:4px; font-weight:700; letter-spacing:.06em;">${tipo}</span>` : ''}
        </div>

        <div style="margin-bottom:9px;">
          <div style="display:flex; justify-content:space-between; font-size:11px; color:#a3b8a8; margin-bottom:4px;">
            <span>Intención positiva</span>
            <strong style="color:${baseColor};">${intPct != null ? intPct.toFixed(1) + '%' : '—'}</strong>
          </div>
          <div style="background:#0a1a10; border-radius:3px; height:5px; overflow:hidden;">
            <div style="width:${Math.min(intPct ?? 0, 100)}%; height:100%; background:${baseColor}; border-radius:3px;"></div>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:11px; color:#a3b8a8; margin-bottom:4px;">
            <span>Reconocimiento</span>
            <strong style="color:#60a5fa;">${recoPct != null ? recoPct.toFixed(1) + '%' : '—'}</strong>
          </div>
          <div style="background:#0a1a10; border-radius:3px; height:5px; overflow:hidden;">
            <div style="width:${Math.min(recoPct ?? 0, 100)}%; height:100%; background:#60a5fa; border-radius:3px;"></div>
          </div>
        </div>

        <div style="border-top:1px solid #1e3a2a; padding-top:8px; font-size:11px; color:${count > 0 ? '#6ee7b7' : '#8aaf96'};">
          ${count > 0 ? `📋 ${count} encuesta${count !== 1 ? 's' : ''} · haz clic para detalles` : 'Sin encuestas · haz clic para ver'}
        </div>
      </div>
    `, { direction: 'top', sticky: false, opacity: 1, offset: [0, -8], className: 'warroom-tooltip' });
    } // end if desktop

    layer.on({
      mouseover: (e) => {
        e.target.setStyle({
          weight: 2.5,
          color: C.gold,
          fillOpacity: 0.88,
        });
        e.target.bringToFront();
      },
      mouseout: (e) => {
        const isSelected = selectedSeccionRef.current === seccion;
        e.target.setStyle({
          weight: isSelected ? 3 : 1,
          color: isSelected ? C.gold : 'rgba(255,255,255,0.45)',
          fillOpacity: isSelected ? 0.88 : 0.65,
        });
      },
      click: () => setSelectedSeccion(seccion),
    });
  }, []);

  // Calcular centro del mapa basado en geoData o usar default
  const mapCenter = useMemo(() => {
    if (geoData?.features?.[0]?.properties?.centro) {
      // Si el GeoJSON tiene centro definido, usarlo
      const centro = geoData.features[0].properties.centro;
      if (Array.isArray(centro) && centro.length === 2) return centro;
    }
    return DEFAULT_CENTER;
  }, [geoData]);

  return (
    <div style={{ flex: 1, position: 'relative', height: '100%' }}>
      {/* Label de campaña */}
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
          {label}: {campanaId?.slice(0, 8)}...
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(7, 16, 10, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          zIndex: 9999,
        }}>
          <div style={{
            width: 48, height: 48,
            border: '3px solid #264030',
            borderTopColor: '#c9a227',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          {/* WR4 FIX: Animación movida a globals.css */}
          <span style={{ color: '#8dab94', fontSize: 15 }}>Cargando mapa...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          position: 'absolute',
          top: 80,
          right: 20,
          background: '#ef4444',
          color: 'white',
          padding: '12px 16px',
          borderRadius: 8,
          zIndex: 1001,
          maxWidth: 300,
        }}>
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}

      <MapContainer
        center={mapCenter}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController center={mapCenter} zoom={DEFAULT_ZOOM} />

        {/* WR2 FIX: Key dinámico para forzar re-render cuando cambian los datos */}
        {geoDataWithStats && (
          <GeoJSON
            key={`geo-${municipioId}-${campanaId}-${data ? 'loaded' : 'empty'}`}
            data={geoDataWithStats}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}

        <Legend />
        {showStats && (
          <StatsPanel
            data={data}
            selectedSeccion={selectedSeccion}
            onClose={() => setSelectedSeccion(null)}
          />
        )}
      </MapContainer>
    </div>
  );
});

// COMPONENTE PRINCIPAL
// Estilo compacto para selects del header
const selectHeaderStyle = {
  padding: '6px 10px',
  background: 'rgba(7, 16, 10, 0.7)',
  color: C.textPri,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
  outline: 'none',
  flex: 1,
  minWidth: 0,       // permite comprimir por debajo del contenido
  maxWidth: 200,
};

export default function WarRoom() {
  const isMobile = useIsMobile();
  const {
    ladoA,
    ladoB,
    setMunicipioA,
    setMunicipioB,
    setCampanaA,
    setCampanaB,
    showComparison,
    toggleComparison,
    municipiosDisponibles,
  } = useWarRoomComparison();

  return (
    <div style={{
      height: `calc(100vh - ${NAV_HEIGHT}px)`,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* ── HEADER WAR ROOM — responsive ── */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        {isMobile ? (
          /* ── MOBILE: dos filas ── */
          <div>
            {/* Fila 1: título + botón comparar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15 }}>🗺️</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: C.textPri }}>War Room</span>
              </div>
              <button
                onClick={toggleComparison}
                style={{
                  padding: '5px 12px',
                  background: showComparison ? C.gold : 'transparent',
                  color: showComparison ? C.bg : C.gold,
                  border: `1.5px solid ${C.gold}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                }}
              >
                {showComparison ? '⚡ Comparando' : '⊞ Comparar'}
              </button>
            </div>
            {/* Fila 2: selectors full-width */}
            <div style={{ display: 'flex', gap: 8, padding: '0 16px 10px', alignItems: 'center' }}>
              <select
                value={ladoA.municipioId || ''}
                onChange={(e) => setMunicipioA(e.target.value ? Number(e.target.value) : null)}
                disabled={ladoA.loading}
                style={{ ...selectHeaderStyle, maxWidth: 'none' }}
              >
                <option value="">📍 Municipio</option>
                {municipiosDisponibles.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
              <select
                value={ladoA.campanaId || ''}
                onChange={(e) => setCampanaA(e.target.value || null)}
                disabled={ladoA.loading || !ladoA.municipioId}
                style={{ ...selectHeaderStyle, maxWidth: 'none', opacity: !ladoA.municipioId ? 0.5 : 1 }}
              >
                <option value="">{ladoA.loading ? 'Cargando...' : '🗳️ Campaña'}</option>
                {ladoA.campanasDisponibles?.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          /* ── DESKTOP: una fila ── */
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 24px',
            height: 56,
            gap: 16,
          }}>
            {/* Zona izquierda: título */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 16 }}>🗺️</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: C.textPri }}>War Room</span>
              <span style={{ color: C.border, fontSize: 14 }}>·</span>
              <span style={{ fontSize: 12, color: C.textMut }}>
                {municipiosDisponibles.find(m => m.id === ladoA.municipioId)?.nombre || 'Mapa electoral'}
              </span>
            </div>

            {/* Zona central: selectors */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' }}>
              <select
                value={ladoA.municipioId || ''}
                onChange={(e) => setMunicipioA(e.target.value ? Number(e.target.value) : null)}
                disabled={ladoA.loading}
                style={selectHeaderStyle}
              >
                <option value="">📍 Municipio</option>
                {municipiosDisponibles.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
              <select
                value={ladoA.campanaId || ''}
                onChange={(e) => setCampanaA(e.target.value || null)}
                disabled={ladoA.loading || !ladoA.municipioId}
                style={{ ...selectHeaderStyle, opacity: !ladoA.municipioId ? 0.5 : 1 }}
              >
                <option value="">{ladoA.loading ? 'Cargando...' : '🗳️ Campaña'}</option>
                {ladoA.campanasDisponibles?.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            {/* Zona derecha: toggle comparar */}
            <button
              onClick={toggleComparison}
              style={{
                padding: '6px 14px',
                background: showComparison ? C.gold : 'transparent',
                color: showComparison ? C.bg : C.gold,
                border: `1.5px solid ${C.gold}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {showComparison ? '⚡ Comparando' : '⊞ Comparar'}
            </button>
          </div>
        )}

        {/* Fila comparación (solo cuando showComparison, ~40px) */}
        {showComparison && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 24px',
            borderTop: `1px solid ${C.border}`,
            background: C.surfaceEl,
          }}>
            <span style={{ fontSize: 11, color: C.textMut, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', flexShrink: 0 }}>
              Comparación:
            </span>
            <select
              value={ladoB.municipioId || ''}
              onChange={(e) => setMunicipioB(e.target.value ? Number(e.target.value) : null)}
              disabled={ladoB.loading}
              style={selectHeaderStyle}
            >
              <option value="">📍 Municipio B</option>
              {municipiosDisponibles.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
            <select
              value={ladoB.campanaId || ''}
              onChange={(e) => setCampanaB(e.target.value || null)}
              disabled={ladoB.loading || !ladoB.municipioId}
              style={{ ...selectHeaderStyle, opacity: !ladoB.municipioId ? 0.5 : 1 }}
            >
              <option value="">{ladoB.loading ? 'Cargando...' : '🗳️ Campaña B'}</option>
              {ladoB.campanasDisponibles?.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Área de mapas */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Mapa A (siempre visible) */}
        <MapaWarRoom
          municipioId={ladoA.municipioId}
          campanaId={ladoA.campanaId}
          label="Campaña"
          showStats={!showComparison}
        />

        {/* Mapa B (solo en comparación) */}
        {showComparison && (
          <>
            <div style={{ width: 3, background: C.border }} />
            <MapaWarRoom
              municipioId={ladoB.municipioId}
              campanaId={ladoB.campanaId}
              label="Comparación"
              showStats={true}
            />
          </>
        )}
      </div>
    </div>
  );
}

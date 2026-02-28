'use client';
/**
 * CampoMapa.jsx — Mapa mini de encuestadores activos para el tab Campo del Dashboard
 *
 * Se importa CON ssr:false via next/dynamic para evitar el error
 * "window is not defined" que Leaflet lanza en SSR.
 *
 * Props:
 *   ubicaciones: Array de { user_id, encuestador_nombre, lat, lng, precision_m, updated_at }
 *   center:      [lat, lng] — centro inicial del mapa
 */

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { C } from '@/lib/theme';

function makeIcon(nombre) {
  const initial = (nombre || '?').charAt(0).toUpperCase();
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:50%;background:#22c55e;border:2px solid rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#07100a;box-shadow:0 2px 10px rgba(0,0,0,0.5)">${initial}</div>`,
    iconSize:    [30, 30],
    iconAnchor:  [15, 15],
    popupAnchor: [0, -16],
  });
}

export default function CampoMapa({ ubicaciones = [], center = [18.9088, -98.4321] }) {
  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height: '100%', width: '100%', background: C.bg }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
      />
      {ubicaciones.map(u => (
        <Marker
          key={u.user_id}
          position={[u.lat, u.lng]}
          icon={makeIcon(u.encuestador_nombre)}
        >
          <Popup>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12 }}>
              <div style={{ fontWeight: 700 }}>{u.encuestador_nombre || 'Encuestador'}</div>
              {u.precision_m && <div style={{ color: '#666' }}>Precisión: ±{u.precision_m}m</div>}
              <div style={{ color: '#666' }}>{new Date(u.updated_at).toLocaleTimeString('es-MX')}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

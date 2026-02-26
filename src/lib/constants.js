// lib/constants.js — Constantes compartidas del proyecto

// ✅ FIX: Clave unificada de localStorage (antes había 2 claves distintas)
export const OFFLINE_KEY = 'encuestas_pendientes_atlixco';

export const IS_DEMO =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).has('demo') ||
      process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
    : process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// Campos permitidos para inserción en tabla respuestas (allowlist)
export const RESPUESTA_FIELDS = [
  'campana_id',
  'encuestador_id',
  'seccion_id',
  'colonia_id',
  'fuente',
  'latitud',
  'longitud',
  'gps_precision',
  'dispositivo',
  'edad_rango',
  'genero',
  'escolaridad',
  'ocupacion',
  'zona_electoral',
  'colonia_texto',
  'ip_address',
  'conoce_candidatos_espontaneo',
  'reconocimiento_asistido',
  'como_conoce',
  'intencion_voto',
  'simpatia',
  'imagen_percibida',
  'problemas_localidad',
  'tema_principal',
  'evaluacion_gobierno',
  'propuestas_conocidas',
  'motivo_voto',
  'medio_informacion',
  'comentario_final',
  // ✅ Nuevos campos v2.3
  'participacion_anterior',
  'identificacion_partido',
  'whatsapp_contacto',
  'consentimiento_contacto',
  'foto_evidencia_url',
  'duracion_segundos',
  'completada',
  'sincronizada',
];

// Sanitiza un payload: solo deja los campos de la allowlist
export function sanitizePayload(raw) {
  const clean = {};
  for (const key of RESPUESTA_FIELDS) {
    if (raw[key] !== undefined) clean[key] = raw[key];
  }
  return clean;
}

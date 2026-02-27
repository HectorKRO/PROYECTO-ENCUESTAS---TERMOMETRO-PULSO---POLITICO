/**
 * lib/exportData.js — Funciones de exportación para el dashboard
 * CSV nativo (compatible con Excel) y utilidades de formato
 */
// ✅ FIX M6: Import estático en lugar de dinámico para evitar delay en exportación
import { supabase } from './supabase';

/**
 * Escapa un valor para CSV
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Si contiene comas, saltos de línea o comillas, escapar
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convierte array de objetos a CSV
 */
function toCSV(data, headers) {
  if (!data || data.length === 0) return '';
  
  // Usar headers proporcionados o extraer del primer objeto
  const cols = headers || Object.keys(data[0]);
  
  // Header row
  const headerRow = cols.map(h => escapeCSV(h.label || h.key || h)).join(',');
  
  // Data rows
  const rows = data.map(row => {
    return cols.map(col => {
      const key = col.key || col;
      const value = row[key];
      // Formatear arrays
      if (Array.isArray(value)) {
        return escapeCSV(value.join('; '));
      }
      return escapeCSV(value);
    }).join(',');
  });
  
  return [headerRow, ...rows].join('\n');
}

/**
 * Descarga un archivo CSV/Excel
 */
function downloadFile(content, filename, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta encuestas a CSV (compatible con Excel)
 */
export function exportEncuestasToCSV(encuestas, candidatoNombre = 'Candidato') {
  const headers = [
    { key: 'id', label: 'ID' },
    { key: 'created_at', label: 'Fecha' },
    { key: 'seccion', label: 'Sección' },
    { key: 'zona_electoral', label: 'Zona' },
    { key: 'edad_rango', label: 'Edad' },
    { key: 'genero', label: 'Género' },
    { key: 'escolaridad', label: 'Escolaridad' },
    { key: 'ocupacion', label: 'Ocupación' },
    { key: 'latitud', label: 'Latitud' },
    { key: 'longitud', label: 'Longitud' },
    { key: 'gps_precision', label: 'Precisión GPS (m)' },
    { key: 'reconocimiento_asistido', label: 'Conoce candidato' },
    { key: 'imagen_percibida', label: 'Imagen' },
    { key: 'intencion_voto', label: 'Intención (1-5)' },
    { key: 'simpatia', label: 'Simpatía (1-5)' },
    { key: 'temas_prioritarios', label: 'Temas prioritarios' },
    { key: 'tema_principal', label: 'Tema principal' },
    { key: 'evaluacion_gobierno', label: 'Evaluación gobierno' },
    { key: 'participacion_anterior', label: 'Votó elección anterior' },
    { key: 'identificacion_partido', label: 'Identificación partidista' },
    { key: 'motivo_voto', label: 'Motivo de voto' },
    { key: 'comentario_final', label: 'Comentario' },
    { key: 'encuestador', label: 'Encuestador' },
    { key: 'duracion_segundos', label: 'Duración (s)' },
    { key: 'fuente', label: 'Fuente' },
  ];

  // Normalizar datos
  const normalizedData = encuestas.map(e => ({
    ...e,
    temas_prioritarios: e.problemas_localidad || e.temas_prioritarios || [],
    seccion: e.seccion || e.seccion_id,
    encuestador: e.encuestador_nombre || e.encuestador_id?.substring(0, 8) || 'N/A',
    fecha: e.created_at ? new Date(e.created_at).toLocaleString('es-MX') : '',
  }));

  const csv = toCSV(normalizedData, headers);
  
  // BOM para Excel reconozca UTF-8
  const csvWithBOM = '\uFEFF' + csv;
  
  const filename = `encuestas_${candidatoNombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(csvWithBOM, filename);
  
  return { success: true, count: encuestas.length, filename };
}

/**
 * Exporta resumen agregado a CSV
 */
export function exportResumenToCSV(data, candidatoNombre = 'Candidato') {
  const { kpis, secciones = [], agenda = [] } = data;
  
  let csv = '\uFEFF';
  
  // Sección 1: KPIs
  csv += 'RESUMEN DE CAMPAÑA\n';
  csv += 'Métrica,Valor\n';
  csv += `Total encuestas,${kpis?.total_encuestas || 0}\n`;
  csv += `Reconocimiento,${kpis?.reconocimiento || 0}%\n`;
  csv += `Intención de voto,${kpis?.intencion || 0}%\n`;
  csv += `Simpatía,${kpis?.simpatia || 0}%\n`;
  csv += `Encuestas hoy,${kpis?.hoy || 0}\n\n`;
  
  // Sección 2: Por sección
  if (secciones.length > 0) {
    csv += 'RESULTADOS POR SECCIÓN\n';
    csv += 'Sección,Zona,Encuestas,Intención,Simpatía\n';
    secciones.forEach(s => {
      csv += `${escapeCSV(s.seccion)},${escapeCSV(s.zona)},${s.total},${s.intencion}%,${s.simpatia}%\n`;
    });
    csv += '\n';
  }
  
  // Sección 3: Agenda ciudadana
  if (agenda.length > 0) {
    csv += 'AGENDA CIUDADANA\n';
    csv += 'Tema,Porcentaje\n';
    agenda.forEach(a => {
      csv += `${escapeCSV(a.tema)},${a.pct}%\n`;
    });
  }
  
  const filename = `resumen_${candidatoNombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(csv, filename);
  
  return { success: true, filename };
}

/**
 * Prepara datos de encuestas para exportación desde Supabase
 */
export async function fetchEncuestasForExport(campanaId) {
  const { data, error } = await supabase
    .from('respuestas')
    .select(`
      id,
      created_at,
      seccion_id,
      zona_electoral,
      latitud,
      longitud,
      gps_precision,
      edad_rango,
      genero,
      escolaridad,
      ocupacion,
      reconocimiento_asistido,
      imagen_percibida,
      intencion_voto,
      simpatia,
      problemas_localidad,
      tema_principal,
      evaluacion_gobierno,
      participacion_anterior,
      identificacion_partido,
      motivo_voto,
      comentario_final,
      duracion_segundos,
      fuente,
      encuestador_id,
      secciones_electorales(seccion)
    `)
    .eq('campana_id', campanaId)
    .eq('completada', true)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  // Normalizar datos
  return (data || []).map(e => ({
    ...e,
    seccion: e.secciones_electorales?.seccion || e.seccion_id,
  }));
}

// lib/mockData.js — Datos de demostración para modo DEMO
// Separados del bundle principal para reducir tamaño inicial

import { C } from './theme';

export const MOCK_CANDIDATO = {
  nombre: 'Juan Francisco García Martínez',
  alias: 'Paco García',
  cargo: 'Candidato a Presidente Municipal',
  municipio: 'Atlixco, Puebla'
};

export const MOCK_KPIS = {
  reconocimiento: 61.4,
  intencion: 48.2,
  simpatia: 54.7,
  total_encuestas: 347,
  hoy: 23,
  meta: 400
};

export const MOCK_TENDENCIA = [
  { semana: 'Sem 1\n6-Ene', reconocimiento: 45, intencion: 38, simpatia: 40 },
  { semana: 'Sem 2\n13-Ene', reconocimiento: 51, intencion: 42, simpatia: 46 },
  { semana: 'Sem 3\n20-Ene', reconocimiento: 55, intencion: 44, simpatia: 49 },
  { semana: 'Sem 4\n27-Ene', reconocimiento: 58, intencion: 46, simpatia: 52 },
  { semana: 'Sem 5\n3-Feb', reconocimiento: 61, intencion: 48, simpatia: 55 },
];

export const MOCK_CONOCE_CANDIDATO = [
  { name: 'Lo conoce bien', value: 38, color: C.green },
  { name: 'Ha escuchado su nombre', value: 34, color: C.gold },
  { name: 'No lo conoce', value: 28, color: C.textMut },
];

export const MOCK_EVALUACION_GOBIERNO = [
  { name: 'Muy bueno', value: 4, color: '#3ea84a' },
  { name: 'Bueno', value: 11, color: C.greenLight },
  { name: 'Regular', value: 31, color: C.gold },
  { name: 'Malo', value: 33, color: C.amber },
  { name: 'Muy malo', value: 21, color: C.danger },
];

export const MOCK_DEMOGRAFIA_GENERO = [
  { name: 'Femenino', value: 47, color: C.gold },
  { name: 'Masculino', value: 48, color: C.green },
  { name: 'NB / NR', value: 5, color: C.textMut },
];

export const MOCK_DEMOGRAFIA_EDAD = [
  { rango: '18-24', intencion: 42, simpatia: 40, total: 58 },
  { rango: '25-34', intencion: 51, simpatia: 49, total: 94 },
  { rango: '35-44', intencion: 54, simpatia: 52, total: 78 },
  { rango: '45-54', intencion: 49, simpatia: 47, total: 63 },
  { rango: '55-64', intencion: 44, simpatia: 42, total: 38 },
  { rango: '65+', intencion: 38, simpatia: 36, total: 16 },
];

export const MOCK_AGENDA = [
  { tema: 'Seguridad pública', pct: 62 },
  { tema: 'Empleo', pct: 55 },
  { tema: 'Infraestructura', pct: 48 },
  { tema: 'Agua / Servicios', pct: 43 },
  { tema: 'Educación', pct: 38 },
  { tema: 'Salud', pct: 35 },
  { tema: 'Comercio local', pct: 28 },
  { tema: 'Medio ambiente', pct: 21 },
];

export const MOCK_MEDIOS = [
  { medio: 'Facebook', pct: 68, color: C.green },
  { medio: 'WhatsApp', pct: 61, color: C.greenAcc },
  { medio: 'Boca a boca', pct: 47, color: C.gold },
  { medio: 'TV local', pct: 39, color: C.goldLight },
  { medio: 'Instagram', pct: 35, color: C.amber },
  { medio: 'Radio', pct: 28, color: C.textSec },
  { medio: 'Periódico', pct: 14, color: C.textMut },
];

export const MOCK_SECCIONES = [
  { seccion: '0154', zona: 'Norte', total: 48, intencion: 62, simpatia: 65 },
  { seccion: '0158', zona: 'Norte', total: 41, intencion: 58, simpatia: 60 },
  { seccion: '0166', zona: 'Centro', total: 33, intencion: 52, simpatia: 55 },
  { seccion: '0161', zona: 'Centro', total: 35, intencion: 55, simpatia: 57 },
  { seccion: '0156', zona: 'Norte', total: 39, intencion: 49, simpatia: 51 },
  { seccion: '0163', zona: 'Norte', total: 28, intencion: 44, simpatia: 46 },
  { seccion: '0195', zona: 'Poniente', total: 20, intencion: 41, simpatia: 43 },
  { seccion: '0207', zona: 'Sur', total: 31, intencion: 42, simpatia: 40 },
  { seccion: '0172', zona: 'Centro', total: 26, intencion: 38, simpatia: 36 },
  { seccion: '0213', zona: 'Oriente', total: 22, intencion: 35, simpatia: 33 },
  { seccion: '0171', zona: 'Centro', total: 18, intencion: 33, simpatia: 31 },
  { seccion: '0220', zona: 'Sur', total: 15, intencion: 30, simpatia: 28 },
  { seccion: '0221', zona: 'Sur', total: 12, intencion: 28, simpatia: 26 },
  // NOTA: 0222-0229 no existen en catálogo INE
];

export const MOCK_ENCUESTADORES = [
  { nombre: 'Luis A.', encuestas: 42, zona: 'Centro', ultima: '2025-02-21' },
  { nombre: 'María G.', encuestas: 38, zona: 'Sur', ultima: '2025-02-21' },
  { nombre: 'Raúl T.', encuestas: 31, zona: 'Norte', ultima: '2025-02-20' },
  { nombre: 'Sofía M.', encuestas: 29, zona: 'Poniente', ultima: '2025-02-20' },
  { nombre: 'Javier L.', encuestas: 24, zona: 'Oriente', ultima: '2025-02-19' },
  { nombre: 'Ana R.', encuestas: 19, zona: 'Sur', ultima: '2025-02-18' },
];

export const MOCK_COBERTURA_ZONA = [
  { zona: 'Norte', meta: 80, actual: 79 },
  { zona: 'Centro', meta: 80, actual: 92 },
  { zona: 'Sur', meta: 80, actual: 65 },
  { zona: 'Oriente', meta: 80, actual: 56 },
  { zona: 'Poniente', meta: 80, actual: 54 },
];

export const MOCK_COMENTARIOS = [
  { texto: 'Que arregle las calles del centro, están muy feas y llenas de baches.', zona: 'Centro', fecha: 'Hoy' },
  { texto: 'Más seguridad por las noches, especialmente en los barrios.', zona: 'Barrio de Santiago', fecha: 'Hoy' },
  { texto: 'Que apoye a los comerciantes locales con capacitación y créditos.', zona: 'Col. Reforma', fecha: 'Ayer' },
  { texto: 'Se necesita agua todos los días, no solo tres veces a la semana.', zona: 'Barrio de San Juan', fecha: 'Ayer' },
  { texto: 'Más áreas verdes y parques para los niños del municipio.', zona: 'Col. 5 de Mayo', fecha: 'Hace 2 días' },
];

// Metadata para análisis de sentimiento
export const SENT_META = {
  positivo:  { emoji:'😊', label:'Positivo',  color:'#56d465' },
  negativo:  { emoji:'😠', label:'Negativo',  color:'#e05252' },
  neutro:    { emoji:'😐', label:'Neutro',    color:'#60a5fa' },
  propuesta: { emoji:'💡', label:'Propuesta', color:'#c9a227' },
};

// TEMAS para análisis de sentimiento
export const TEMAS_SENT = {
  seguridad:       { emoji:'🔒', label:'Seguridad',          color:'#e05252' },
  infraestructura: { emoji:'🛣️', label:'Infraestructura',    color:'#e07c10' },
  agua:            { emoji:'💧', label:'Agua y servicios',   color:'#3b82f6' },
  empleo:          { emoji:'💼', label:'Empleo',             color:'#8b5cf6' },
  salud:           { emoji:'🏥', label:'Salud',              color:'#ec4899' },
  educacion:       { emoji:'📚', label:'Educación',          color:'#06b6d4' },
  transporte:      { emoji:'🚌', label:'Transporte',         color:'#84cc16' },
  gobierno:        { emoji:'🏛️', label:'Gobierno/Corrupción', color:'#c9a227' },
  medioambiente:   { emoji:'🌳', label:'Medio ambiente',     color:'#56d465' },
  otro:            { emoji:'💬', label:'Otro',               color:'#4d6b54' },
};

// Datos mock para análisis de sentimiento
export const MOCK_ANALISIS = [
  { id:1,  texto:'Que arregle las calles del centro, están muy feas y llenas de baches.',        zona:'Centro',    fecha:'2025-02-20', tema:'infraestructura', sentimiento:'negativo',  subtema:'baches',                   confianza:0.95 },
  { id:2,  texto:'Más seguridad por las noches, especialmente en los barrios.',                  zona:'Norte',     fecha:'2025-02-20', tema:'seguridad',       sentimiento:'negativo',  subtema:'vigilancia nocturna',       confianza:0.92 },
  { id:3,  texto:'Que apoye a los comerciantes locales con capacitación y créditos.',            zona:'Centro',    fecha:'2025-02-19', tema:'empleo',          sentimiento:'propuesta', subtema:'apoyo a comercio local',    confianza:0.88 },
  { id:4,  texto:'Se necesita agua todos los días, no solo tres veces a la semana.',             zona:'Norte',     fecha:'2025-02-19', tema:'agua',            sentimiento:'negativo',  subtema:'suministro irregular',      confianza:0.97 },
  { id:5,  texto:'Más áreas verdes y parques para los niños del municipio.',                     zona:'Centro',    fecha:'2025-02-18', tema:'medioambiente',   sentimiento:'propuesta', subtema:'parques infantiles',        confianza:0.90 },
  { id:6,  texto:'Me parece bien que Paco quiera mejorar las cosas.',                            zona:'Centro',    fecha:'2025-02-18', tema:'gobierno',        sentimiento:'positivo',  subtema:'aprobación general',        confianza:0.85 },
  { id:7,  texto:'La basura se acumula en las esquinas y nadie la recoge.',                      zona:'Centro',    fecha:'2025-02-17', tema:'infraestructura', sentimiento:'negativo',  subtema:'recolección de basura',     confianza:0.93 },
  { id:8,  texto:'Deberían poner cámaras de seguridad en las entradas de la ciudad.',            zona:'Oriente',   fecha:'2025-02-17', tema:'seguridad',       sentimiento:'propuesta', subtema:'videovigilancia',           confianza:0.91 },
  { id:9,  texto:'El transporte público es malísimo, no hay suficientes rutas.',                 zona:'Sur',       fecha:'2025-02-16', tema:'transporte',      sentimiento:'negativo',  subtema:'cobertura de rutas',        confianza:0.94 },
  { id:10, texto:'Que se construya un hospital digno para Atlixco.',                             zona:'Poniente',  fecha:'2025-02-16', tema:'salud',           sentimiento:'propuesta', subtema:'infraestructura hospitalaria', confianza:0.96 },
  { id:11, texto:'Los maestros necesitan mejores condiciones, las escuelas están cayéndose.',    zona:'Norte',     fecha:'2025-02-15', tema:'educacion',       sentimiento:'negativo',  subtema:'infraestructura escolar',   confianza:0.89 },
  { id:12, texto:'Muy buen candidato, ojalá cumpla lo que promete.',                             zona:'Centro',    fecha:'2025-02-15', tema:'gobierno',        sentimiento:'positivo',  subtema:'expectativa positiva',      confianza:0.87 },
  { id:13, texto:'Poner iluminación en el camino a las comunidades rurales.',                    zona:'Sur',       fecha:'2025-02-14', tema:'seguridad',       sentimiento:'propuesta', subtema:'alumbrado público',         confianza:0.90 },
  { id:14, texto:'Que no sea como los anteriores que solo roban.',                               zona:'Norte',     fecha:'2025-02-14', tema:'gobierno',        sentimiento:'negativo',  subtema:'desconfianza política',     confianza:0.82 },
  { id:15, texto:'Más trabajo para los jóvenes que salen de la prepa.',                         zona:'Oriente',   fecha:'2025-02-13', tema:'empleo',          sentimiento:'propuesta', subtema:'empleo juvenil',            confianza:0.86 },
];

// Helpers
export const getColorPct = (pct) => pct >= 55 ? '#56d465' : pct >= 40 ? '#c9a227' : '#e05252';
export const getLabelPct = (pct) => pct >= 55 ? '✅ Fuerte' : pct >= 40 ? '⚠️ Medio' : '🔴 Bajo';

// Objeto MOCK consolidado para compatibilidad
export const MOCK = {
  candidato: MOCK_CANDIDATO,
  kpis: MOCK_KPIS,
  tendencia: MOCK_TENDENCIA,
  conoce_candidato: MOCK_CONOCE_CANDIDATO,
  evaluacion_gobierno: MOCK_EVALUACION_GOBIERNO,
  demografia_genero: MOCK_DEMOGRAFIA_GENERO,
  demografia_edad: MOCK_DEMOGRAFIA_EDAD,
  agenda: MOCK_AGENDA,
  medios: MOCK_MEDIOS,
  secciones: MOCK_SECCIONES,
  encuestadores: MOCK_ENCUESTADORES,
  cobertura_zona: MOCK_COBERTURA_ZONA,
  comentarios: MOCK_COMENTARIOS,
};

export default MOCK;

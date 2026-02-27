// lib/theme.js — Fuente única de verdad para colores y tipografía
// Reemplaza los 5 objetos C duplicados en cada componente

export const C = {
  bg:         '#07100a',
  surface:    '#0f1d12',
  surfaceEl:  '#172619',
  border:     '#264030',
  borderAct:  '#c9a227',
  greenDark:  '#1a4d26',
  green:      '#2d7a3a',
  greenLight: '#3ea84a',
  greenAcc:   '#56d465',
  gold:       '#c9a227',
  goldLight:  '#e4be45',
  goldDim:    '#7a5f14',
  textPri:    '#e8f2ea',
  textSec:    '#8dab94',
  textMut:    '#4d6b54',
  danger:     '#e05252',
  dangerDim:  '#5a1f1f',
  amber:      '#e07c10',
};

export const FONTS = {
  display: "'Syne', sans-serif",
  body:    "'DM Sans', sans-serif",
  mono:    "'JetBrains Mono', monospace",
};

// Alturas de navegación para cálculos de layout
export const NAV_HEIGHT = 56;        // px - Altura del NavBar global
export const WARROOM_HEADER = 72;    // px - Altura del header del WarRoom
export const ADMIN_HEADER = 80;      // px - Altura del header del AdminPanel

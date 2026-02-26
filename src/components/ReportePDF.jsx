'use client';
import { useState } from "react";
import { C as themeC } from "@/lib/theme";

// ✅ FIX: Mapeo desde theme.js para consistencia
const C = {
  bg1: themeC.bg, bg2: themeC.surface, bg3: themeC.surfaceEl, bg4: "#2d3b2d",
  accent: themeC.gold, accentDark: themeC.goldDim,
  textMain: themeC.textPri, textSub: themeC.textSec, textMuted: themeC.textMut,
  border: `rgba(201,168,76,0.18)`, borderSub: `rgba(255,255,255,0.06)`,
  positive: themeC.greenAcc, warning: themeC.amber, negative: themeC.danger,
};
const getColor = (p) => p >= 55 ? C.positive : p >= 40 ? C.warning : C.negative;
const getLabel = (p) => p >= 55 ? "Fuerte" : p >= 40 ? "Medio" : "Bajo";

const DATA = {
  candidato: "Paco García",
  nombreCompleto: "Juan Francisco García Martínez",
  cargo: "Candidato a Presidente Municipal",
  municipio: "Atlixco, Puebla",
  generado: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }),
  kpis: { reconocimiento: 61.4, intencion: 48.2, imagen: 54.7, total: 347, meta: 400 },
  tendencia: [
    { semana: "Sem 1 (6-Ene)", reconocimiento: 45, intencion: 38, imagen: 40 },
    { semana: "Sem 2 (13-Ene)", reconocimiento: 51, intencion: 42, imagen: 46 },
    { semana: "Sem 3 (20-Ene)", reconocimiento: 55, intencion: 44, imagen: 49 },
    { semana: "Sem 4 (27-Ene)", reconocimiento: 58, intencion: 46, imagen: 52 },
    { semana: "Sem 5 (3-Feb)", reconocimiento: 61, intencion: 48, imagen: 55 },
  ],
  reconocimiento: [
    { nombre: "Paco García", pct: 61.4 },
    { nombre: "Candidato 2", pct: 42.1 },
    { nombre: "Candidato 3", pct: 35.8 },
    { nombre: "Candidato 4", pct: 28.3 },
  ],
  topSecciones: [
    { sec: "0154", zona: "Centro Histórico (norte)", int: 62, n: 48 },
    { sec: "0158", zona: "Barrio de Santiago", int: 58, n: 41 },
    { sec: "0161", zona: "Col. Reforma", int: 55, n: 35 },
    { sec: "0194", zona: "Barrio de Jesús", int: 54, n: 23 },
    { sec: "0166", zona: "Col. Revolución", int: 52, n: 33 },
  ],
  weakSecciones: [
    { sec: "0175", zona: "San Félix Hidalgo", int: 28, n: 8 },
    { sec: "0172", zona: "San Jerónimo Coyula", int: 30, n: 15 },
    { sec: "0174", zona: "San Pedro Benito Juárez", int: 32, n: 10 },
  ],
  agenda: [
    { problema: "Seguridad pública", pct: 63 },
    { problema: "Empleo y economía", pct: 54 },
    { problema: "Agua y drenaje", pct: 45 },
    { problema: "Calles y baches", pct: 39 },
    { problema: "Salud", pct: 28 },
    { problema: "Limpieza", pct: 25 },
  ],
  hallazgos: [
    "Paco García lidera el reconocimiento con 61.4%, casi 20 puntos por encima del segundo candidato.",
    "La intención de voto (48.2%) tiene margen de crecimiento — los indecisos representan una oportunidad clave.",
    "Las secciones rurales (0171-0175) muestran los niveles más bajos. Se recomienda intensificar presencia.",
    "Seguridad pública es el tema #1 con 63% de menciones. Incorporar propuestas concretas.",
    "El segmento 26-35 años muestra la mayor intención (51%). Considerar estrategia digital para este rango.",
  ],
};

export default function ReportePDF() {
  const [periodo] = useState({ from: "1 de enero 2025", to: "31 de enero 2025" });
  const d = DATA;
  const pctMeta = Math.round((d.kpis.total / d.kpis.meta) * 100);

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: "16px", fontFamily: "'Georgia','Times New Roman',serif" }}>
      {/* Print button */}
      <div style={{ maxWidth: 780, margin: "0 auto 12px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={() => window.print()} style={{
          padding: "8px 20px", borderRadius: 6, border: "none",
          background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`,
          color: C.bg1, fontWeight: "bold", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
        }}>
          🖨️ Imprimir / Guardar como PDF
        </button>
      </div>

      {/* Report container */}
      <div style={{
        maxWidth: 780, margin: "0 auto", background: C.bg1,
        border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden",
      }}>

        {/* ═══ PORTADA ═══ */}
        <div style={{
          padding: "36px 44px", textAlign: "center",
          background: `linear-gradient(160deg, ${C.bg2}, ${C.bg3})`,
          borderBottom: `3px solid ${C.accent}`,
        }}>
          <div style={{ color: C.accent, fontSize: 10, letterSpacing: 6, textTransform: "uppercase", marginBottom: 10 }}>
            Reporte Ejecutivo de Campaña
          </div>
          <div style={{ color: C.textMain, fontSize: 30, fontWeight: "bold", lineHeight: 1.2 }}>{d.candidato}</div>
          <div style={{ color: C.textSub, fontSize: 14, marginTop: 4 }}>{d.nombreCompleto}</div>
          <div style={{ color: C.textSub, fontSize: 13, marginTop: 2 }}>{d.cargo} — {d.municipio}</div>
          <div style={{
            display: "inline-block", marginTop: 18, padding: "6px 22px", borderRadius: 20,
            border: `1px solid ${C.border}`, background: "rgba(201,168,76,0.06)",
            color: C.accent, fontSize: 12,
          }}>
            {periodo.from} — {periodo.to}
          </div>
          <div style={{ color: C.textMuted, fontSize: 10, marginTop: 10 }}>
            Generado el {d.generado} • Datos confidenciales
          </div>
        </div>

        <div style={{ padding: "28px 44px" }}>

          {/* ═══ KPIs ═══ */}
          <SH>Indicadores principales</SH>
          <div style={{ display: "flex", gap: 14, marginBottom: 28 }}>
            {[
              { l: "Reconocimiento", v: d.kpis.reconocimiento, s: "% conoce al candidato" },
              { l: "Intención de voto", v: d.kpis.intencion, s: "% votaría por Paco García" },
              { l: "Imagen positiva", v: d.kpis.imagen, s: "% percepción favorable" },
            ].map(k => (
              <div key={k.l} style={{
                flex: 1, textAlign: "center", padding: "18px 10px", borderRadius: 10,
                background: "rgba(255,255,255,0.02)", border: `1px solid ${getColor(k.v)}33`,
              }}>
                <div style={{ color: getColor(k.v), fontSize: 36, fontWeight: "bold", lineHeight: 1 }}>
                  {k.v}<span style={{ fontSize: 18 }}>%</span>
                </div>
                <div style={{ color: C.textMain, fontSize: 12, fontWeight: "bold", marginTop: 6 }}>{k.l}</div>
                <div style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>{k.s}</div>
                <div style={{
                  display: "inline-block", marginTop: 8, padding: "2px 10px", borderRadius: 12,
                  background: `${getColor(k.v)}15`, color: getColor(k.v), fontSize: 10,
                  border: `1px solid ${getColor(k.v)}30`,
                }}>
                  {getLabel(k.v)}
                </div>
              </div>
            ))}
          </div>

          {/* Avance */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: C.textSub, fontSize: 12 }}>Avance de levantamiento</span>
              <span style={{ color: C.textMain, fontSize: 12, fontWeight: "bold" }}>
                {d.kpis.total} / {d.kpis.meta} ({pctMeta}%)
              </span>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 4 }}>
              <div style={{
                height: "100%", borderRadius: 4, width: `${Math.min(100, pctMeta)}%`,
                background: `linear-gradient(90deg, ${C.accent}, ${C.accentDark})`,
              }} />
            </div>
          </div>

          {/* ═══ RECONOCIMIENTO COMPARATIVO ═══ */}
          <SH>Reconocimiento comparativo de candidatos</SH>
          <div style={{ marginBottom: 28 }}>
            {d.reconocimiento.map((c, i) => (
              <div key={c.nombre} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: i === 0 ? C.accent : C.textSub, fontSize: 12, fontWeight: i === 0 ? "bold" : "normal" }}>
                    {i === 0 ? "⭐ " : ""}{c.nombre}
                  </span>
                  <span style={{ color: i === 0 ? C.accent : C.textMuted, fontSize: 12, fontWeight: "bold" }}>{c.pct}%</span>
                </div>
                <div style={{ height: 7, background: "rgba(255,255,255,0.04)", borderRadius: 4 }}>
                  <div style={{
                    height: "100%", borderRadius: 4, width: `${c.pct}%`,
                    background: i === 0 ? `linear-gradient(90deg, ${C.accent}, ${C.accentDark})` : "rgba(255,255,255,0.12)",
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* ═══ TENDENCIA ═══ */}
          <SH>Tendencia semanal</SH>
          <div style={{ marginBottom: 28, overflowX: "auto" }}>
            {/* Mini chart with SVG */}
            <svg viewBox="0 0 680 160" style={{ width: "100%", height: "auto" }}>
              <rect width="680" height="160" fill="rgba(255,255,255,0.01)" rx="8" />
              {/* Grid lines */}
              {[20, 40, 60, 80].map(v => {
                const y = 140 - (v / 100) * 120;
                return <g key={v}>
                  <line x1="50" y1={y} x2="660" y2={y} stroke="rgba(255,255,255,0.04)" />
                  <text x="45" y={y + 4} fill={C.textMuted} fontSize="9" textAnchor="end">{v}%</text>
                </g>;
              })}
              {/* Lines */}
              {[
                { key: "reconocimiento", color: "#60a5fa", label: "Reconocimiento" },
                { key: "intencion", color: C.accent, label: "Intención" },
                { key: "imagen", color: "#34d399", label: "Imagen" },
              ].map(line => {
                const points = d.tendencia.map((t, i) => {
                  const x = 80 + i * 145;
                  const y = 140 - (t[line.key] / 100) * 120;
                  return `${x},${y}`;
                }).join(" ");
                return <g key={line.key}>
                  <polyline points={points} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinejoin="round" />
                  {d.tendencia.map((t, i) => {
                    const x = 80 + i * 145;
                    const y = 140 - (t[line.key] / 100) * 120;
                    return <g key={i}>
                      <circle cx={x} cy={y} r="4" fill={line.color} />
                      <text x={x} y={y - 10} fill={line.color} fontSize="9" textAnchor="middle" fontWeight="bold">
                        {t[line.key]}%
                      </text>
                    </g>;
                  })}
                </g>;
              })}
              {/* X labels */}
              {d.tendencia.map((t, i) => (
                <text key={i} x={80 + i * 145} y={155} fill={C.textMuted} fontSize="8" textAnchor="middle">
                  {t.semana}
                </text>
              ))}
              {/* Legend */}
              {[
                { label: "Reconocimiento", color: "#60a5fa", x: 80 },
                { label: "Intención", color: C.accent, x: 240 },
                { label: "Imagen", color: "#34d399", x: 370 },
              ].map(l => (
                <g key={l.label}>
                  <line x1={l.x} y1={8} x2={l.x + 20} y2={8} stroke={l.color} strokeWidth="2.5" />
                  <text x={l.x + 25} y={11} fill={C.textSub} fontSize="9">{l.label}</text>
                </g>
              ))}
            </svg>
          </div>

          {/* ═══ SECCIONES ═══ */}
          <div style={{ display: "flex", gap: 20, marginBottom: 28 }}>
            <div style={{ flex: 1 }}>
              <SH>🟢 Secciones más fuertes</SH>
              {d.topSecciones.map(s => (
                <div key={s.sec} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.borderSub}` }}>
                  <div>
                    <span style={{ color: C.textMain, fontSize: 11 }}>Sec. {s.sec}</span>
                    <span style={{ color: C.textMuted, fontSize: 10, marginLeft: 6 }}>{s.zona}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.textMuted, fontSize: 10 }}>n={s.n}</span>
                    <span style={{ color: C.positive, fontSize: 12, fontWeight: "bold", minWidth: 36, textAlign: "right" }}>{s.int}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <SH>🔴 Secciones por atender</SH>
              {d.weakSecciones.map(s => (
                <div key={s.sec} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.borderSub}` }}>
                  <div>
                    <span style={{ color: C.textMain, fontSize: 11 }}>Sec. {s.sec}</span>
                    <span style={{ color: C.textMuted, fontSize: 10, marginLeft: 6 }}>{s.zona}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.textMuted, fontSize: 10 }}>n={s.n}</span>
                    <span style={{ color: C.negative, fontSize: 12, fontWeight: "bold", minWidth: 36, textAlign: "right" }}>{s.int}%</span>
                  </div>
                </div>
              ))}
              <div style={{ color: C.textMuted, fontSize: 10, marginTop: 8, fontStyle: "italic", lineHeight: 1.4 }}>
                Recomendación: Priorizar visitas de campo y eventos en estas zonas rurales.
              </div>
            </div>
          </div>

          {/* ═══ AGENDA ═══ */}
          <SH>Agenda ciudadana — Principales problemas de Atlixco</SH>
          <div style={{ marginBottom: 28 }}>
            {d.agenda.map((a, i) => (
              <div key={a.problema} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: i < 3 ? C.accent : C.textSub, fontSize: 12 }}>
                    {i < 3 ? "🔥 " : "   "}{a.problema}
                  </span>
                  <span style={{ color: C.textMuted, fontSize: 11 }}>{a.pct}%</span>
                </div>
                <div style={{ height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 3 }}>
                  <div style={{
                    height: "100%", borderRadius: 3, width: `${a.pct}%`,
                    background: i < 3 ? `linear-gradient(90deg, ${C.accent}, ${C.accentDark})` : "rgba(255,255,255,0.08)",
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* ═══ HALLAZGOS ═══ */}
          <SH>Hallazgos clave y recomendaciones</SH>
          <div style={{ marginBottom: 16 }}>
            {d.hallazgos.map((h, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                  background: "rgba(201,168,76,0.08)", border: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: C.accent, fontSize: 10, fontWeight: "bold",
                }}>{i + 1}</div>
                <span style={{ color: C.textSub, fontSize: 12, lineHeight: 1.6 }}>{h}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 44px", background: C.bg2, borderTop: `2px solid ${C.accent}`,
          display: "flex", justifyContent: "space-between",
        }}>
          <span style={{ color: C.textMuted, fontSize: 9 }}>CONFIDENCIAL • Solo uso interno de campaña</span>
          <span style={{ color: C.accent, fontSize: 9, letterSpacing: 2 }}>ENCUESTADORA POLÍTICA • ATLIXCO 2025</span>
        </div>
      </div>
    </div>
  );
}

function SH({ children }) {
  return (
    <div style={{
      color: C.accent, fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
      marginBottom: 14, paddingBottom: 6, borderBottom: `1px solid ${C.border}`,
    }}>
      {children}
    </div>
  );
}

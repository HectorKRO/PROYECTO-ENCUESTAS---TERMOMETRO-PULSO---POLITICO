'use client';
/**
 * AnalisisSentimiento.jsx — Análisis de respuestas abiertas con LLM
 * Sprint 3 — Encuestadora Política
 * 
 * DEPENDENCIAS:
 *   - API de Anthropic (Claude) o endpoint propio /api/analizar-comentario
 *   - Supabase para leer/escribir análisis
 * 
 * FLUJO:
 *   1. Lee comentarios sin analizar de Supabase (comentario_final + otro_problema_texto)
 *   2. Envía lote a Claude API para clasificación
 *   3. Guarda resultado en tabla analisis_sentimiento
 *   4. Dashboard muestra feed filtrable por tema/sentimiento
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { C as themeC } from "@/lib/theme";

// ── PALETA ──────────────────────────────────────────────────
// ✅ FIX: Mapeo desde theme.js para consistencia con el resto de la app
const C = {
  bg1: themeC.bg,
  bg2: themeC.surface,
  bg3: themeC.surfaceEl,
  bg4: "#2d3b2d", // Valor intermedio no en theme
  accent: themeC.gold,
  accentDark: themeC.goldDim,
  textMain: themeC.textPri,
  textSub: themeC.textSec,
  textMuted: themeC.textMut,
  border: `rgba(201,168,76,0.18)`,
  borderSub: `rgba(255,255,255,0.06)`,
  cardBg: "rgba(26,46,26,0.45)",
  positive: themeC.greenAcc,
  negative: themeC.danger,
  neutral: "#60a5fa",
  warning: themeC.amber,
};

// ── CATEGORÍAS TEMÁTICAS ────────────────────────────────────
const TEMAS = {
  seguridad:      { emoji: "🔒", label: "Seguridad", color: "#ef4444" },
  infraestructura:{ emoji: "🛣️", label: "Infraestructura", color: "#f97316" },
  agua:           { emoji: "💧", label: "Agua y servicios", color: "#3b82f6" },
  empleo:         { emoji: "💼", label: "Empleo", color: "#8b5cf6" },
  salud:          { emoji: "🏥", label: "Salud", color: "#ec4899" },
  educacion:      { emoji: "📚", label: "Educación", color: "#06b6d4" },
  transporte:     { emoji: "🚌", label: "Transporte", color: "#84cc16" },
  gobierno:       { emoji: "🏛️", label: "Gobierno/Corrupción", color: "#eab308" },
  medioambiente:  { emoji: "🌳", label: "Medio ambiente", color: "#22c55e" },
  otro:           { emoji: "💬", label: "Otro", color: "#6b7280" },
};

const SENTIMIENTOS = {
  positivo: { emoji: "😊", label: "Positivo", color: C.positive },
  negativo: { emoji: "😠", label: "Negativo", color: C.negative },
  neutro:   { emoji: "😐", label: "Neutro",   color: C.neutral },
  propuesta:{ emoji: "💡", label: "Propuesta", color: C.warning },
};

// ── DATOS DEMO (simulan resultado del LLM) ─────────────────
const MOCK_ANALISIS = [
  { id: 1, texto: "Que arregle las calles del centro, están muy feas y llenas de baches.", zona: "Centro Histórico", fecha: "2025-02-20", tema: "infraestructura", sentimiento: "negativo", subtema: "baches", confianza: 0.95 },
  { id: 2, texto: "Más seguridad por las noches, especialmente en los barrios.", zona: "Barrio de Santiago", fecha: "2025-02-20", tema: "seguridad", sentimiento: "negativo", subtema: "vigilancia nocturna", confianza: 0.92 },
  { id: 3, texto: "Que apoye a los comerciantes locales con capacitación y créditos.", zona: "Col. Reforma", fecha: "2025-02-19", tema: "empleo", sentimiento: "propuesta", subtema: "apoyo a comercio local", confianza: 0.88 },
  { id: 4, texto: "Se necesita agua todos los días, no solo tres veces a la semana.", zona: "Barrio de San Juan", fecha: "2025-02-19", tema: "agua", sentimiento: "negativo", subtema: "suministro irregular", confianza: 0.97 },
  { id: 5, texto: "Más áreas verdes y parques para los niños del municipio.", zona: "Col. 5 de Mayo", fecha: "2025-02-18", tema: "medioambiente", sentimiento: "propuesta", subtema: "parques infantiles", confianza: 0.90 },
  { id: 6, texto: "Me parece bien que Paco García quiera mejorar las cosas.", zona: "Col. Revolución", fecha: "2025-02-18", tema: "gobierno", sentimiento: "positivo", subtema: "aprobación general", confianza: 0.85 },
  { id: 7, texto: "La basura se acumula en las esquinas y nadie la recoge.", zona: "Barrio del Carmen", fecha: "2025-02-17", tema: "infraestructura", sentimiento: "negativo", subtema: "recolección de basura", confianza: 0.93 },
  { id: 8, texto: "Deberían poner cámaras de seguridad en las entradas de la ciudad.", zona: "Zona Industrial", fecha: "2025-02-17", tema: "seguridad", sentimiento: "propuesta", subtema: "videovigilancia", confianza: 0.91 },
  { id: 9, texto: "El transporte público es malísimo, no hay suficientes rutas.", zona: "San Jerónimo Coyula", fecha: "2025-02-16", tema: "transporte", sentimiento: "negativo", subtema: "cobertura de rutas", confianza: 0.94 },
  { id: 10, texto: "Que se construya un hospital digno para Atlixco.", zona: "Col. Lázaro Cárdenas", fecha: "2025-02-16", tema: "salud", sentimiento: "propuesta", subtema: "infraestructura hospitalaria", confianza: 0.96 },
  { id: 11, texto: "Los maestros necesitan mejores condiciones, las escuelas están cayéndose.", zona: "San Baltazar", fecha: "2025-02-15", tema: "educacion", sentimiento: "negativo", subtema: "infraestructura escolar", confianza: 0.89 },
  { id: 12, texto: "Muy buen candidato, ojalá cumpla lo que promete.", zona: "Centro Histórico", fecha: "2025-02-15", tema: "gobierno", sentimiento: "positivo", subtema: "expectativa positiva", confianza: 0.87 },
  { id: 13, texto: "Poner iluminación en el camino a las comunidades rurales.", zona: "Santa Cruz", fecha: "2025-02-14", tema: "seguridad", sentimiento: "propuesta", subtema: "alumbrado público", confianza: 0.90 },
  { id: 14, texto: "Que no sea como los anteriores que solo roban.", zona: "Col. Las Granjas", fecha: "2025-02-14", tema: "gobierno", sentimiento: "negativo", subtema: "desconfianza política", confianza: 0.82 },
  { id: 15, texto: "Más trabajo para los jóvenes que salen de la prepa.", zona: "Col. Lomas", fecha: "2025-02-13", tema: "empleo", sentimiento: "propuesta", subtema: "empleo juvenil", confianza: 0.86 },
];

// ── PROMPT para Claude API ──────────────────────────────────
const SYSTEM_PROMPT = `Eres un analista político experto en campañas electorales mexicanas. 
Clasifica cada comentario de encuesta ciudadana en:

1. TEMA: una de estas categorías → seguridad, infraestructura, agua, empleo, salud, educacion, transporte, gobierno, medioambiente, otro
2. SENTIMIENTO: positivo, negativo, neutro, propuesta
3. SUBTEMA: frase de 2-4 palabras que resuma el punto específico
4. CONFIANZA: 0.0 a 1.0

Responde SOLO con JSON, sin backticks ni texto adicional:
[{"id":1,"tema":"seguridad","sentimiento":"negativo","subtema":"vigilancia nocturna","confianza":0.92}, ...]`;

/**
 * Función para analizar comentarios via Claude API
 * Llamar desde un endpoint serverless (Next.js API route)
 */
export async function analizarComentarios(comentarios) {
  const userMsg = JSON.stringify(comentarios.map(c => ({ id: c.id, texto: c.texto })));

  try {
    const res = await fetch("/api/analizar-sentimiento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    
    // ✅ FIX: Validación robusta de la respuesta antes de parsear
    if (!data?.content?.[0]?.text) {
      throw new Error('Respuesta de API inválida: estructura inesperada');
    }
    
    const parsedText = data.content[0].text.trim();
    
    // ✅ FIX: Manejo de respuesta envuelta en backticks
    const jsonMatch = parsedText.match(/```json\n?([\s\S]*?)\n?```/) || 
                      parsedText.match(/```([\s\S]*?)```/);
    const jsonString = jsonMatch ? jsonMatch[1].trim() : parsedText;
    
    return JSON.parse(jsonString);
  } catch (err) {
    console.error("Error analizando comentarios:", err);
    // ✅ FIX: Retornar array vacío en lugar de null para evitar errores downstream
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// COMPONENTE DE VISUALIZACIÓN
// ═══════════════════════════════════════════════════════════
export default function AnalisisSentimiento() {
  const [filterTema, setFilterTema] = useState("todos");
  const [filterSentimiento, setFilterSentimiento] = useState("todos");
  const [analyzing, setAnalyzing] = useState(false);
  const data = MOCK_ANALISIS; // TODO: reemplazar con Supabase query

  // Estadísticas agregadas
  const stats = useMemo(() => {
    const temaCount = {};
    const sentCount = {};
    const subtemas = {};

    data.forEach(d => {
      temaCount[d.tema] = (temaCount[d.tema] || 0) + 1;
      sentCount[d.sentimiento] = (sentCount[d.sentimiento] || 0) + 1;
      const key = `${d.tema}:${d.subtema}`;
      subtemas[key] = (subtemas[key] || 0) + 1;
    });

    const temasOrdered = Object.entries(temaCount)
      .sort((a, b) => b[1] - a[1])
      .map(([tema, count]) => ({ tema, count, pct: Math.round(count / data.length * 100) }));

    const sentOrdered = Object.entries(sentCount)
      .sort((a, b) => b[1] - a[1])
      .map(([sent, count]) => ({ sent, count, pct: Math.round(count / data.length * 100) }));

    const topSubtemas = Object.entries(subtemas)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key, count]) => {
        const [tema, subtema] = key.split(":");
        return { tema, subtema, count };
      });

    return { temasOrdered, sentOrdered, topSubtemas, total: data.length };
  }, [data]);

  // Filtrado
  const filtered = useMemo(() => {
    return data.filter(d =>
      (filterTema === "todos" || d.tema === filterTema) &&
      (filterSentimiento === "todos" || d.sentimiento === filterSentimiento)
    );
  }, [data, filterTema, filterSentimiento]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    // Simular análisis
    await new Promise(r => setTimeout(r, 2000));
    setAnalyzing(false);
    alert("✅ Análisis completado. En producción esto llamaría a la API de Claude y guardaría resultados en Supabase.");
  };

  return (
    <div style={{
      background: C.bg1,
      fontFamily: "'Crimson Pro','Georgia',serif",
      color: C.textMain,
      borderRadius: 12,
      border: `1px solid ${C.borderSub}`,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        background: `linear-gradient(90deg, ${C.bg2}, ${C.bg3})`,
        borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 8,
      }}>
        <div>
          <div style={{ color: C.accent, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
            🧠 Análisis de sentimiento — Respuestas abiertas
          </div>
          <div style={{ color: C.textSub, fontSize: 11, marginTop: 2 }}>
            {stats.total} comentarios analizados • Clasificación por IA (Claude)
          </div>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          style={{
            padding: "8px 18px", borderRadius: 6, border: "none",
            background: analyzing ? C.bg3 : `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`,
            color: analyzing ? C.textSub : C.bg1,
            fontWeight: "bold", fontSize: 12, cursor: analyzing ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {analyzing ? "🔄 Analizando..." : "🧠 Analizar nuevos"}
        </button>
      </div>

      <div style={{ padding: 20 }}>

        {/* ── RESUMEN POR TEMA ────────────────────────────── */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          {/* Distribución por tema */}
          <div style={{ flex: "1 1 350px", ...cardInner }}>
            <div style={{ color: C.accent, fontSize: 10, letterSpacing: 2, marginBottom: 12 }}>DISTRIBUCIÓN POR TEMA</div>
            {stats.temasOrdered.map(t => {
              const tema = TEMAS[t.tema] || TEMAS.otro;
              return (
                <div key={t.tema} style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => setFilterTema(filterTema === t.tema ? "todos" : t.tema)}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ color: filterTema === t.tema ? C.accent : C.textSub, fontSize: 11, transition: "color 0.2s" }}>
                      {tema.emoji} {tema.label}
                    </span>
                    <span style={{ color: C.textMuted, fontSize: 11 }}>{t.count} ({t.pct}%)</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2 }}>
                    <div style={{
                      height: "100%", borderRadius: 2, width: `${t.pct}%`,
                      background: tema.color, opacity: filterTema === t.tema ? 1 : 0.5,
                      transition: "all 0.3s",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Distribución por sentimiento */}
          <div style={{ flex: "0 1 200px", ...cardInner }}>
            <div style={{ color: C.accent, fontSize: 10, letterSpacing: 2, marginBottom: 12 }}>SENTIMIENTO</div>
            {stats.sentOrdered.map(s => {
              const sent = SENTIMIENTOS[s.sent] || SENTIMIENTOS.neutro;
              return (
                <button
                  key={s.sent}
                  onClick={() => setFilterSentimiento(filterSentimiento === s.sent ? "todos" : s.sent)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "100%", padding: "8px 10px", marginBottom: 4,
                    borderRadius: 6, border: "1px solid",
                    borderColor: filterSentimiento === s.sent ? sent.color : "transparent",
                    background: filterSentimiento === s.sent ? `${sent.color}15` : "transparent",
                    color: C.textSub, fontSize: 12, cursor: "pointer",
                    textAlign: "left", transition: "all 0.2s",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{sent.emoji}</span>
                  <span style={{ flex: 1 }}>{sent.label}</span>
                  <span style={{ color: sent.color, fontWeight: "bold" }}>{s.count}</span>
                </button>
              );
            })}
          </div>

          {/* Top subtemas */}
          <div style={{ flex: "0 1 240px", ...cardInner }}>
            <div style={{ color: C.accent, fontSize: 10, letterSpacing: 2, marginBottom: 12 }}>TEMAS ESPECÍFICOS TOP</div>
            {stats.topSubtemas.map((s, i) => {
              const tema = TEMAS[s.tema] || TEMAS.otro;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 0",
                  borderBottom: i < stats.topSubtemas.length - 1 ? `1px solid ${C.borderSub}` : "none",
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 3,
                    background: `${tema.color}20`, border: `1px solid ${tema.color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, flexShrink: 0,
                  }}>
                    {tema.emoji}
                  </div>
                  <span style={{ color: C.textSub, fontSize: 11, flex: 1 }}>{s.subtema}</span>
                  <span style={{ color: C.textMuted, fontSize: 10, fontWeight: "bold" }}>{s.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── FILTROS ACTIVOS ─────────────────────────────── */}
        {(filterTema !== "todos" || filterSentimiento !== "todos") && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 16, padding: "8px 12px",
            background: "rgba(201,168,76,0.06)", borderRadius: 6,
            border: `1px solid ${C.border}`,
          }}>
            <span style={{ color: C.accent, fontSize: 11 }}>Filtros:</span>
            {filterTema !== "todos" && (
              <Tag color={TEMAS[filterTema]?.color || "#666"} onRemove={() => setFilterTema("todos")}>
                {TEMAS[filterTema]?.emoji} {TEMAS[filterTema]?.label}
              </Tag>
            )}
            {filterSentimiento !== "todos" && (
              <Tag color={SENTIMIENTOS[filterSentimiento]?.color || "#666"} onRemove={() => setFilterSentimiento("todos")}>
                {SENTIMIENTOS[filterSentimiento]?.emoji} {SENTIMIENTOS[filterSentimiento]?.label}
              </Tag>
            )}
            <span style={{ color: C.textMuted, fontSize: 11, marginLeft: "auto" }}>
              {filtered.length} de {stats.total} comentarios
            </span>
          </div>
        )}

        {/* ── FEED DE COMENTARIOS ─────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(d => {
            const tema = TEMAS[d.tema] || TEMAS.otro;
            const sent = SENTIMIENTOS[d.sentimiento] || SENTIMIENTOS.neutro;
            return (
              <div key={d.id} style={{
                padding: "12px 16px", borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${C.borderSub}`,
                transition: "border-color 0.2s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  {/* Tema badge */}
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: 10,
                    background: `${tema.color}15`, color: tema.color,
                    border: `1px solid ${tema.color}30`,
                  }}>
                    {tema.emoji} {tema.label}
                  </span>
                  {/* Sentimiento badge */}
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: 10,
                    background: `${sent.color}15`, color: sent.color,
                    border: `1px solid ${sent.color}30`,
                  }}>
                    {sent.emoji} {sent.label}
                  </span>
                  {/* Subtema */}
                  <span style={{ color: C.textMuted, fontSize: 10, fontStyle: "italic" }}>
                    → {d.subtema}
                  </span>
                  {/* Confianza */}
                  <span style={{ color: C.textMuted, fontSize: 9, marginLeft: "auto" }}>
                    {Math.round(d.confianza * 100)}% conf.
                  </span>
                </div>
                <div style={{ color: C.textMain, fontSize: 13, lineHeight: 1.5, fontStyle: "italic" }}>
                  "{d.texto}"
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ color: C.accent, fontSize: 10 }}>📍 {d.zona}</span>
                  <span style={{ color: C.textMuted, fontSize: 10 }}>{d.fecha}</span>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
            No hay comentarios que coincidan con los filtros seleccionados.
          </div>
        )}
      </div>
    </div>
  );
}

function Tag({ children, color, onRemove }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 4,
      background: `${color}15`, color, fontSize: 11,
      border: `1px solid ${color}30`,
    }}>
      {children}
      <span onClick={onRemove} style={{ cursor: "pointer", marginLeft: 2, fontSize: 13 }}>×</span>
    </span>
  );
}

const cardInner = {
  background: "rgba(255,255,255,0.02)",
  border: `1px solid ${C.borderSub}`,
  borderRadius: 10, padding: 14,
};

// ═══════════════════════════════════════════════════════════
// API ROUTE (Next.js) — /pages/api/analizar-sentimiento.js
// ═══════════════════════════════════════════════════════════
/*
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { system, messages } = req.body;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system,
      messages,
    }),
  });

  const data = await response.json();
  res.status(200).json(data);
}
*/

'use client';
/**
 * AdminPanel.jsx — Panel de administración de campaña v2.3
 * 
 * FUNCIONALIDADES:
 *   - Editar nombres de candidatos rivales
 *   - Gestionar encuestadores (activar/desactivar)
 *   - Configuración general de campaña
 *   - Log de sincronizaciones offline
 *   - Ajustar meta de encuestas
 * 
 * ✅ FIX v2.3: Integración real con Supabase (no solo mock)
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { C, NAV_HEIGHT } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import CandidatosManager from "@/components/CandidatosManager";

const TABS = [
  { key: "campana", label: "⚙️ Campaña", icon: "⚙️" },
  { key: "candidatos", label: "👥 Candidatos", icon: "👥" },
  { key: "encuestadores", label: "📋 Encuestadores", icon: "📋" },
  { key: "sync", label: "🔄 Sincronización", icon: "🔄" },
];

// ── COMPONENTE PRINCIPAL ────────────────────────────────────
export default function AdminPanel({ campanaId }) {
  const router = useRouter();
  const [tab, setTab] = useState("campana");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // Datos de la campaña
  const [campana, setCampana] = useState(null);
  const [, setCandidatosRivales] = useState([]);
  const [encuestadores, setEncuestadores] = useState([]);
  const [syncLog, setSyncLog] = useState([]);

  // Estado para crear nuevo encuestador
  const [showNuevoEncuestador, setShowNuevoEncuestador] = useState(false);
  const [nuevoEnc, setNuevoEnc] = useState({ nombre: '', email: '' });
  const [savingEnc, setSavingEnc] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, [campanaId]);

  const loadData = async () => {
    if (!campanaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // ✅ FIX P2: Cargar campaña con JOIN al candidato para obtener nombre
      const { data: campanaData, error: campanaError } = await supabase
        .from('campanas')
        .select(`
          *,
          candidato:candidato_id(nombre, cargo, partido, color_primario)
        `)
        .eq('id', campanaId)
        .single();
      
      if (campanaError) {
        // Usar datos demo si no hay conexión
        // ✅ FIX: candidato SIEMPRE es string (candidatoObj es el objeto), igual que el else branch
        setCampana({
          id: 'demo',
          nombre: "Campaña Demo 2025",
          candidato: "Candidato Demo",
          candidatoObj: { cargo: "Presidente Municipal", partido: "", color_primario: null },
          meta_encuestas: 400,
          activa: true,
        });
      } else {
        // Transformar datos para mantener compatibilidad
        setCampana({
          ...campanaData,
          candidato: campanaData.candidato?.nombre || 'Sin candidato',
          candidatoObj: campanaData.candidato,
        });
      }

      // Cargar encuestadores
      const { data: encuestadoresData } = await supabase
        .from('encuestadores')
        .select('*')
        .eq('campana_id', campanaId)
        .order('created_at', { ascending: false });
      
      setEncuestadores(encuestadoresData || []);

      // ✅ FIX P3: Cargar candidatos rivales desde Supabase
      const { data: rivalesData } = await supabase
        .from('candidatos_rivales')
        .select('*')
        .eq('campana_id', campanaId)
        .eq('activo', true)
        .order('orden', { ascending: true });
      
      setCandidatosRivales(rivalesData || []);

      // ✅ FIX P4: Cargar log de sync real desde encuestas_pendientes
      const { data: syncData } = await supabase
        .from('encuestas_pendientes')
        .select('*, encuestador:encuestador_id(nombre)')
        .eq('campana_id', campanaId)
        .eq('sincronizada', true)
        .order('synced_at', { ascending: false })
        .limit(10);
      
      const formattedSyncLog = (syncData || []).map((item) => ({
        id: item.id,
        encuestador: item.encuestador?.nombre || 'Desconocido',
        fecha: new Date(item.synced_at).toLocaleString('es-MX'),
        cantidad: item.cantidad || 1,
        status: 'ok',
        dispositivo: item.dispositivo || 'Desconocido',
      }));
      
      setSyncLog(formattedSyncLog.length > 0 ? formattedSyncLog : [
        { id: 1, encuestador: "Sin sincronizaciones", fecha: "-", cantidad: 0, status: "ok", dispositivo: "-" },
      ]);

    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('Error de conexión. Usando modo demo.');
      
      // Datos de fallback mínimos
      setCampana({
        id: 'demo',
        nombre: "Campaña Demo",
        candidato: "Candidato Demo",
        metaEncuestas: 400,
        activa: true,
      });
      setEncuestadores([]);
      setCandidatosRivales([]);
      setSyncLog([]);
    } finally {
      setLoading(false);
    }
  };

  const showSaved = () => { 
    setSaved(true); 
    setTimeout(() => setSaved(false), 2000); 
  };

  const updateCampana = (field, value) => {
    setCampana(c => ({ ...c, [field]: value }));
  };

  const saveCampana = async () => {
    try {
      if (campanaId && campanaId !== 'demo') {
        const { error } = await supabase
          .from('campanas')
          .update({
            nombre: campana.nombre,
            meta_encuestas: campana.meta_encuestas,
            activa: campana.activa,
          })
          .eq('id', campanaId);

        if (error) throw error;
      }
      showSaved();
    } catch (err) {
      console.error('Error guardando:', err);
      // ✅ FIX M4: Mostrar error en UI en lugar de alert() nativo
      setError('Error al guardar: ' + (err.message || 'Error desconocido'));
      setTimeout(() => setError(null), 5000);
    }
  };

  const toggleEncuestador = async (id) => {
    const encuestador = encuestadores.find(e => e.id === id);
    if (!encuestador) return;

    try {
      // ✅ FIX M2: Condición simplificada — los IDs de mock son números enteros,
      // los IDs reales de Supabase son UUIDs (strings). Solo llamar a Supabase si
      // tenemos una campaña real (no 'demo') y el ID es un UUID válido.
      const isRealId = campanaId && campanaId !== 'demo' && typeof id === 'string' && id.includes('-');
      if (isRealId) {
        const { error } = await supabase
          .from('encuestadores')
          .update({ activo: !encuestador.activo })
          .eq('id', id);

        if (error) throw error;
      }
      
      setEncuestadores(es => es.map(e => 
        e.id === id ? { ...e, activo: !e.activo } : e
      ));
      showSaved();
    } catch (err) {
      console.error('Error actualizando encuestador:', err);
    }
  };

  const crearEncuestador = async () => {
    if (!nuevoEnc.nombre.trim() || !nuevoEnc.email.trim()) {
      setError('Nombre y email son requeridos');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setSavingEnc(true);
    try {
      const isRealCampana = campanaId && campanaId !== 'demo';
      const newRecord = {
        nombre: nuevoEnc.nombre.trim(),
        email: nuevoEnc.email.trim().toLowerCase(),
        activo: true,
        encuestas: 0,
        campana_id: isRealCampana ? campanaId : null,
      };

      if (isRealCampana) {
        const { data, error: insertError } = await supabase
          .from('encuestadores')
          .insert(newRecord)
          .select()
          .single();
        if (insertError) throw insertError;
        setEncuestadores(prev => [...prev, data]);
      } else {
        setEncuestadores(prev => [...prev, { ...newRecord, id: Date.now() }]);
      }

      setNuevoEnc({ nombre: '', email: '' });
      setShowNuevoEncuestador(false);
      showSaved();
    } catch (err) {
      setError('Error al crear encuestador: ' + (err.message || 'Error desconocido'));
      setTimeout(() => setError(null), 5000);
    } finally {
      setSavingEnc(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: C.textMut }}>Cargando panel de administración...</div>
      </div>
    );
  }

  if (!campana) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: C.danger }}>No se pudo cargar la campaña</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: `calc(100vh - ${NAV_HEIGHT}px)`, background: C.bg, fontFamily: "'Segoe UI',system-ui,sans-serif", color: C.textPri }}>
      {/* ── HEADER COMPACTO v3.2 ── */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => router.push('/admin')}
              style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMut, fontSize: 12, cursor: 'pointer' }}
            >
              ←
            </button>
            <div>
              <div style={{ fontSize: 11, color: C.textMut, textTransform: 'uppercase', letterSpacing: '.04em' }}>Admin</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>{campana.nombre}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {error && <span style={{ fontSize: 12, color: C.amber }}>⚠️ {error}</span>}
            {saved && <span style={{ fontSize: 12, color: C.greenAcc }}>✓ Guardado</span>}
          </div>
        </div>
      </div>

      {/* ── TABS HORIZONTAL ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${C.border}`, padding: '0 24px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              border: 'none',
              borderBottom: tab === t.key ? `2px solid ${C.gold}` : '2px solid transparent',
              marginBottom: -2,
              background: 'transparent',
              color: tab === t.key ? C.goldLight : C.textMut,
              cursor: 'pointer',
              transition: 'color .2s, border-color .2s',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto' }}>

          {/* ── TAB: CAMPAÑA ──────────────────────────────── */}
          {tab === "campana" && (
            <div>
              <TabTitle>Configuración de campaña</TabTitle>
              
              <div style={{ ...cardStyle, marginBottom: 20, borderColor: C.gold + "40" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${campana.candidatoObj?.color_primario || C.gold}, ${C.goldDim})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: "bold", color: "#fff"
                  }}>
                    {campana.candidato?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ color: C.textPri, fontWeight: "bold" }}>{campana.candidato}</div>
                    <div style={{ color: C.textMut, fontSize: 12 }}>{campana.candidatoObj?.cargo} • {campana.candidatoObj?.partido}</div>
                  </div>
                </div>
              </div>

              <FormGroup label="Nombre de campaña">
                <Input value={campana.nombre} onChange={v => updateCampana("nombre", v)} />
              </FormGroup>
              
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <FormGroup label="Candidato" style={{ flex: 1, minWidth: 160 }}>
                  <Input value={campana.candidato} onChange={v => updateCampana("candidato", v)} />
                </FormGroup>
                <FormGroup label="Cargo" style={{ flex: 1, minWidth: 160 }}>
                  <Input value={campana.candidatoObj?.cargo || ''} onChange={v => updateCampana("cargo", v)} />
                </FormGroup>
              </div>

              <FormGroup label={`Meta de encuestas: ${campana.meta_encuestas}`}>
                <input
                  type="range" min="500" max="20000" step="500"
                  value={campana.meta_encuestas || 500}
                  onChange={e => updateCampana("meta_encuestas", parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: C.gold }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", color: C.textMut, fontSize: 10 }}>
                  <span>500</span><span>20,000</span>
                </div>
              </FormGroup>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <FormGroup label="Color primario" style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="color" value={campana.candidatoObj?.color_primario || '#c9a84c'} onChange={e => updateCampana("colorPrimario", e.target.value)} style={{ width: 40, height: 32, border: "none", borderRadius: 4, cursor: "pointer" }} />
                    <span style={{ color: C.textSec, fontSize: 12 }}>{campana.candidatoObj?.color_primario || '#c9a84c'}</span>
                  </div>
                </FormGroup>
                <FormGroup label="Estado" style={{ flex: 1, minWidth: 160 }}>
                  <button
                    onClick={() => updateCampana("activa", !campana.activa)}
                    style={{
                      padding: "8px 16px", borderRadius: 6,
                      border: `1px solid ${campana.activa ? C.greenAcc : C.danger}40`,
                      background: campana.activa ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                      color: campana.activa ? C.greenAcc : C.danger,
                      fontSize: 12, cursor: "pointer",
                    }}
                  >
                    {campana.activa ? "✓ Campaña activa" : "✗ Campaña inactiva"}
                  </button>
                </FormGroup>
              </div>

              <button onClick={saveCampana} style={btnPrimary}>💾 Guardar configuración</button>

              {/* ── Link de encuesta para encuestadores ── */}
              {campanaId && campanaId !== 'demo' && (
                <SurveyLink campanaId={campanaId} />
              )}
            </div>
          )}

          {/* ── TAB: CANDIDATOS ───────────────────── */}
          {tab === "candidatos" && (
            <CandidatosManager campanaId={campanaId} />
          )}

          {/* ── TAB: ENCUESTADORES ────────────────────────── */}
          {tab === "encuestadores" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                <TabTitle style={{ margin: 0, border: "none", padding: 0 }}>Equipo de encuestadores</TabTitle>
                <button
                  onClick={() => setShowNuevoEncuestador(v => !v)}
                  style={{
                    padding: "7px 16px", borderRadius: 6,
                    border: `1px solid ${C.gold}40`,
                    background: showNuevoEncuestador ? "rgba(201,168,76,0.1)" : "transparent",
                    color: C.gold, fontSize: 12, cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {showNuevoEncuestador ? "✕ Cancelar" : "+ Nuevo encuestador"}
                </button>
              </div>

              {/* Formulario nuevo encuestador */}
              {showNuevoEncuestador && (
                <div style={{
                  ...cardStyle,
                  marginBottom: 16,
                  borderColor: C.gold + "40",
                  background: "rgba(201,168,76,0.04)",
                }}>
                  <div style={{ color: C.gold, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                    Nuevo encuestador
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <label style={{ color: C.textSec, fontSize: 11, display: "block", marginBottom: 4, letterSpacing: 1 }}>NOMBRE</label>
                      <Input
                        value={nuevoEnc.nombre}
                        onChange={v => setNuevoEnc(p => ({ ...p, nombre: v }))}
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <label style={{ color: C.textSec, fontSize: 11, display: "block", marginBottom: 4, letterSpacing: 1 }}>EMAIL</label>
                      <Input
                        value={nuevoEnc.email}
                        onChange={v => setNuevoEnc(p => ({ ...p, email: v }))}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                  </div>
                  <button
                    onClick={crearEncuestador}
                    disabled={savingEnc}
                    style={{
                      ...btnPrimary,
                      marginTop: 12,
                      opacity: savingEnc ? 0.6 : 1,
                      cursor: savingEnc ? "not-allowed" : "pointer",
                    }}
                  >
                    {savingEnc ? "Guardando..." : "💾 Crear encuestador"}
                  </button>
                </div>
              )}

              {/* Lista de encuestadores */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {encuestadores.length === 0 ? (
                  <div style={{ color: C.textMut, fontSize: 13, padding: 20, textAlign: "center" }}>
                    No hay encuestadores registrados. Agrega el primero con el botón de arriba.
                  </div>
                ) : (
                  encuestadores.map(e => (
                    <div key={e.id} style={{ ...cardStyle, opacity: e.activo ? 1 : 0.5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: e.activo ? `linear-gradient(135deg, ${C.greenAcc}44, ${C.greenAcc}22)` : C.surfaceEl,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: "bold", color: e.activo ? C.greenAcc : C.textMut
                          }}>
                            {e.nombre.charAt(0)}
                          </div>
                          <div>
                            <div style={{ color: C.textPri, fontSize: 14, fontWeight: "bold" }}>{e.nombre}</div>
                            <div style={{ color: C.textMut, fontSize: 11 }}>{e.email}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ color: C.gold, fontSize: 18, fontWeight: "bold" }}>{e.encuestas || 0}</div>
                            <div style={{ color: C.textMut, fontSize: 9 }}>encuestas</div>
                          </div>
                          <button
                            onClick={() => toggleEncuestador(e.id)}
                            style={{
                              padding: "6px 14px", borderRadius: 6, border: "1px solid",
                              borderColor: e.activo ? C.danger + "40" : C.greenAcc + "40",
                              background: "transparent",
                              color: e.activo ? C.danger : C.greenAcc,
                              fontSize: 11, cursor: "pointer",
                            }}
                          >
                            {e.activo ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ color: C.textMut, fontSize: 11, marginTop: 16 }}>
                Al desactivar un encuestador, su enlace de encuesta dejará de funcionar.
                Sus encuestas ya levantadas se conservan.
              </div>
            </div>
          )}

          {/* ── TAB: SINCRONIZACIÓN ──────────────────────── */}
          {tab === "sync" && (
            <div>
              <TabTitle>Log de sincronizaciones offline</TabTitle>
              
              <div style={{ marginBottom: 16 }}>
                <button 
                  onClick={loadData}
                  style={{ ...btnSecondary, marginRight: 8 }}
                >
                  🔄 Actualizar
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {syncLog.length === 0 ? (
                  <div style={{ color: C.textMut, padding: 20, textAlign: "center" }}>
                    No hay sincronizaciones registradas.
                  </div>
                ) : (
                  syncLog.map(s => (
                    <div key={s.id} style={{
                      ...cardStyle,
                      borderLeftColor: s.status === "ok" ? C.greenAcc : C.danger,
                      borderLeftWidth: 3,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ color: C.textPri, fontSize: 13 }}>
                            {s.encuestador}
                            <span style={{
                              marginLeft: 8, padding: "1px 6px", borderRadius: 3, fontSize: 10,
                              background: s.status === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                              color: s.status === "ok" ? C.greenAcc : C.danger,
                            }}>
                              {s.status === "ok" ? "✓ Exitosa" : "✗ Error"}
                            </span>
                          </div>
                          <div style={{ color: C.textMut, fontSize: 11 }}>
                            {s.dispositivo} • {s.fecha}
                          </div>
                        </div>
                        <div style={{ color: C.gold, fontSize: 14, fontWeight: "bold" }}>
                          +{s.cantidad}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

// ── Link de encuesta para compartir con encuestadores ────────
function SurveyLink({ campanaId }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = `${origin}/encuesta?campana=${campanaId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={{ marginTop: 24, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
      <div style={{ fontSize: 11, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        Link de encuesta para encuestadores
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: 0,
          padding: '9px 12px', borderRadius: 6,
          border: `1px solid ${C.border}`,
          background: 'rgba(0,0,0,0.3)',
          fontSize: 12, color: C.textPri,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: 'monospace',
        }}>
          {link}
        </div>
        <button
          onClick={handleCopy}
          style={{
            padding: '9px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            border: `1px solid ${copied ? C.greenAcc + '60' : C.gold + '60'}`,
            background: copied ? `${C.greenAcc}15` : 'transparent',
            color: copied ? C.greenAcc : C.gold,
            cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            transition: 'all .2s',
          }}
        >
          {copied ? '✓ Copiado' : '📋 Copiar link'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: C.textMut, marginTop: 8 }}>
        Comparte este link con tus encuestadores. Todas las respuestas se registrarán automáticamente en esta campaña.
      </div>
    </div>
  );
}

// ── Componentes auxiliares ───────────────────────────────────
function TabTitle({ children, style = {} }) {
  return (
    <div style={{
      color: C.gold, fontSize: 16, fontWeight: "bold",
      marginBottom: 20, paddingBottom: 10,
      borderBottom: `1px solid ${C.border}`,
      ...style,
    }}>
      {children}
    </div>
  );
}

function FormGroup({ label, children, style = {} }) {
  return (
    <div style={{ marginBottom: 18, ...style }}>
      <label style={{ color: C.textSec, fontSize: 11, display: "block", marginBottom: 6, letterSpacing: 1 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "10px 12px", borderRadius: 6,
        border: `1px solid ${C.border}`, background: "rgba(10,17,10,0.6)",
        color: C.textPri, fontSize: 13, outline: "none", boxSizing: "border-box",
        fontFamily: "inherit",
      }}
    />
  );
}

const cardStyle = {
  background: C.surfaceEl,
  border: `1px solid ${C.border}`,
  borderRadius: 8, padding: "12px 16px",
};

const btnPrimary = {
  padding: "10px 24px", borderRadius: 6, border: "none",
  background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
  color: C.bg, fontWeight: "bold", fontSize: 13, cursor: "pointer",
  fontFamily: "inherit",
};

const btnSecondary = {
  padding: "10px 24px", borderRadius: 6,
  border: `1px solid ${C.border}`, background: "transparent",
  color: C.gold, fontSize: 13, cursor: "pointer",
  fontFamily: "inherit",
};

'use client';
/**
 * CandidatosManager.jsx — Gestión de candidatos v3.1
 * 
 * Funcionalidades:
 *   - Listar candidatos principales de la organización
 *   - Crear candidato principal (nombre, cargo, partido, color)
 *   - Gestionar candidatos rivales (para reconocimiento_asistido)
 *   - Activar/desactivar candidatos
 */

import { useState, useEffect } from 'react';
import { C } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useOrganizacion } from '@/hooks/useOrganizacion';

export default function CandidatosManager({ campanaId = null }) {
  const { organizacion, loading: orgLoading } = useOrganizacion();
  const orgId = organizacion?.id;
  const [activeTab, setActiveTab] = useState('principales'); // 'principales' | 'rivales'
  const [candidatos, setCandidatos] = useState([]);
  const [rivales, setRivales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modales
  const [showNuevoPrincipal, setShowNuevoPrincipal] = useState(false);
  const [showNuevoRival, setShowNuevoRival] = useState(false);

  // Confirmación de eliminación inline { tipo: 'principal'|'rival', id, nombre }
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);

  // Formularios
  const [formPrincipal, setFormPrincipal] = useState({
    nombre: '',
    cargo: 'Presidente Municipal',
    partido: '',
    municipio: 'Atlixco',
    color_primario: '#c9a84c',
  });

  const [formRival, setFormRival] = useState({
    nombre: '',
    partido: '',
    cargo: '',
  });

  useEffect(() => {
    if (orgId) loadData();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Cargar candidatos principales
      const { data: candidatosData } = await supabase
        .from('candidatos')
        .select('*')
        .eq('organizacion_id', orgId)
        .order('created_at', { ascending: false });

      setCandidatos(candidatosData || []);

      // Cargar candidatos rivales
      const { data: rivalesData } = await supabase
        .from('candidatos_rivales')
        .select('*')
        .eq('organizacion_id', orgId)
        .order('orden', { ascending: true });

      setRivales(rivalesData || []);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const crearCandidatoPrincipal = async () => {
    if (!formPrincipal.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    try {
      const { error } = await supabase
        .from('candidatos')
        .insert({
          ...formPrincipal,
          organizacion_id: orgId,
        });

      if (error) throw error;

      setShowNuevoPrincipal(false);
      setFormPrincipal({
        nombre: '',
        cargo: 'Presidente Municipal',
        partido: '',
        municipio: 'Atlixco',
        color_primario: '#c9a84c',
      });
      loadData();
    } catch (err) {
      setError('Error creando candidato: ' + err.message);
    }
  };

  const crearCandidatoRival = async () => {
    if (!formRival.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    try {
      const { error } = await supabase
        .from('candidatos_rivales')
        .insert({
          ...formRival,
          organizacion_id: orgId,
          orden: rivales.length + 1,
        });

      if (error) throw error;

      setShowNuevoRival(false);
      setFormRival({ nombre: '', partido: '', cargo: '' });
      loadData();
    } catch (err) {
      setError('Error creando rival: ' + err.message);
    }
  };

  const handleEliminar = async () => {
    if (!confirmarEliminar) return;
    const { tipo, id } = confirmarEliminar;
    const tabla = tipo === 'principal' ? 'candidatos' : 'candidatos_rivales';
    try {
      const { error } = await supabase.from(tabla).delete().eq('id', id);
      if (error) throw error;
      if (tipo === 'principal') {
        setCandidatos(prev => prev.filter(c => c.id !== id));
      } else {
        setRivales(prev => prev.filter(r => r.id !== id));
      }
      setConfirmarEliminar(null);
    } catch (err) {
      setError('No se puede eliminar: ' + err.message);
      setConfirmarEliminar(null);
    }
  };

  const toggleActivo = async (tipo, id, actual) => {
    try {
      const tabla = tipo === 'principal' ? 'candidatos' : 'candidatos_rivales';
      const { error } = await supabase
        .from(tabla)
        .update({ activo: !actual })
        .eq('id', id);

      if (error) throw error;

      if (tipo === 'principal') {
        setCandidatos(candidatos.map(c => c.id === id ? { ...c, activo: !actual } : c));
      } else {
        setRivales(rivales.map(r => r.id === id ? { ...r, activo: !actual } : r));
      }
    } catch (err) {
      setError('Error actualizando: ' + err.message);
    }
  };

  if (orgLoading || loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.textMut }}>
        Cargando candidatos...
      </div>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${C.border}` }}>
        <button
          onClick={() => setActiveTab('principales')}
          style={{
            padding: '12px 20px',
            background: activeTab === 'principales' ? C.surface : 'transparent',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'principales' ? C.gold : 'transparent'}`,
            color: activeTab === 'principales' ? C.gold : C.textSec,
            fontSize: 14,
            fontWeight: activeTab === 'principales' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          👤 Candidatos Principales ({candidatos.length})
        </button>
        <button
          onClick={() => setActiveTab('rivales')}
          style={{
            padding: '12px 20px',
            background: activeTab === 'rivales' ? C.surface : 'transparent',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'rivales' ? C.gold : 'transparent'}`,
            color: activeTab === 'rivales' ? C.gold : C.textSec,
            fontSize: 14,
            fontWeight: activeTab === 'rivales' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          🎯 Candidatos Rivales ({rivales.length})
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: `${C.danger}15`,
          border: `1px solid ${C.danger}`,
          padding: 12,
          borderRadius: 8,
          color: C.danger,
          fontSize: 13,
          marginBottom: 16,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Tab: Candidatos Principales */}
      {activeTab === 'principales' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ color: C.textMut, fontSize: 13 }}>
              Los candidatos principales pueden tener campañas asociadas.
            </p>
            <button
              onClick={() => setShowNuevoPrincipal(true)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: `1px solid ${C.gold}`,
                background: 'transparent',
                color: C.gold,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Nuevo candidato
            </button>
          </div>

          {candidatos.length === 0 ? (
            <div style={{
              background: C.surface,
              border: `1px dashed ${C.border}`,
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              color: C.textMut,
            }}>
              No hay candidatos principales registrados
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {candidatos.map(c => (
                <div
                  key={c.id}
                  style={{
                    background: C.surface,
                    border: `1px solid ${c.activo ? C.gold + '40' : C.border}`,
                    borderRadius: 10,
                    padding: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${c.color_primario || C.gold}, ${C.goldDim})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 700,
                      color: C.bg,
                    }}>
                      {c.nombre.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: C.textPri }}>{c.nombre}</div>
                      <div style={{ fontSize: 12, color: C.textSec }}>
                        {c.cargo} · {c.partido || 'Sin partido'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {confirmarEliminar?.id === c.id ? (
                      <>
                        <span style={{ fontSize: 11, color: C.danger }}>¿Eliminar?</span>
                        <button onClick={() => setConfirmarEliminar(null)} style={btnSmallCancel}>No</button>
                        <button onClick={handleEliminar} style={btnSmallDanger}>Sí</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleActivo('principal', c.id, c.activo)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 20,
                            border: `1px solid ${c.activo ? C.greenAcc + '40' : C.border}`,
                            background: c.activo ? `${C.greenAcc}15` : C.surfaceEl,
                            color: c.activo ? C.greenAcc : C.textMut,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {c.activo ? '✓ Activo' : 'Inactivo'}
                        </button>
                        <button
                          onClick={() => setConfirmarEliminar({ tipo: 'principal', id: c.id, nombre: c.nombre })}
                          style={btnSmallDelete}
                          title="Eliminar candidato"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Candidatos Rivales */}
      {activeTab === 'rivales' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ color: C.textMut, fontSize: 13 }}>
              Los candidatos rivales aparecen en la pregunta de reconocimiento asistido de la encuesta.
            </p>
            <button
              onClick={() => setShowNuevoRival(true)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: `1px solid ${C.gold}`,
                background: 'transparent',
                color: C.gold,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Agregar rival
            </button>
          </div>

          {rivales.length === 0 ? (
            <div style={{
              background: C.surface,
              border: `1px dashed ${C.border}`,
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              color: C.textMut,
            }}>
              No hay candidatos rivales configurados
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rivales.map(r => (
                <div
                  key={r.id}
                  style={{
                    background: C.surface,
                    border: `1px solid ${r.activo ? C.border : C.border}`,
                    borderRadius: 10,
                    padding: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: C.textPri }}>{r.nombre}</div>
                    <div style={{ fontSize: 12, color: C.textSec }}>
                      {r.partido || 'Sin partido'} {r.cargo && `· ${r.cargo}`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {confirmarEliminar?.id === r.id ? (
                      <>
                        <span style={{ fontSize: 11, color: C.danger }}>¿Eliminar?</span>
                        <button onClick={() => setConfirmarEliminar(null)} style={btnSmallCancel}>No</button>
                        <button onClick={handleEliminar} style={btnSmallDanger}>Sí</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleActivo('rival', r.id, r.activo)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 20,
                            border: `1px solid ${r.activo ? C.greenAcc + '40' : C.border}`,
                            background: r.activo ? `${C.greenAcc}15` : C.surfaceEl,
                            color: r.activo ? C.greenAcc : C.textMut,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {r.activo ? '✓ Activo' : 'Inactivo'}
                        </button>
                        <button
                          onClick={() => setConfirmarEliminar({ tipo: 'rival', id: r.id, nombre: r.nombre })}
                          style={btnSmallDelete}
                          title="Eliminar rival"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Nuevo Candidato Principal */}
      {showNuevoPrincipal && (
        <Modal onClose={() => setShowNuevoPrincipal(false)} title="Nuevo Candidato Principal">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Nombre completo *"
              value={formPrincipal.nombre}
              onChange={(v) => setFormPrincipal({ ...formPrincipal, nombre: v })}
              placeholder="Ej: Juan Francisco García"
            />
            <Input
              label="Cargo"
              value={formPrincipal.cargo}
              onChange={(v) => setFormPrincipal({ ...formPrincipal, cargo: v })}
            />
            <Input
              label="Partido"
              value={formPrincipal.partido}
              onChange={(v) => setFormPrincipal({ ...formPrincipal, partido: v })}
              placeholder="Ej: MORENA, PAN, PRI..."
            />
            <div>
              <label style={{ display: 'block', fontSize: 12, color: C.textSec, marginBottom: 6 }}>
                Color primario
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="color"
                  value={formPrincipal.color_primario}
                  onChange={(e) => setFormPrincipal({ ...formPrincipal, color_primario: e.target.value })}
                  style={{ width: 50, height: 40, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                />
                <span style={{ color: C.textSec, fontSize: 13 }}>{formPrincipal.color_primario}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <ButtonSecondary onClick={() => setShowNuevoPrincipal(false)}>Cancelar</ButtonSecondary>
            <ButtonPrimary onClick={crearCandidatoPrincipal}>Crear candidato</ButtonPrimary>
          </div>
        </Modal>
      )}

      {/* Modal: Nuevo Candidato Rival */}
      {showNuevoRival && (
        <Modal onClose={() => setShowNuevoRival(false)} title="Agregar Candidato Rival">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Nombre *"
              value={formRival.nombre}
              onChange={(v) => setFormRival({ ...formRival, nombre: v })}
              placeholder="Ej: María Elena Rosas"
            />
            <Input
              label="Partido"
              value={formRival.partido}
              onChange={(v) => setFormRival({ ...formRival, partido: v })}
              placeholder="Ej: PAN, PRI, MC..."
            />
            <Input
              label="Cargo (opcional)"
              value={formRival.cargo}
              onChange={(v) => setFormRival({ ...formRival, cargo: v })}
              placeholder="Ej: Diputada Federal"
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <ButtonSecondary onClick={() => setShowNuevoRival(false)}>Cancelar</ButtonSecondary>
            <ButtonPrimary onClick={crearCandidatoRival}>Agregar rival</ButtonPrimary>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Componentes auxiliares
function Modal({ children, onClose, title }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: 20,
    }}>
      <div style={{
        background: C.surface,
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 420,
        border: `1px solid ${C.border}`,
      }}>
        <h3 style={{ margin: '0 0 20px', color: C.textPri }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: C.textSec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          color: C.textPri,
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function ButtonPrimary({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 20px',
        borderRadius: 8,
        border: 'none',
        background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
        color: C.bg,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

const btnSmallDelete = {
  padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.danger}30`,
  background: 'transparent', color: C.danger, fontSize: 13, cursor: 'pointer', lineHeight: 1,
};

const btnSmallCancel = {
  padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
  background: 'transparent', color: C.textMut, fontSize: 11, cursor: 'pointer',
};

const btnSmallDanger = {
  padding: '4px 10px', borderRadius: 6, border: 'none',
  background: C.danger, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
};

function ButtonSecondary({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 20px',
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        background: 'transparent',
        color: C.textSec,
        fontSize: 14,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

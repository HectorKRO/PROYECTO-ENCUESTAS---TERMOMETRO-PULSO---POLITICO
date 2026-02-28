'use client';
/**
 * CampanasList.jsx — Lista de campañas v3.1
 * 
 * Funcionalidades:
 *   - Listar todas las campañas de la organización
 *   - Crear nueva campaña (modal inline)
 *   - Seleccionar campaña → /admin?campana=UUID
 *   - Cambiar estado activo/inactivo
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

export default function CampanasList() {
  const router = useRouter();
  const [campanas, setCampanas] = useState([]);
  const [candidatos, setCandidatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [showNuevoCandidato, setShowNuevoCandidato] = useState(false);
  const [formCandidato, setFormCandidato] = useState({ nombre: '', cargo: 'Presidente Municipal', partido: '' });
  const [savingCandidato, setSavingCandidato] = useState(false);

  // Formulario nueva campaña
  const [form, setForm] = useState({
    nombre: '',
    candidato_id: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    meta_encuestas: 400,
    color_primario: '#c9a84c',
  });

  // Cargar campañas y datos necesarios
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Obtener usuario y organización
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data: miembro } = await supabase
        .from('organizacion_miembros')
        .select('organizacion_id')
        .eq('user_id', user.id)
        .single();

      if (!miembro) throw new Error('No perteneces a una organización');
      setOrgId(miembro.organizacion_id);

      // Cargar campañas de la organización
      const { data: campanasData, error: campanasError } = await supabase
        .from('campanas')
        .select('*, candidato:candidato_id(nombre, cargo, partido)')
        .eq('organizacion_id', miembro.organizacion_id)
        .order('created_at', { ascending: false });

      if (campanasError) throw campanasError;
      setCampanas(campanasData || []);

      // Cargar candidatos disponibles
      const { data: candidatosData } = await supabase
        .from('candidatos')
        .select('id, nombre, cargo, partido')
        .eq('organizacion_id', miembro.organizacion_id)
        .eq('activo', true);

      setCandidatos(candidatosData || []);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearCampana = async () => {
    if (!form.nombre.trim() || !form.candidato_id) {
      setError('Nombre y candidato son obligatorios');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('campanas')
        .insert({
          nombre: form.nombre.trim(),
          candidato_id: form.candidato_id,
          organizacion_id: orgId,
          fecha_inicio: form.fecha_inicio,
          meta_encuestas: form.meta_encuestas,
          activa: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Resetear formulario y cerrar modal
      setForm({
        nombre: '',
        candidato_id: '',
        fecha_inicio: new Date().toISOString().split('T')[0],
        meta_encuestas: 400,
        color_primario: '#c9a84c',
      });
      setShowModal(false);

      // Redirigir al admin de la nueva campaña
      router.push(`/admin?campana=${data.id}`);
    } catch (err) {
      console.error('Error creando campaña:', err);
      setError('Error al crear campaña: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCrearCandidatoInline = async () => {
    if (!formCandidato.nombre.trim()) return;
    setSavingCandidato(true);
    try {
      const { data, error } = await supabase
        .from('candidatos')
        .insert({ ...formCandidato, organizacion_id: orgId })
        .select('id, nombre, cargo')
        .single();
      if (error) throw error;
      setCandidatos(prev => [...prev, data]);
      setForm(f => ({ ...f, candidato_id: data.id }));
      setShowNuevoCandidato(false);
      setFormCandidato({ nombre: '', cargo: 'Presidente Municipal', partido: '' });
    } catch (err) {
      setError('Error creando candidato: ' + err.message);
    } finally {
      setSavingCandidato(false);
    }
  };

  const toggleActiva = async (id, actual) => {
    try {
      const { error } = await supabase
        .from('campanas')
        .update({ activa: !actual })
        .eq('id', id);

      if (error) throw error;

      // Actualizar estado local
      setCampanas(campanas.map(c => 
        c.id === id ? { ...c, activa: !actual } : c
      ));
    } catch (err) {
      console.error('Error actualizando campaña:', err);
      setError('Error al actualizar: ' + err.message);
    }
  };

  const selectCampana = (id) => {
    router.push(`/admin?campana=${id}`);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.textMut }}>Cargando campañas...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Segoe UI',system-ui,sans-serif", color: C.textPri }}>
      {/* Header */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: '24px 32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: C.gold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
              Administración
            </div>
            <h1 style={{ margin: 0, fontSize: 24, color: C.textPri }}>Mis Campañas</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: 'none',
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
              color: C.bg,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            + Nueva campaña
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: `${C.danger}15`,
          border: `1px solid ${C.danger}`,
          padding: '12px 32px',
          color: C.danger,
          fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Lista de campañas */}
      <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
        {campanas.length === 0 ? (
          <div style={{
            background: C.surface,
            border: `1px dashed ${C.border}`,
            borderRadius: 16,
            padding: 60,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <h3 style={{ color: C.textPri, marginBottom: 8 }}>No hay campañas</h3>
            <p style={{ color: C.textMut, marginBottom: 24 }}>
              Crea tu primera campaña para comenzar a gestionar encuestas
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '12px 24px',
                borderRadius: 8,
                border: `1px solid ${C.gold}`,
                background: 'transparent',
                color: C.gold,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Crear primera campaña
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {campanas.map(campana => (
              <div
                key={campana.id}
                style={{
                  background: C.surface,
                  border: `1px solid ${campana.activa ? C.gold + '40' : C.border}`,
                  borderRadius: 12,
                  padding: 20,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => selectCampana(campana.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = C.gold;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = campana.activa ? C.gold + '40' : C.border;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Avatar del candidato */}
                  <div style={{
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 900,
                    color: C.bg,
                  }}>
                    {campana.candidato?.nombre?.charAt(0) || '?'}
                  </div>
                  
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.textPri, marginBottom: 4 }}>
                      {campana.nombre}
                    </div>
                    <div style={{ fontSize: 13, color: C.textSec }}>
                      {campana.candidato?.nombre || 'Sin candidato'} · {campana.candidato?.cargo || 'Sin cargo'}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMut, marginTop: 4 }}>
                      Meta: {campana.meta_encuestas} encuestas · Inicio: {new Date(campana.fecha_inicio).toLocaleDateString('es-MX')}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Estado */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleActiva(campana.id, campana.activa);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      border: `1px solid ${campana.activa ? C.greenAcc + '40' : C.border}`,
                      background: campana.activa ? `${C.greenAcc}15` : C.surfaceEl,
                      color: campana.activa ? C.greenAcc : C.textMut,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: campana.activa ? C.greenAcc : C.textMut,
                    }} />
                    {campana.activa ? 'Activa' : 'Inactiva'}
                  </button>

                  {/* Flecha */}
                  <span style={{ fontSize: 20, color: C.textMut }}>→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Crear nueva campaña */}
      {showModal && (
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
            padding: 32,
            width: '100%',
            maxWidth: 480,
            border: `1px solid ${C.border}`,
          }}>
            <h2 style={{ margin: '0 0 8px', color: C.textPri }}>Nueva Campaña</h2>
            <p style={{ margin: '0 0 24px', color: C.textMut, fontSize: 14 }}>
              Completa los datos para crear una nueva campaña
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Nombre */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: C.textSec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Nombre de la campaña *
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Paco García 2025"
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

              {/* Candidato */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: C.textSec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Candidato *
                </label>
                <select
                  value={form.candidato_id}
                  onChange={(e) => setForm({ ...form, candidato_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    color: form.candidato_id ? C.textPri : C.textMut,
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">— Seleccionar candidato —</option>
                  {candidatos.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.cargo})
                    </option>
                  ))}
                </select>
                {candidatos.length === 0 && !showNuevoCandidato && (
                  <div style={{ fontSize: 12, color: C.amber, marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>⚠️ No hay candidatos registrados.</span>
                    <button
                      onClick={() => setShowNuevoCandidato(true)}
                      style={{ fontSize: 12, color: C.gold, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      Crear candidato
                    </button>
                  </div>
                )}
                {showNuevoCandidato && (
                  <div style={{ marginTop: 10, padding: '14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>Nuevo candidato</div>
                    <input
                      placeholder="Nombre completo *"
                      value={formCandidato.nombre}
                      onChange={e => setFormCandidato(f => ({ ...f, nombre: e.target.value }))}
                      style={{ padding: '8px 10px', background: C.surfaceEl, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textPri, fontSize: 13, outline: 'none' }}
                    />
                    <input
                      placeholder="Cargo (ej: Presidente Municipal)"
                      value={formCandidato.cargo}
                      onChange={e => setFormCandidato(f => ({ ...f, cargo: e.target.value }))}
                      style={{ padding: '8px 10px', background: C.surfaceEl, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textPri, fontSize: 13, outline: 'none' }}
                    />
                    <input
                      placeholder="Partido (ej: MORENA, PAN...)"
                      value={formCandidato.partido}
                      onChange={e => setFormCandidato(f => ({ ...f, partido: e.target.value }))}
                      style={{ padding: '8px 10px', background: C.surfaceEl, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textPri, fontSize: 13, outline: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setShowNuevoCandidato(false)}
                        style={{ flex: 1, padding: '8px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, fontSize: 12, cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleCrearCandidatoInline}
                        disabled={savingCandidato || !formCandidato.nombre.trim()}
                        style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`, color: C.bg, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: savingCandidato ? 0.6 : 1 }}
                      >
                        {savingCandidato ? 'Creando...' : 'Crear y seleccionar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Fecha inicio */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: C.textSec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Fecha de inicio
                </label>
                <input
                  type="date"
                  value={form.fecha_inicio}
                  onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
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

              {/* Meta encuestas */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: C.textSec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Meta de encuestas: {form.meta_encuestas}
                </label>
                <input
                  type="range"
                  min="100"
                  max="20000"
                  step="500"
                  value={form.meta_encuestas}
                  onChange={(e) => setForm({ ...form, meta_encuestas: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: C.gold }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMut, marginTop: 4 }}>
                  <span>100</span>
                  <span>20,000</span>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button
                onClick={() => setShowModal(false)}
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
                Cancelar
              </button>
              <button
                onClick={handleCrearCampana}
                disabled={saving || !form.nombre.trim() || !form.candidato_id}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                  color: C.bg,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Creando...' : 'Crear campaña'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

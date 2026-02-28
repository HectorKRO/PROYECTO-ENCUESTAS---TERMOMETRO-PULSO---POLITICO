'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, syncOfflineQueue, savePendingOffline, getPendingCount, fetchColonias } from '@/lib/supabase';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { C } from '@/lib/theme';
import { IS_DEMO, OFFLINE_KEY } from '@/lib/constants';
import NavBar from '@/components/NavBar';

// ─── STEPS ─────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Perfil',          icon: '👤' },
  { id: 2, label: 'Reconocimiento',  icon: '🔍' },
  { id: 3, label: 'Posicionamiento', icon: '📊' },
  { id: 4, label: 'Opinión Final',   icon: '✅' },
];

// F8 FIX: SECCIONES_ELECTORALES y ZONAS eliminadas - ahora se cargan dinámicamente desde Supabase

const EDAD_RANGOS = ['18-24','25-34','35-44','45-54','55-64','65+'];
const ESCOLARIDAD = ['Sin escolaridad','Primaria','Secundaria','Preparatoria','Licenciatura','Posgrado'];
const OCUPACION   = ['Empleado','Comerciante','Estudiante','Ama de casa','Profesionista','Agricultor','Jubilado/Pensionado','Desempleado','Otro'];
const TEMAS       = ['Seguridad pública','Empleo','Infraestructura vial','Agua y servicios','Educación','Salud','Apoyo al campo','Medio ambiente','Comercio local','Corrupción'];
const PROPUESTAS  = ['Mejora de calles','Seguridad con más patrullas','Apoyos a emprendedores','Más áreas verdes','Programas para jóvenes','Gestión del agua','Digitalización de trámites','Fortalecimiento del turismo'];
const MEDIOS      = ['Facebook','Instagram','WhatsApp','TV local','Radio','Periódico','Cartelería','Boca a boca'];
const PARTIDOS    = ['MORENA','PAN','PRI','PRD','MC','PVEM','PT','Ninguno','No sabe/No contesta'];

// ─── CONFIG desde URL params ───────────────────────────────────────────────────
function getConfig() {
  if (typeof window === 'undefined') return { candidato:'Paco García', cargo:'Presidente Municipal', municipio:'Atlixco', campanaId:null, fuente:'campo' };
  const p = new URLSearchParams(window.location.search);
  return {
    candidato:  p.get('candidato')  || 'Paco García',
    cargo:      p.get('cargo')      || 'Presidente Municipal',
    municipio:  p.get('municipio')  || 'Atlixco',
    campanaId:  p.get('campana')    || null,
    fuente:     p.get('fuente')     || 'campo',
    experto:    p.get('experto')    === 'true', // ✅ UX: Modo experto
  };
}

// ─── GPS HOOK con validación de precisión ──────────────────────────────────────
function useGPS() {
  const [coords, setCoords] = useState({ lat:null, lng:null, precision:null });
  const [status, setStatus] = useState('idle');
  const timeoutRef = useRef(null);

  const capture = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error'); return;
    }
    setStatus('loading');
    const attempt = (retryCount = 0) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ 
            lat: pos.coords.latitude, 
            lng: pos.coords.longitude, 
            precision: pos.coords.accuracy 
          });
          setStatus('success');
        },
        () => {
          if (retryCount < 2) {
            timeoutRef.current = setTimeout(() => attempt(retryCount + 1), 3000);
          } else {
            setStatus('error');
          }
        },
        { enableHighAccuracy:true, timeout:15000, maximumAge:60000 }
      );
    };
    attempt();
  }, []);

  // ✅ FIX: Cleanup de timeout al desmontar
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { coords, status, capture };
}

// ─── HOOK: Detección de encuestas duplicadas ───────────────────────────────────
function useDuplicateDetection(encuestadorId) {
  const [recentCount, setRecentCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  const checkDuplicates = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    
    const STORAGE_KEY = 'encuestas_timestamp_log';
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const recent = history.filter(t => now - t < windowMs);
    
    setRecentCount(recent.length);
    setShowWarning(recent.length >= 3);
    
    return recent.length;
  }, []);

  const recordSubmission = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const STORAGE_KEY = 'encuestas_timestamp_log';
    const now = Date.now();
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    
    history.push(now);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-20)));
  }, []);

  return { recentCount, showWarning, checkDuplicates, recordSubmission };
}

// ─── HOOK: Autoguardado ─────────────────────────────────────────────────────────
function useAutosave(form, step, encuestaId) {
  const [hasRecoveredData, setHasRecoveredData] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveredData, setRecoveredData] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined' || step === 4) return;
    
    const interval = setInterval(() => {
      if (form.seccion_electoral_id || form.edad_rango) {
        const saveData = { form, step, timestamp: Date.now(), encuestaId };
        localStorage.setItem('encuesta_autosave', JSON.stringify(saveData));
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [form, step, encuestaId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const saved = localStorage.getItem('encuesta_autosave');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const ageHours = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
        
        if (ageHours < 24 && (parsed.form?.seccion_electoral_id || parsed.form?.edad_rango)) {
          setRecoveredData(parsed);
          setHasRecoveredData(true);
          setShowRecoveryModal(true);
        }
      } catch (e) {
        localStorage.removeItem('encuesta_autosave');
      }
    }
  }, []);

  const clearAutosave = useCallback(() => {
    localStorage.removeItem('encuesta_autosave');
    setHasRecoveredData(false);
    setShowRecoveryModal(false);
  }, []);

  const recoverData = useCallback(() => recoveredData, [recoveredData]);

  return { hasRecoveredData, showRecoveryModal, setShowRecoveryModal, recoverData, clearAutosave };
}

// ─── HOOK: Atajos de teclado ───────────────────────────────────────────────────
function useKeyboardShortcuts({ onNext, onBack, canNext, canBack, step }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar si está en un input de texto (excepto radio/check)
      const tag = e.target.tagName.toLowerCase();
      const isTextInput = tag === 'input' && e.target.type === 'text' || 
                          tag === 'textarea' || 
                          (tag === 'input' && e.target.type === 'tel');
      
      if (e.key === 'Enter' && !isTextInput && canNext) {
        e.preventDefault();
        onNext();
      }
      if (e.key === 'Escape' && canBack) {
        e.preventDefault();
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onBack, canNext, canBack]);
}

// ─── VALIDACIÓN ────────────────────────────────────────────────────────────────
function validateStep(step, form, gpsStatus, gpsPrecision) {
  const errors = [];
  const warnings = [];
  const completed = [];
  
  if (step === 1) {
    if (!form.colonia_id) errors.push('Colonia del encuestado');
    else completed.push('colonia');
    
    // Sección se calcula automáticamente de la colonia
    if (!form.seccion_electoral_id) errors.push('Sección electoral (selecciona una colonia)');
    else completed.push('seccion');
    
    if (!form.edad_rango) errors.push('Rango de edad');
    else completed.push('edad');
    
    if (!form.genero) errors.push('Género');
    else completed.push('genero');
    
    if (!form.escolaridad) errors.push('Escolaridad');
    else completed.push('escolaridad');
    
    if (!form.ocupacion) errors.push('Ocupación');
    else completed.push('ocupacion');
    
    if (gpsStatus !== 'success') errors.push('Ubicación GPS (obligatoria)');
    else if (gpsPrecision > 100) warnings.push(`Precisión GPS baja (±${Math.round(gpsPrecision)}m)`);
    else completed.push('gps');
  }
  
  if (step === 2) {
    if (!form.conoce_candidato) errors.push('Conocimiento del candidato');
    else completed.push('conocimiento');
    
    // DATA-3 FIX: Usar 'no_conoce' en lugar de 'no'
    if (form.conoce_candidato && form.conoce_candidato !== 'no_conoce' && !form.imagen_candidato) {
      errors.push('Imagen del candidato');
    } else if (form.imagen_candidato) completed.push('imagen');
  }
  
  if (step === 3) {
    if (!form.intencion_voto) errors.push('Intención de voto');
    else completed.push('intencion');
    
    if (!form.simpatia) errors.push('Simpatía');
    else completed.push('simpatia');
    
    if (!form.temas_prioritarios?.length) errors.push('Temas prioritarios');
    else completed.push('temas');
    
    if (!form.tema_principal) errors.push('Tema principal');
    else completed.push('tema_principal');
    
    if (!form.evaluacion_gobierno) errors.push('Evaluación del gobierno');
    else completed.push('evaluacion');
  }
  
  return { errors, warnings, completed };
}

// ─── COMPONENTES REUTILIZABLES ─────────────────────────────────────────────────

// ✅ UX: Progress Bar con porcentaje
function ProgressBar({ step, form }) {
  const percent = useMemo(() => {
    let completed = 0;
    let total = 4;
    if (form.zona_electoral) completed++;
    if (form.seccion_electoral_id) completed++;
    if (form.edad_rango) completed++;
    if (form.genero) completed++;
    if (form.escolaridad) completed++;
    if (form.ocupacion) completed++;
    return Math.min(100, Math.round((completed / 6) * 100));
  }, [form]);
  
  return (
    <div style={{ marginBottom:32 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:12, color:C.textMut, fontWeight:600 }}>
          PASO {step} DE {STEPS.length}
        </span>
        <span style={{ fontSize:12, color:C.gold, fontWeight:700 }}>
          {percent}% completado
        </span>
      </div>
      <div style={{ height:6, background:C.border, borderRadius:3, overflow:'hidden' }}>
        <div style={{ 
          height:'100%', 
          width:`${(step / STEPS.length) * 100}%`, 
          background:`linear-gradient(90deg, ${C.gold}, ${C.goldLight})`,
          borderRadius:3, 
          transition:'width 0.5s ease' 
        }} />
      </div>
      
      {/* Steps indicator */}
      <div style={{ display:'flex', gap:8, marginTop:16 }}>
        {STEPS.map((s, i) => {
          const active = s.id === step, done = s.id < step;
          return (
            <div key={s.id} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <div style={{ display:'flex', alignItems:'center', width:'100%' }}>
                <div style={{ flex: i===0?'0 0 50%':1, height:2, background: done?C.gold:C.border, transition:'background .4s', visibility: i===0?'hidden':'visible' }} />
                <div style={{ 
                  width:36, height:36, borderRadius:'50%', flexShrink:0, 
                  border:`2px solid ${active||done?C.gold:C.border}`, 
                  background: done?C.gold:active?C.greenDark:C.surface, 
                  display:'flex', alignItems:'center', justifyContent:'center', 
                  fontSize:16, fontWeight:700, color:done?C.bg:active?C.goldLight:C.textMut, 
                  transition:'all .3s', 
                  boxShadow:active?`0 0 16px ${C.gold}55`:'none',
                  transform: active ? 'scale(1.1)' : 'scale(1)',
                }}>
                  {done ? '✓' : s.icon}
                </div>
                <div style={{ flex: i===STEPS.length-1?'0 0 50%':1, height:2, background: s.id<step?C.gold:C.border, transition:'background .4s', visibility: i===STEPS.length-1?'hidden':'visible' }} />
              </div>
              <span style={{ fontSize:11, color:active?C.goldLight:done?C.textSec:C.textMut, fontWeight:active?700:400 }}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldLabel({ children, required, completed }) {
  return (
    <label style={{ display:'block', marginBottom:6, fontSize:13, fontWeight:600, color:C.textSec, letterSpacing:'.02em' }}>
      {children} 
      {required && <span style={{ color:C.gold }}>*</span>}
      {completed && <span style={{ color:C.greenAcc, marginLeft:4 }}>✓</span>}
    </label>
  );
}

function Input({ label, required, value, onChange, placeholder, type='text', disabled, completed }) {
  return (
    <div style={{ marginBottom:18 }}>
      <FieldLabel required={required} completed={completed && value}>{label}</FieldLabel>
      <input 
        type={type} 
        value={value} 
        onChange={e=>onChange(e.target.value)} 
        placeholder={placeholder} 
        disabled={disabled}
        style={{ 
          width:'100%', padding:'10px 14px', 
          background:C.surfaceEl, 
          border:`1.5px solid ${completed && value ? C.greenLight : C.border}`, 
          borderRadius:8, color:C.textPri, fontSize:14, outline:'none', 
          boxSizing:'border-box', transition:'all .2s',
          boxShadow: completed && value ? `0 0 0 2px ${C.green}33` : 'none'
        }}
        onFocus={e=>e.target.style.borderColor=C.gold} 
        onBlur={e=>e.target.style.borderColor=completed && value ? C.greenLight : C.border}
      />
    </div>
  );
}

function Select({ label, required, value, onChange, options, placeholder, completed }) {
  return (
    <div style={{ marginBottom:18 }}>
      <FieldLabel required={required} completed={completed && value}>{label}</FieldLabel>
      <select 
        value={value} 
        onChange={e=>onChange(e.target.value)}
        style={{ 
          width:'100%', padding:'10px 14px', 
          background:C.surfaceEl, 
          border:`1.5px solid ${completed && value ? C.greenLight : C.border}`, 
          borderRadius:8, color:value?C.textPri:C.textMut, fontSize:14, 
          outline:'none', boxSizing:'border-box', cursor:'pointer',
          transition:'all .2s',
          boxShadow: completed && value ? `0 0 0 2px ${C.green}33` : 'none'
        }}
        onFocus={e=>e.target.style.borderColor=C.gold} 
        onBlur={e=>e.target.style.borderColor=completed && value ? C.greenLight : C.border}
      >
        <option value="">{placeholder||'— Seleccionar —'}</option>
        {options.map(o => typeof o==='string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value??o.id} value={o.value??o.id}>{o.label}</option>
        )}
      </select>
    </div>
  );
}

function RadioGroup({ label, required, value, onChange, options, completed }) {
  return (
    <div style={{ marginBottom:18 }}>
      <FieldLabel required={required} completed={completed && value}>{label}</FieldLabel>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {options.map(o => {
          const val=typeof o==='string'?o:o.value, lbl=typeof o==='string'?o:o.label, sel=value===val;
          return (
            <button 
              key={val} 
              type="button" 
              onClick={()=>onChange(val)}
              style={{ 
                padding:'8px 16px', borderRadius:20, fontSize:13, 
                border:`1.5px solid ${sel?C.gold:C.border}`, 
                background:sel?`${C.gold}22`:C.surfaceEl, 
                color:sel?C.goldLight:C.textSec, cursor:'pointer', 
                fontWeight:sel?700:400, transition:'all .2s',
                transform: sel ? 'scale(1.02)' : 'scale(1)',
                boxShadow: sel ? `0 2px 8px ${C.gold}33` : 'none'
              }}
            >
              {lbl}
              {sel && <span style={{ marginLeft:4 }}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CheckGroup({ label, required, value=[], onChange, options, max, completed }) {
  const toggle = v => {
    if (value.includes(v)) onChange(value.filter(x=>x!==v));
    else if (!max||value.length<max) onChange([...value,v]);
  };
  return (
    <div style={{ marginBottom:18 }}>
      <FieldLabel required={required} completed={completed && value.length > 0}>{label}{max?<span style={{ color:C.textMut, fontWeight:400 }}> (máx. {max})</span>:''}</FieldLabel>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {options.map(o => {
          const val=typeof o==='string'?o:o.value, lbl=typeof o==='string'?o:o.label, sel=value.includes(val);
          return (
            <button 
              key={val} 
              type="button" 
              onClick={()=>toggle(val)}
              style={{ 
                padding:'8px 14px', borderRadius:8, fontSize:13, 
                border:`1.5px solid ${sel?C.greenLight:C.border}`, 
                background:sel?`${C.green}33`:C.surfaceEl, 
                color:sel?C.greenAcc:C.textSec, cursor:'pointer', 
                fontWeight:sel?700:400, transition:'all .2s',
                transform: sel ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {sel?'✓ ':''}{lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScaleInput({ label, required, value, onChange, min=1, max=5, lowLabel, highLabel, completed }) {
  return (
    <div style={{ marginBottom:22 }}>
      <FieldLabel required={required} completed={completed && value > 0}>{label}</FieldLabel>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:11, color:C.textMut, minWidth:80 }}>{lowLabel}</span>
        {Array.from({ length:max-min+1 },(_,i)=>i+min).map(n => {
          const sel=value===n;
          return (
            <button 
              key={n} 
              type="button" 
              onClick={()=>onChange(n)}
              style={{ 
                width:40, height:40, borderRadius:8, flexShrink:0, 
                border:`2px solid ${sel?C.gold:C.border}`, 
                background:sel?C.gold:C.surfaceEl, 
                color:sel?C.bg:C.textSec, fontSize:15, fontWeight:700, 
                cursor:'pointer', transition:'all .2s', 
                boxShadow:sel?`0 0 10px ${C.gold}55`:'none',
                transform: sel ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              {n}
            </button>
          );
        })}
        <span style={{ fontSize:11, color:C.textMut, minWidth:80, textAlign:'right' }}>{highLabel}</span>
      </div>
    </div>
  );
}

function GPSWidget({ gps }) {
  const precision = gps.coords.precision;
  const precisionWarning = precision && precision > 100;
  const precisionGood = precision && precision <= 30;
  
  return (
    <div style={{ marginBottom:18 }}>
      <FieldLabel>Geolocalización de la encuesta <span style={{ color:C.gold }}>*</span></FieldLabel>
      <div style={{ 
        padding:14, borderRadius:10, 
        border:`1.5px solid ${precisionWarning?C.danger:precisionGood?C.greenLight:C.border}`, 
        background:C.surfaceEl, 
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 
      }}>
        <div>
          {gps.status==='success' ? (
            <>
              <div style={{ color:precisionGood?C.greenAcc:precisionWarning?C.danger:C.gold, fontWeight:700, fontSize:13 }}>
                {precisionGood?'✓ Ubicación precisa':precisionWarning?'⚠ Precisión baja':'✓ Ubicación capturada'}
              </div>
              <div style={{ color:C.textMut, fontSize:11, marginTop:2 }}>
                {gps.coords.lat?.toFixed(5)}, {gps.coords.lng?.toFixed(5)} · ±{Math.round(precision||0)}m
                {precisionWarning && ' (Se recomienda <100m)'}
              </div>
            </>
          ) : gps.status==='loading' ? (
            <div style={{ color:C.gold, fontSize:13 }}>⏳ Obteniendo ubicación…</div>
          ) : gps.status==='error' ? (
            <div style={{ color:C.danger, fontSize:13 }}>✗ No se pudo obtener GPS. Active la ubicación.</div>
          ) : (
            <div style={{ color:C.textMut, fontSize:13 }}>Sin ubicación registrada (obligatoria)</div>
          )}
        </div>
        <button type="button" onClick={gps.capture}
          style={{ 
            padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:600, 
            background:gps.status==='success'?C.greenDark:`${C.gold}22`, 
            border:`1.5px solid ${gps.status==='success'?C.greenLight:C.gold}`, 
            color:gps.status==='success'?C.greenAcc:C.goldLight, cursor:'pointer',
            transition:'all .2s'
          }}>
          {gps.status==='success'?'↻ Actualizar':'📍 Capturar GPS'}
        </button>
      </div>
      {precisionWarning && (
        <div style={{ fontSize:11, color:C.danger, marginTop:6 }}>
          ⚠️ La precisión es mayor a 100m. Para mejores resultados, acérquese a una zona abierta.
        </div>
      )}
    </div>
  );
}

// ─── P1: Componente para foto de evidencia ─────────────────────────────────────
function PhotoEvidenceWidget({ foto, onFotoChange }) {
  const fileInputRef = useRef(null);
  
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Por favor seleccione una imagen válida');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe exceder 5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      onFotoChange({ file, preview: reader.result, name: file.name });
    };
    reader.readAsDataURL(file);
  };
  
  const removeFoto = () => {
    onFotoChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ marginBottom:18 }}>
      <FieldLabel>Foto de evidencia (opcional)</FieldLabel>
      <div style={{ padding:14, borderRadius:10, border:`1.5px dashed ${foto?C.greenLight:C.border}`, background:C.surfaceEl }}>
        {foto ? (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <img src={foto.preview} alt="Evidencia" style={{ width:80, height:80, objectFit:'cover', borderRadius:8 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:C.textPri, fontWeight:600 }}>{foto.name}</div>
                <div style={{ fontSize:11, color:C.greenAcc, marginTop:4 }}>✓ Foto cargada</div>
              </div>
              <button type="button" onClick={removeFoto}
                style={{ padding:'6px 12px', borderRadius:6, fontSize:12, background:C.dangerDim, border:`1px solid ${C.danger}`, color:C.danger, cursor:'pointer' }}>
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📷</div>
            <div style={{ fontSize:13, color:C.textSec, marginBottom:12 }}>
              Adjunte una foto como evidencia de la entrevista
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              style={{ padding:'8px 16px', borderRadius:8, fontSize:13, background:`${C.gold}22`, border:`1.5px solid ${C.gold}`, color:C.goldLight, cursor:'pointer' }}>
              Seleccionar foto
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display:'none' }} />
      </div>
      <div style={{ fontSize:11, color:C.textMut, marginTop:6 }}>
        ℹ️ Máximo 5MB. Esta foto ayuda a validar la calidad del trabajo de campo.
      </div>
    </div>
  );
}

// ─── Modal de recuperación de sesión ───────────────────────────────────────────
function RecoveryModal({ onContinue, onDiscard, timestamp }) {
  const fecha = timestamp ? new Date(timestamp).toLocaleString('es-MX') : '';
  
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000 }}>
      <div style={{ 
        background:C.surface, borderRadius:16, padding:32, maxWidth:420, 
        border:`1px solid ${C.gold}44`,
        animation: 'fadeIn 0.3s ease-out'
      }}>
        <div style={{ fontSize:40, textAlign:'center', marginBottom:16 }}>💾</div>
        <h3 style={{ color:C.goldLight, textAlign:'center', marginBottom:8 }}>¿Continuar encuesta guardada?</h3>
        <p style={{ color:C.textSec, textAlign:'center', fontSize:14, marginBottom:24 }}>
          Se encontró una encuesta en progreso del <strong style={{ color:C.textPri }}>{fecha}</strong>. 
          ¿Desea continuar donde la dejó?
        </p>
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={onDiscard}
            style={{ flex:1, padding:'12px 20px', borderRadius:10, fontSize:14, background:'transparent', border:`1.5px solid ${C.border}`, color:C.textSec, cursor:'pointer' }}>
            Nueva encuesta
          </button>
          <button onClick={onContinue}
            style={{ flex:1, padding:'12px 20px', borderRadius:10, fontSize:14, fontWeight:700, background:`linear-gradient(135deg, ${C.gold}, ${C.goldDim})`, border:'none', color:C.bg, cursor:'pointer' }}>
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Alerta de duplicados ──────────────────────────────────────────────────────
function DuplicateWarning({ count }) {
  return (
    <div style={{ background:`${C.danger}15`, border:`1px solid ${C.danger}`, borderRadius:10, padding:'12px 16px', marginBottom:18 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:20 }}>⚠️</span>
        <div>
          <div style={{ color:C.danger, fontWeight:700, fontSize:13 }}>Posible encuesta duplicada</div>
          <div style={{ color:C.textSec, fontSize:12, marginTop:2 }}>
            Ha registrado {count} encuestas en los últimos 10 minutos. Verifique que cada encuesta sea de una persona diferente.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── STEPS ─────────────────────────────────────────────────────────────────────
// F1 FIX: Agregar props faltantes - secciones, coloniasError, setters, municipioActual
function Step1({ form, update, gps, encuestadorNombre, completed, colonias, coloniasLoading, secciones, coloniasError, setColoniasError, setColoniasLoading, municipioActual }) {
  // Encontrar la colonia seleccionada y su sección asociada
  const coloniaSeleccionada = useMemo(() => 
    colonias.find(c => c.id === form.colonia_id),
  [colonias, form.colonia_id]);

  // v3.0: Usar secciones dinámicas del municipio actual
  const seccionInfo = useMemo(() => 
    coloniaSeleccionada ? secciones.find(s => s.seccion === coloniaSeleccionada.seccion_id) : null,
  [coloniaSeleccionada, secciones]);

  // Manejar cambio de colonia: actualiza colonia_id y seccion_electoral_id
  const handleColoniaChange = (coloniaId) => {
    const colonia = colonias.find(c => c.id === coloniaId);
    update('colonia_id', coloniaId);
    update('seccion_electoral_id', colonia ? colonia.seccion_id : '');
    // Actualizar zona_electoral basado en la sección
    if (colonia) {
      const seccion = secciones.find(s => s.seccion === colonia.seccion_id);
      update('zona_electoral', seccion ? seccion.zona : '');
    }
  };

  // Preparar opciones de colonia para el selector
  const coloniaOptions = useMemo(() => 
    colonias.map(c => ({ 
      value: c.id, 
      label: `${c.nombre} (Secc. ${c.seccion_id})`,
      seccion: c.seccion_id 
    })),
  [colonias]);

  return (
    <div style={{ animation: 'slideIn 0.3s ease-out' }}>
      {encuestadorNombre && (
        <div style={{ display:'flex', alignItems:'center', gap:10, background:C.surfaceEl, borderRadius:8, padding:'10px 14px', border:`1px solid ${C.border}`, marginBottom:22 }}>
          <div style={{ width:30, height:30, borderRadius:'50%', background:`linear-gradient(135deg, ${C.greenDark}, ${C.green})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:C.goldLight, flexShrink:0 }}>
            {encuestadorNombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:12, color:C.textMut, letterSpacing:'.04em', textTransform:'uppercase', fontWeight:600 }}>Encuestador en sesión</div>
            <div style={{ fontSize:13, color:C.textPri, fontWeight:600 }}>{encuestadorNombre}</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:C.greenAcc }} />
            <span style={{ fontSize:11, color:C.greenAcc }}>Activo</span>
          </div>
        </div>
      )}

      <h3 style={{ color:C.goldLight, fontSize:18, margin:'0 0 4px' }}>Perfil del Encuestado</h3>
      <p style={{ color:C.textMut, fontSize:13, marginBottom:24 }}>Datos demográficos y ubicación del ciudadano encuestado.</p>

      {/* ✅ Selector de Colonia (reemplaza Zona + Sección) */}
      <div style={{ marginBottom:16 }}>
        {coloniasLoading ? (
          <div style={{ padding:12, background:C.surfaceEl, borderRadius:8, color:C.textMut }}>
            ⏳ Cargando catálogo de colonias...
          </div>
        ) : coloniasError ? (
          <div style={{ padding:12, background:C.dangerDim, borderRadius:8, color:C.danger, border:`1px solid ${C.danger}` }}>
            <strong>⚠️ Error cargando catálogo</strong>
            <div style={{ fontSize:12, marginTop:4 }}>No se pudieron cargar las colonias. Verifique su conexión.</div>
            {/* F2 FIX: Pasar municipioId al reintentar */}
            <button 
              onClick={() => { 
                setColoniasError(false); 
                setColoniasLoading(true); 
                fetchColonias({ municipioId: municipioActual?.id, forceRefresh: true })
                  .then(() => setColoniasLoading(false))
                  .catch(() => setColoniasError(true)); 
              }}
              style={{ marginTop:8, padding:'4px 12px', borderRadius:4, background:C.danger, color:'#fff', border:'none', cursor:'pointer', fontSize:12 }}
            >
              🔄 Reintentar
            </button>
          </div>
        ) : (
          <div>
            <Select
              label="Colonia donde vive el encuestado" 
              required 
              value={form.colonia_id}
              placeholder={`— Selecciona una colonia (${colonias.length} disponibles) —`}
              options={coloniaOptions}
              onChange={handleColoniaChange}
              completed={completed.includes('colonia')}
            />
            
            {/* Info de Sección calculada (solo lectura) */}
            {coloniaSeleccionada && seccionInfo && (
              <div style={{ 
                marginTop:12, 
                padding:12, 
                background:`${C.greenDark}44`, 
                borderRadius:8, 
                border:`1px solid ${C.greenLight}44` 
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:11, color:C.textMut, marginBottom:2 }}>Sección Electoral Asignada</div>
                    <div style={{ fontSize:16, fontWeight:700, color:C.goldLight }}>
                      Sección {coloniaSeleccionada.seccion_id}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:11, color:C.textMut }}>Zona</div>
                    <div style={{ fontSize:13, color:C.textSec }}>{seccionInfo.zona}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:11, color:C.textMut }}>Tipo</div>
                    <div style={{ fontSize:13, color:C.textSec }}>{seccionInfo.tipo}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <GPSWidget gps={gps} />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <RadioGroup label="Rango de edad" required value={form.edad_rango} onChange={v=>update('edad_rango',v)} options={EDAD_RANGOS} completed={completed.includes('edad')} />
        <RadioGroup label="Género" required value={form.genero} onChange={v=>update('genero',v)}
          options={[{value:'M',label:'Masculino'},{value:'F',label:'Femenino'},{value:'NB',label:'No binario'},{value:'NR',label:'Prefiero no decir'}]}
          completed={completed.includes('genero')} />
      </div>
      <Select label="Escolaridad" required value={form.escolaridad} onChange={v=>update('escolaridad',v)} options={ESCOLARIDAD} placeholder="— Nivel educativo —" completed={completed.includes('escolaridad')} />
      <Select label="Ocupación" required value={form.ocupacion} onChange={v=>update('ocupacion',v)} options={OCUPACION} placeholder="— Ocupación —" completed={completed.includes('ocupacion')} />
    </div>
  );
}

// F4 FIX: Agregar prop municipio
function Step2({ form, update, candidato, completed, municipio }) {
  return (
    <div style={{ animation: 'slideIn 0.3s ease-out' }}>
      <h3 style={{ color:C.goldLight, fontSize:18, margin:'0 0 4px' }}>Reconocimiento del Candidato</h3>
      <p style={{ color:C.textMut, fontSize:13, marginBottom:24 }}>Preguntas sobre el conocimiento del ciudadano hacia el candidato.</p>

      <RadioGroup
        label={`¿Conoce usted a "${candidato}" como candidato a la presidencia municipal de ${municipio || 'su municipio'}?`}
        required value={form.conoce_candidato} onChange={v=>update('conoce_candidato',v)}
        // DATA-3 FIX: Usar 'no_conoce' para coincidir con la vista SQL
options={[{value:'si_bien',label:'Sí, lo conozco bien'},{value:'si_referencia',label:'Lo he escuchado mencionar'},{value:'no_conoce',label:'No lo conozco'}]}
        completed={completed.includes('conocimiento')}
      />

      {/* JSX-C1 FIX: Comentario correctamente envuelto */}
      {form.conoce_candidato && form.conoce_candidato !== 'no_conoce' && (
        <>
          <CheckGroup label="¿Cómo lo conoce? (puede seleccionar varios)" value={form.como_conoce} onChange={v=>update('como_conoce',v)}
            options={['Por familiares o amigos','En redes sociales','En eventos o mítines','Por periódico o radio','Lo vio en campaña / volantes','Lo conoce personalmente','Por WhatsApp']} />
          <RadioGroup label={`¿Cuál es la imagen que tiene de ${candidato}?`} required value={form.imagen_candidato} onChange={v=>update('imagen_candidato',v)}
            options={[{value:'muy_positiva',label:'Muy positiva'},{value:'positiva',label:'Positiva'},{value:'neutral',label:'Neutral'},{value:'negativa',label:'Negativa'},{value:'muy_negativa',label:'Muy negativa'}]}
            completed={completed.includes('imagen')} />
        </>
      )}
    </div>
  );
}

// F4 FIX: Agregar prop municipio
function Step3({ form, update, candidato, completed, municipio }) {
  return (
    <div style={{ animation: 'slideIn 0.3s ease-out' }}>
      <h3 style={{ color:C.goldLight, fontSize:18, margin:'0 0 4px' }}>Posicionamiento Electoral</h3>
      <p style={{ color:C.textMut, fontSize:13, marginBottom:24 }}>Intención de voto y agenda ciudadana.</p>

      <ScaleInput label={`¿Qué tan probable es que vote por ${candidato}? (1 = muy improbable, 5 = muy probable)`}
        required value={form.intencion_voto} onChange={v=>update('intencion_voto',v)} min={1} max={5} lowLabel="Muy improbable" highLabel="Muy probable" 
        completed={completed.includes('intencion')} />
      <ScaleInput label={`¿Qué tanta simpatía le genera ${candidato}? (1 = ninguna, 5 = mucha)`}
        required value={form.simpatia} onChange={v=>update('simpatia',v)} min={1} max={5} lowLabel="Ninguna" highLabel="Mucha" 
        completed={completed.includes('simpatia')} />
      <CheckGroup label={`¿Cuáles son los temas más importantes para usted en ${municipio || 'su municipio'}?`} required value={form.temas_prioritarios}
        onChange={v=>update('temas_prioritarios',v)} options={TEMAS} max={3} 
        completed={completed.includes('temas')} />
      <Select label="¿Cuál sería EL tema más urgente a resolver?" required value={form.tema_principal}
        onChange={v=>update('tema_principal',v)} options={TEMAS} placeholder="— El más urgente —" 
        completed={completed.includes('tema_principal')} />
      <RadioGroup label="¿Cómo evaluaría el desempeño del gobierno municipal actual?" required value={form.evaluacion_gobierno}
        onChange={v=>update('evaluacion_gobierno',v)}
        options={[{value:'muy_bueno',label:'Muy bueno'},{value:'bueno',label:'Bueno'},{value:'regular',label:'Regular'},{value:'malo',label:'Malo'},{value:'muy_malo',label:'Muy malo'}]}
        completed={completed.includes('evaluacion')} />
    </div>
  );
}

function Step4({ form, update, candidato }) {
  return (
    <div style={{ animation: 'slideIn 0.3s ease-out' }}>
      <h3 style={{ color:C.goldLight, fontSize:18, margin:'0 0 4px' }}>Opinión Final</h3>
      <p style={{ color:C.textMut, fontSize:13, marginBottom:24 }}>Últimas preguntas para completar la encuesta.</p>

      <RadioGroup 
        label="¿Votó en la elección municipal anterior (2021)?"
        value={form.participacion_anterior} 
        onChange={v=>update('participacion_anterior',v)}
        options={[{value:'si',label:'Sí voté'},{value:'no',label:'No voté'},{value:'ns',label:'No recuerda/No sabe'}]}
      />
      
      <Select 
        label="¿Se identifica con algún partido político?" 
        value={form.identificacion_partido} 
        onChange={v=>update('identificacion_partido',v)} 
        options={PARTIDOS} 
        placeholder="— Partido o independiente —" 
      />

      <CheckGroup label={`¿Qué propuestas de ${candidato} conoce o le han llamado la atención?`}
        value={form.propuesta_conocida} onChange={v=>update('propuesta_conocida',v)} options={PROPUESTAS} />

      <div style={{ marginBottom:18 }}>
        <FieldLabel>¿Qué le motivaría votar por {candidato}? (en sus propias palabras)</FieldLabel>
        <textarea value={form.motivo_voto} onChange={e=>update('motivo_voto',e.target.value)} rows={3} placeholder="Respuesta abierta…"
          style={{ width:'100%', padding:'10px 14px', background:C.surfaceEl, border:`1.5px solid ${C.border}`, borderRadius:8, color:C.textPri, fontSize:14, resize:'vertical', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
          onFocus={e=>e.target.style.borderColor=C.gold} onBlur={e=>e.target.style.borderColor=C.border} />
      </div>

      <CheckGroup label="¿Por qué medio se informa principalmente sobre política?"
        value={form.medio_informacion} onChange={v=>update('medio_informacion',v)} options={MEDIOS} max={3} />

      <div style={{ marginBottom:18 }}>
        <FieldLabel>Comentario libre o sugerencia para el candidato</FieldLabel>
        <textarea value={form.comentario_libre} onChange={e=>update('comentario_libre',e.target.value)} rows={4} placeholder="Opcional. Cualquier opinión o sugerencia…"
          style={{ width:'100%', padding:'10px 14px', background:C.surfaceEl, border:`1.5px solid ${C.border}`, borderRadius:8, color:C.textPri, fontSize:14, resize:'vertical', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
          onFocus={e=>e.target.style.borderColor=C.gold} onBlur={e=>e.target.style.borderColor=C.border} />
      </div>
      
      {/* F4-BUG-02 FIX: Widget de foto deshabilitado temporalmente
          BUG-C1: El base64 de la foto causaba problemas de rendimiento en BD
          TODO: Implementar Supabase Storage para subir fotos y guardar solo la URL
      <PhotoEvidenceWidget foto={form.foto_evidencia} onFotoChange={v => update('foto_evidencia', v)} />
      */}
      
      <div style={{ marginBottom:18, padding:16, background:C.surfaceEl, borderRadius:10, border:`1px solid ${C.border}66` }}>
        <div style={{ fontSize:13, fontWeight:600, color:C.textSec, marginBottom:12 }}>
          📱 Contacto para seguimiento (opcional)
        </div>
        <Input 
          label="WhatsApp (10 dígitos)" 
          value={form.whatsapp_contacto || ''} 
          onChange={v=>update('whatsapp_contacto', v.replace(/\D/g, '').slice(0, 10))}
          placeholder="55 1234 5678"
          type="tel"
        />
        <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', marginTop:8 }}>
          <input 
            type="checkbox" 
            checked={form.consentimiento_contacto || false}
            onChange={e => update('consentimiento_contacto', e.target.checked)}
            style={{ marginTop:2 }}
          />
          <span style={{ fontSize:12, color:C.textMut }}>
            El ciudadano acepta ser contactado para seguimiento de encuestas futuras. 
            Sus datos serán tratados conforme a la LFPDPPP.
          </span>
        </label>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function FormularioEncuesta({ onSubmit, encuestadorId: propEncId, encuestadorNombre: propEncNombre }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initForm);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [config] = useState(getConfig);
  const [encuestadorId, setEncuestadorId] = useState(propEncId || null);
  const [encuestadorNombre, setEncuestadorNombre] = useState(propEncNombre || '');
  const [modoExperto, setModoExperto] = useState(config.experto);
  // v3.0: Contexto multi-municipio
  const { municipioActual, organizacion } = useOrganizacion();
  
  const [colonias, setColonias] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [coloniasLoading, setColoniasLoading] = useState(true);
  const [coloniasError, setColoniasError] = useState(false);
  const gps = useGPS();
  const startTime = useRef(Date.now());
  
  const { showWarning: showDuplicateWarning, checkDuplicates, recordSubmission } = useDuplicateDetection(encuestadorId);
  const { showRecoveryModal, setShowRecoveryModal, recoverData, clearAutosave } = useAutosave(form, step, encuestadorId);

  function initForm() {
    return {
      colonia_id:'', seccion_electoral_id:'', zona_electoral:'',
      edad_rango:'', genero:'', escolaridad:'', ocupacion:'',
      gps_lat:null, gps_lng:null, gps_precision:null,
      conoce_candidato:'', como_conoce:[], imagen_candidato:'',
      intencion_voto:0, simpatia:0, temas_prioritarios:[], tema_principal:'', evaluacion_gobierno:'',
      propuesta_conocida:[], motivo_voto:'', medio_informacion:[], comentario_libre:'',
      participacion_anterior:'', identificacion_partido:'',
      whatsapp_contacto:'', consentimiento_contacto:false,
      foto_evidencia:null,
    };
  }

  // Resolver encuestador desde Supabase Auth
  useEffect(() => {
    if (propEncId || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setEncuestadorId(session.user.id);
        setEncuestadorNombre(session.user.email?.split('@')[0] || 'Encuestador');
      }
    });
  }, [propEncId]);

  // v3.0: Cargar colonias y secciones según municipio actual
  useEffect(() => {
    if (IS_DEMO) {
      // Datos mock para demo - usar municipio del contexto si existe
      const mockSeccion = municipioActual?.id === 1 ? '0154' : '0001';
      setColonias([
        { id: 'mock-1', nombre: 'Centro Histórico', seccion_id: mockSeccion, tipo: 'COLONIA', municipio_id: municipioActual?.id || 1 },
        { id: 'mock-2', nombre: 'Barrio de Santiago', seccion_id: mockSeccion, tipo: 'BARRIO', municipio_id: municipioActual?.id || 1 },
        { id: 'mock-3', nombre: 'Col. Revolución', seccion_id: mockSeccion, tipo: 'COLONIA', municipio_id: municipioActual?.id || 1 },
      ]);
      setColoniasLoading(false);
      setColoniasError(false); // F3 FIX: Limpiar error en mock
      return;
    }
    
    // v3.0: Requiere municipio seleccionado
    if (!municipioActual?.id) {
      setColonias([]);
      setSecciones([]);
      setColoniasLoading(false);
      setColoniasError(false); // F3 FIX: Limpiar error
      return;
    }
    
    let cancelled = false;
    setColoniasLoading(true);
    setColoniasError(false); // F3 FIX: Limpiar error al iniciar carga
    
    // Cargar colonias filtradas por municipio
    fetchColonias({ municipioId: municipioActual.id })
      .then(data => {
        if (!cancelled) {
          setColonias(data);
          setColoniasLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Error cargando colonias:', err);
          setColoniasError(true);
          setColoniasLoading(false);
        }
      });
    
    // Cargar secciones del municipio desde Supabase
    supabase
      .from('secciones_electorales')
      .select('seccion, nombre_zona, tipo, latitud_centro, longitud_centro')
      .eq('municipio_id', municipioActual.id)
      .eq('activa', true)
      .order('seccion')
      .then(({ data, error }) => {
        if (!cancelled) {
          if (error) {
            // F5 FIX: Manejar error de fetch de secciones
            console.error('Error cargando secciones:', error);
            setSecciones([]);
          } else if (data) {
            setSecciones(data.map(s => ({
              seccion: s.seccion,
              label: s.seccion,
              zona: s.nombre_zona || 'Sin zona',
              tipo: s.tipo || 'Urbana'
            })));
          }
        }
      })
      .catch(err => {
        // F5 FIX: Manejar error de red
        if (!cancelled) {
          console.error('Error de red cargando secciones:', err);
          setSecciones([]);
        }
      });
    
    return () => { cancelled = true; };
  }, [municipioActual?.id]); // Recargar cuando cambia el municipio

  // Online/offline + auto-sync
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const goOn = async () => {
      setIsOnline(true);
      if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
        const { syncOfflineQueue } = await import('@/lib/supabase');
        await syncOfflineQueue();
        setPendingCount(getPendingCount());
      }
    };
    const goOff = () => setIsOnline(false);
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    setPendingCount(getPendingCount());
    window.addEventListener('online', goOn);
    window.addEventListener('offline', goOff);
    return () => { window.removeEventListener('online', goOn); window.removeEventListener('offline', goOff); };
  }, []);

  // Sync GPS → form
  useEffect(() => {
    if (gps.status === 'success') {
      setForm(f => ({ 
        ...f, 
        gps_lat: gps.coords.lat, 
        gps_lng: gps.coords.lng, 
        gps_precision: gps.coords.precision 
      }));
    }
  }, [gps.status, gps.coords.lat, gps.coords.lng, gps.coords.precision]);

  const update = useCallback((key, val) => setForm(f => ({ ...f, [key]:val })), []);

  const handleNext = useCallback(() => {
    const { errors: validationErrors, warnings: validationWarnings, completed: validationCompleted } = validateStep(step, form, gps.status, gps.coords.precision);
    setCompleted(validationCompleted);
    
    if (validationErrors.length) { 
      setErrors(validationErrors); 
      setWarnings(validationWarnings);
      return; 
    }
    setErrors([]);
    setWarnings(validationWarnings);
    setStep(s => s+1);
    setCompleted([]);
    if (typeof window !== 'undefined') window.scrollTo({ top:0, behavior:'smooth' });
  }, [step, form, gps.status, gps.coords.precision]);

  const handleBack = useCallback(() => {
    setErrors([]);
    setStep(s => s-1);
    if (typeof window !== 'undefined') window.scrollTo({ top:0, behavior:'smooth' });
  }, []);

  // ✅ UX: Atajos de teclado
  useKeyboardShortcuts({
    onNext: handleNext,
    onBack: handleBack,
    canNext: step < STEPS.length,
    canBack: step > 1,
    step
  });

  const handleSubmit = useCallback(async () => {
    if (submitting) return; // ✅ FIX: Evitar doble submit
    
    const { errors: validationErrors, warnings: validationWarnings } = validateStep(4, form, gps.status, gps.coords.precision);
    if (validationErrors.length) { 
      setErrors(validationErrors); 
      setWarnings(validationWarnings);
      return; 
    }
    
    const dupCount = checkDuplicates();
    if (dupCount >= 3) {
      if (!confirm(`Ha enviado ${dupCount} encuestas recientemente. ¿Confirmar que estas son de diferentes personas?`)) {
        return;
      }
    }

    // v3.0: Validar que hay municipio y organización seleccionados
    if (!municipioActual?.id || !organizacion?.id) {
      setErrors(['Error: No hay municipio u organización seleccionados. Recarga la página.']);
      return;
    }

    const payload = {
      campana_id: config.campanaId,
      encuestador_id: encuestadorId || null,
      colonia_id: form.colonia_id || null,
      seccion_id: form.seccion_electoral_id || null,
      // v3.0: Agregar contexto multi-tenant
      municipio_id: municipioActual.id,
      organizacion_id: organizacion.id,
      fuente: config.fuente,
      latitud: form.gps_lat, longitud: form.gps_lng, gps_precision: form.gps_precision,
      dispositivo: typeof navigator !== 'undefined' ? navigator.userAgent?.substring(0,100) : 'unknown',
      edad_rango: form.edad_rango, genero: form.genero,
      escolaridad: form.escolaridad ? form.escolaridad.toLowerCase().replace(/ /g, '_') : null,
      ocupacion: form.ocupacion, zona_electoral: form.zona_electoral,
      reconocimiento_asistido: form.conoce_candidato,
      como_conoce: form.como_conoce?.length > 0 ? form.como_conoce : null,
      imagen_percibida: form.imagen_candidato || null,
      intencion_voto: form.intencion_voto || null,
      simpatia: form.simpatia || null,
      problemas_localidad: form.temas_prioritarios?.length > 0 ? form.temas_prioritarios : null,
      tema_principal: form.tema_principal || null,
      evaluacion_gobierno: form.evaluacion_gobierno || null,
      propuestas_conocidas: form.propuesta_conocida?.length > 0 ? form.propuesta_conocida : null,
      motivo_voto: form.motivo_voto || null,
      medio_informacion: form.medio_informacion?.length > 0 ? form.medio_informacion : null,
      comentario_final: form.comentario_libre || null,
      participacion_anterior: form.participacion_anterior || null,
      identificacion_partido: form.identificacion_partido || null,
      whatsapp_contacto: form.whatsapp_contacto || null,
      consentimiento_contacto: form.consentimiento_contacto || false,
      // BUG-C1 FIX TEMPORAL: No guardar base64 en BD hasta implementar Supabase Storage
      // TODO: Subir a Storage y guardar solo la URL pública
      foto_evidencia_url: null,
      duracion_segundos: Math.round((Date.now() - startTime.current) / 1000),
      completada: true,
    };

    setSubmitting(true); setErrors([]);

    if (!isOnline) {
      if (savePendingOffline(payload)) { 
        setPendingCount(getPendingCount()); 
        setSubmitted(true); 
        recordSubmission();
        clearAutosave();
      }
      else setErrors(['No se pudo guardar la encuesta offline.']);
      setSubmitting(false);
      return;
    }

    try {
      if (IS_DEMO) {
        await new Promise(r => setTimeout(r, 800));
      } else if (onSubmit) {
        await onSubmit(payload);
      } else {
        const { error } = await supabase.from('respuestas').insert(payload);
        if (error) throw error;
      }
      recordSubmission();
      clearAutosave();
      setSubmitted(true);
    } catch (err) {
      console.error('Error enviando encuesta:', err);
      if (savePendingOffline(payload)) { 
        setPendingCount(getPendingCount()); 
        setSubmitted(true); 
        recordSubmission();
        clearAutosave();
      }
      else setErrors(['Error al enviar. Se guardará offline al recuperar conexión.']);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, form, gps.status, gps.coords.precision, isOnline, config.campanaId, config.fuente, encuestadorId, onSubmit, checkDuplicates, recordSubmission, clearAutosave, municipioActual?.id, organizacion?.id]);
  
  const handleRecoverSession = useCallback(() => {
    const recovered = recoverData();
    if (recovered?.form && recovered?.step && recovered.step >= 1 && recovered.step <= 4) {
      setForm(recovered.form);
      setStep(recovered.step);
    }
    setShowRecoveryModal(false);
  }, [recoverData]);
  
  const handleDiscardSession = useCallback(() => {
    clearAutosave();
    setShowRecoveryModal(false);
  }, [clearAutosave]);

  if (submitted) {
    return (
      <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
        <div style={{ 
          textAlign:'center', padding:48, background:C.surface, borderRadius:16, 
          border:`1.5px solid ${C.greenLight}`, maxWidth:420,
          animation: 'fadeIn 0.5s ease-out'
        }}>
          <div style={{ fontSize:64, marginBottom:16 }}>{isOnline?'✅':'📱'}</div>
          <h2 style={{ color:C.greenAcc, margin:'0 0 8px' }}>{isOnline?'¡Encuesta enviada!':'¡Guardada sin conexión!'}</h2>
          <p style={{ color:C.textSec, marginBottom:16 }}>
            {isOnline?'Gracias por registrar esta respuesta. El equipo de campaña la procesará en breve.':`Se enviará al recuperar conexión. ${pendingCount} encuesta${pendingCount!==1?'s':''} pendiente${pendingCount!==1?'s':''}.`}
          </p>
          <div style={{ fontSize:11, color:C.textMut, marginBottom:24 }}>Datos tratados conforme a la LFPDPPP</div>
          <button type="button"
            onClick={() => { setForm(initForm()); setStep(1); setSubmitted(false); setErrors([]); setWarnings([]); startTime.current = Date.now(); }}
            style={{ padding:'12px 28px', borderRadius:10, fontSize:15, fontWeight:700, background:C.gold, color:C.bg, border:'none', cursor:'pointer' }}>
            Nueva encuesta
          </button>
          <button type="button"
            onClick={() => router.push('/dashboard')}
            style={{ display:'block', marginTop:10, padding:'10px 28px', borderRadius:10, fontSize:14, fontWeight:600, background:'transparent', color:C.textSec, border:`1px solid ${C.border}`, cursor:'pointer' }}>
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Segoe UI',system-ui,sans-serif", color:C.textPri, paddingTop: 44 }}>
      {/* Animaciones CSS */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      
      {/* ── NAVBAR SIMPLE v3.1 (N6) ── */}
      <NavBar simple={true} campanaNombre={config.candidato} />
      
      {/* ── MINI-HEADER DE ESTADO (N6) ── */}
      <div style={{ 
        background: C.surface, 
        borderBottom: `1px solid ${C.border}`, 
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Indicador de conexión */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6,
            padding: '4px 10px',
            borderRadius: 12,
            background: isOnline ? `${C.greenAcc}15` : `${C.amber}15`,
            border: `1px solid ${isOnline ? C.greenAcc : C.amber}40`,
          }}>
            <div style={{ 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              background: isOnline ? C.greenAcc : C.amber,
              animation: isOnline ? 'none' : 'pulse 2s infinite',
            }} />
            <span style={{ fontSize: 11, color: isOnline ? C.greenAcc : C.amber }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          
          {/* Contador de pendientes */}
          {pendingCount > 0 && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              padding: '4px 10px',
              borderRadius: 12,
              background: `${C.gold}15`,
              border: `1px solid ${C.gold}40`,
            }}>
              <span style={{ fontSize: 11, color: C.gold }}>
                {pendingCount} pendiente{pendingCount!==1?'s':''}
              </span>
            </div>
          )}
        </div>
        
        {/* Progress indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: C.textMut }}>
            Paso {step} / {STEPS.length}
          </span>
          <div style={{ 
            width: 100, 
            height: 4, 
            background: C.border, 
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{ 
              height: '100%', 
              width: `${(step / STEPS.length) * 100}%`, 
              background: C.gold,
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <button
            onClick={() => setModoExperto(!modoExperto)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: `1px solid ${modoExperto ? C.gold : C.border}`,
              background: modoExperto ? `${C.gold}15` : 'transparent',
              color: modoExperto ? C.gold : C.textMut,
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {modoExperto ? '⚡ Modo Experto ON' : 'Modo Normal'}
          </button>
        </div>
      </div>

      {showRecoveryModal && (
        <RecoveryModal 
          onContinue={handleRecoverSession}
          onDiscard={handleDiscardSession}
          timestamp={recoverData()?.timestamp}
        />
      )}

      {submitting && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, flexDirection:'column', gap:16 }}>
          <div style={{ fontSize:40 }}>⏳</div>
          <div style={{ color:C.gold, fontSize:18, fontWeight:700 }}>Enviando encuesta…</div>
          <div style={{ color:C.textSec, fontSize:13 }}>Por favor espere</div>
        </div>
      )}

      {/* Body */}
      <div style={{ maxWidth:680, margin:'0 auto', padding:'32px 20px 80px' }}>
        <ProgressBar step={step} form={form} />

        {showDuplicateWarning && <DuplicateWarning count={3} />}

        {/* ✅ UX: Atajos de teclado info */}
        {modoExperto && (
          <div style={{ 
            background:`${C.greenDark}44`, border:`1px solid ${C.greenLight}44`, 
            borderRadius:8, padding:'8px 12px', marginBottom:16, fontSize:11, color:C.textSec,
            display:'flex', gap:16, flexWrap:'wrap'
          }}>
            <span><kbd style={{ background:C.surfaceEl, padding:'2px 6px', borderRadius:4 }}>Enter</kbd> Siguiente</span>
            <span><kbd style={{ background:C.surfaceEl, padding:'2px 6px', borderRadius:4 }}>Esc</kbd> Atrás</span>
            <span><kbd style={{ background:C.surfaceEl, padding:'2px 6px', borderRadius:4 }}>1-5</kbd> Escala</span>
          </div>
        )}

        {errors.length > 0 && (
          <div style={{ background:C.dangerDim, border:`1px solid ${C.danger}`, borderRadius:10, padding:'12px 16px', marginBottom:24, color:C.danger, fontSize:13 }}>
            <strong>Campos requeridos:</strong> {errors.join(', ')}
          </div>
        )}
        
        {warnings.length > 0 && (
          <div style={{ background:`${C.amber}15`, border:`1px solid ${C.amber}`, borderRadius:10, padding:'12px 16px', marginBottom:24, color:C.amber, fontSize:13 }}>
            <strong>Advertencias:</strong> {warnings.join(', ')}
          </div>
        )}

        {/* v3.0: Warning si no hay municipio seleccionado */}
        {!municipioActual?.id && (
          <div style={{ background:C.dangerDim, border:`1px solid ${C.danger}`, borderRadius:10, padding:'16px', marginBottom:24, color:C.danger, fontSize:14, textAlign:'center' }}>
            <strong>⚠️ No hay municipio seleccionado</strong>
            <div style={{ fontSize:12, marginTop:8, color:C.textSec }}>
              Debes seleccionar un municipio desde el dashboard antes de capturar encuestas.
            </div>
          </div>
        )}

        <div style={{ background:C.surface, borderRadius:16, padding:28, border:`1px solid ${C.border}` }}>
          {step===1 && <Step1 form={form} update={update} gps={gps} encuestadorNombre={encuestadorNombre} completed={completed} colonias={colonias} coloniasLoading={coloniasLoading} secciones={secciones} coloniasError={coloniasError} setColoniasError={setColoniasError} setColoniasLoading={setColoniasLoading} municipioActual={municipioActual} />}
          {step===2 && <Step2 form={form} update={update} candidato={config.candidato} completed={completed} municipio={municipioActual?.nombre || config.municipio} />}
          {step===3 && <Step3 form={form} update={update} candidato={config.candidato} completed={completed} municipio={municipioActual?.nombre || config.municipio} />}
          {step===4 && <Step4 form={form} update={update} candidato={config.candidato} />}
        </div>

        {/* Navegación */}
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:24, gap:12 }}>
          {step > 1 ? (
            <button type="button" onClick={handleBack} 
              style={{ 
                padding:'12px 28px', borderRadius:10, fontSize:14, fontWeight:600, 
                background:'transparent', border:`1.5px solid ${C.border}`, color:C.textSec, 
                cursor:'pointer', transition:'all .2s'
              }}
              onMouseEnter={e => e.target.style.borderColor = C.textSec}
              onMouseLeave={e => e.target.style.borderColor = C.border}
            >
              ← Anterior <span style={{ fontSize:11, color:C.textMut, marginLeft:4 }}>(Esc)</span>
            </button>
          ) : <div />}
          
          {step < STEPS.length ? (
            <button type="button" onClick={handleNext} 
              style={{ 
                padding:'12px 28px', borderRadius:10, fontSize:14, fontWeight:700, 
                background:`linear-gradient(135deg, ${C.gold}, ${C.goldDim})`, 
                border:'none', color:C.bg, cursor:'pointer', 
                boxShadow:`0 4px 16px ${C.gold}44`,
                transition:'all .2s'
              }}
              onMouseEnter={e => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = `0 6px 20px ${C.gold}66`;
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = `0 4px 16px ${C.gold}44`;
              }}
            >
              Siguiente → <span style={{ fontSize:11, opacity:0.8, marginLeft:4 }}>(Enter)</span>
            </button>
          ) : (
            <button type="submit" onClick={handleSubmit} disabled={submitting} 
              style={{ 
                padding:'12px 28px', borderRadius:10, fontSize:14, fontWeight:700, 
                background:submitting?C.greenDark:`linear-gradient(135deg, ${C.green}, ${C.greenDark})`, 
                border:`1.5px solid ${C.greenLight}`, color:C.textPri, 
                cursor:submitting?'not-allowed':'pointer', 
                boxShadow:submitting?'none':`0 4px 16px ${C.green}44`,
                transition:'all .2s'
              }}
              onMouseEnter={e => {
                if (!submitting) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = `0 6px 20px ${C.green}66`;
                }
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = submitting?'none':`0 4px 16px ${C.green}44`;
              }}
            >
              {submitting?'⏳ Enviando…':'✓ Enviar encuesta'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

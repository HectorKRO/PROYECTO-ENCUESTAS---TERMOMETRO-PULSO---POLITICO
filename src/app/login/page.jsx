'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { IS_DEMO } from '@/lib/constants';

export default function LoginPage() {
  const [email,     setEmail]   = useState('');
  const [sent,      setSent]    = useState(false);
  const [loading,   setLoading] = useState(false);
  const [error,     setError]   = useState('');
  const [loginType, setLoginType] = useState('candidato');

  // ✅ FIX: Validación de email
  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    
    // ✅ FIX: Validación previa
    if (!email.trim()) {
      setError('Por favor ingresa tu correo electrónico');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Por favor ingresa un correo válido');
      return;
    }
    
    setLoading(true);
    try {
      if (IS_DEMO) {
        window.location.href = loginType === 'candidato' ? '/dashboard' : '/encuesta?demo=true';
        return;
      }
      
      // ✅ FIX: Verificar que Supabase esté configurado
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError?.message?.includes('not configured')) {
        setError('Error de configuración. Por favor usa el modo demo.');
        return;
      }
      
      const redirectTo = loginType === 'candidato'
        ? `${window.location.origin}/dashboard`
        : `${window.location.origin}/encuesta`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo }
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err.message || 'Error al enviar el enlace. Verifica tu email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight:'100vh', background:C.bg,
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:24, position:'relative', overflow:'hidden',
    }}>
      <div style={{position:'absolute', top:'30%', left:'20%', width:300, height:300, borderRadius:'50%', background:`radial-gradient(circle, ${C.green}20 0%, transparent 70%)`, filter:'blur(60px)', pointerEvents:'none'}}/>
      <div style={{position:'absolute', bottom:'20%', right:'20%', width:200, height:200, borderRadius:'50%', background:`radial-gradient(circle, ${C.gold}12 0%, transparent 70%)`, filter:'blur(60px)', pointerEvents:'none'}}/>

      <div style={{width:'100%', maxWidth:420, position:'relative'}}>
        <div style={{textAlign:'center', marginBottom:40}}>
          <a href="/" style={{ display:'inline-flex', alignItems:'center', gap:10, textDecoration:'none' }}>
            <div style={{ width:40, height:40, borderRadius:10, background:`linear-gradient(135deg, ${C.gold} 0%, ${C.green} 100%)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800, fontFamily:'Syne, sans-serif', color:C.bg }}>P</div>
            <span style={{fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:22, color:C.textPri}}>
              Pulso<span style={{color:C.gold}}>Electoral</span>
            </span>
          </a>
        </div>

        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:'36px 32px' }}>
          {sent ? (
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:48, marginBottom:16}}>📨</div>
              <h2 style={{fontFamily:'Syne, sans-serif', fontWeight:700, color:C.textPri, marginBottom:12}}>Enlace enviado</h2>
              <p style={{color:C.textSec, lineHeight:1.6}}>
                Revisa tu email <strong style={{color:C.gold}}>{email}</strong> y da clic en el enlace para acceder.
              </p>
              <button onClick={() => setSent(false)} style={{ marginTop:24, padding:'10px 24px', borderRadius:8, background:'transparent', border:`1px solid ${C.border}`, color:C.textSec, cursor:'pointer', fontSize:14 }}>
                Cambiar email
              </button>
            </div>
          ) : (
            <>
              <h1 style={{fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:24, color:C.textPri, marginBottom:8}}>Bienvenido</h1>
              <p style={{color:C.textSec, fontSize:14, marginBottom:28}}>Ingresa tu email para recibir un enlace de acceso instantáneo.</p>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:24, background:C.surfaceEl, borderRadius:10, padding:4 }}>
                {[
                  { id:'candidato',   label:'🗳️ Candidato',   desc:'Ver dashboard' },
                  { id:'encuestador', label:'📱 Encuestador', desc:'Capturar datos' },
                ].map(t => (
                  <button key={t.id} onClick={() => setLoginType(t.id)} style={{
                    padding:'10px 8px', borderRadius:8, cursor:'pointer',
                    background: loginType===t.id ? C.surface : 'transparent',
                    border: loginType===t.id ? `1px solid ${C.border}` : '1px solid transparent',
                    color: loginType===t.id ? C.textPri : C.textMut,
                    fontFamily:'DM Sans, sans-serif', fontWeight:600, fontSize:13, transition:'all .2s',
                    boxShadow: loginType===t.id ? '0 2px 8px rgba(0,0,0,.3)' : 'none',
                  }}>
                    <div>{t.label}</div>
                    <div style={{fontSize:11, fontWeight:400, marginTop:2, color: loginType===t.id ? C.textSec : C.textMut}}>{t.desc}</div>
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit}>
                <label style={{display:'block', marginBottom:6, fontSize:13, color:C.textSec, fontWeight:500}}>Correo electrónico</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="tu@email.com"
                  style={{ width:'100%', padding:'12px 16px', borderRadius:8, background:C.surfaceEl, border:`1px solid ${C.border}`, color:C.textPri, fontSize:15, outline:'none', fontFamily:'DM Sans, sans-serif', transition:'border-color .2s' }}
                />
                {error && <p style={{color:C.danger, fontSize:13, marginTop:8}}>{error}</p>}
                <button type="submit" disabled={loading} style={{
                  marginTop:16, width:'100%', padding:'14px', borderRadius:8, cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? C.surfaceEl : `linear-gradient(135deg, ${C.gold} 0%, #a07d1a 100%)`,
                  border:'none', color: loading ? C.textMut : C.bg, fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:16,
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(201,162,39,.3)', transition:'all .2s',
                }}>
                  {loading ? 'Enviando...' : `Acceder como ${loginType} →`}
                </button>
              </form>

              <div style={{ marginTop:20, paddingTop:20, borderTop:`1px solid ${C.border}`, textAlign:'center' }}>
                <p style={{fontSize:12, color:C.textMut, marginBottom:8}}>¿Solo quieres ver la demo?</p>
                <div style={{display:'flex', gap:8, justifyContent:'center'}}>
                  <a href="/dashboard?demo" style={{ padding:'6px 14px', borderRadius:6, fontSize:12, background:C.surfaceEl, border:`1px solid ${C.border}`, color:C.textSec, textDecoration:'none' }}>Dashboard demo</a>
                  <a href="/encuesta?demo=true" style={{ padding:'6px 14px', borderRadius:6, fontSize:12, background:C.surfaceEl, border:`1px solid ${C.border}`, color:C.textSec, textDecoration:'none' }}>Formulario demo</a>
                </div>
              </div>
            </>
          )}
        </div>

        <p style={{textAlign:'center', marginTop:24, fontSize:12, color:C.textMut}}>
          No se requiere contraseña · Acceso por enlace seguro de un solo uso
        </p>
      </div>
    </div>
  );
}

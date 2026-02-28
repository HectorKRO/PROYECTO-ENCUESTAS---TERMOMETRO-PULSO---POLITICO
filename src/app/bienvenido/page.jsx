'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/theme';

export default function BienvenidoPage() {
  const router = useRouter();
  const checkedRef = useRef(false);
  const [estado, setEstado] = useState('verificando');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace('/login');
        return;
      }

      const name =
        session.user.user_metadata?.full_name?.trim() ||
        session.user.email?.split('@')[0] ||
        'Usuario';

      setUserName(name);
      setEstado('bienvenido');

      setTimeout(() => {
        setEstado('redirigiendo');
        const rol = localStorage.getItem('rol_seleccionado');
        switch (rol) {
          case 'encuestador': router.replace('/encuesta');  break;
          case 'analista':    router.replace('/dashboard'); break;
          case 'admin':
          case 'superadmin':  router.replace('/admin');     break;
          default:            router.replace('/dashboard');
        }
      }, 2500);
    };

    init();
  }, [router]);

  if (estado === 'verificando') {
    return (
      <div style={{
        minHeight: '100vh', background: C.bg,
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: 16
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid ' + C.border,
          borderTopColor: C.gold,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: C.textSec, fontSize: 14, margin: 0 }}>Verificando sesión...</p>
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: C.surface,
        border: '1px solid ' + C.gold + '40',
        borderRadius: 24,
        padding: '48px 64px',
        textAlign: 'center',
        boxShadow: '0 0 60px ' + C.gold + '20',
        opacity: estado === 'redirigiendo' ? 0 : 1,
        transform: estado === 'redirigiendo' ? 'translateY(-20px) scale(0.95)' : 'translateY(0) scale(1)',
        transition: 'opacity 0.5s ease-out, transform 0.5s ease-out'
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, ' + C.gold + '30, ' + C.gold + '10)',
          border: '2px solid ' + C.gold,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: 28, fontWeight: 'bold', color: C.gold
        }}>
          {userName.slice(0, 2).toUpperCase() || 'U'}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 600, color: C.textPri, margin: '0 0 8px 0' }}>
          Bienvenido, {userName}
        </h1>
        <p style={{ color: C.textSec, fontSize: 14, margin: '0 0 24px 0' }}>PulsoElectoral</p>

        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8,
          color: C.textMut, fontSize: 13
        }}>
          <span style={{
            width: 16, height: 16,
            border: '2px solid ' + C.border,
            borderTopColor: C.gold,
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 1s linear infinite'
          }} />
          Redirigiendo...
        </div>
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

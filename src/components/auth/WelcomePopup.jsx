'use client';

import { useEffect, useState, useRef } from 'react';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/theme';

export function WelcomePopup() {
  const { user, organizacion, municipioActual, rol, isInitialized } = useOrganizacion();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  
  // U6: Usar refs para timers que no deben reiniciarse
  const timersStartedRef = useRef(false);
  const fadeTimerRef = useRef(null);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    if (!isInitialized || timersStartedRef.current) return;
    
    if (!user || !organizacion) {
      router.push('/login');
      return;
    }

    // U6: Marcar que los timers ya empezaron para no reiniciarlos
    timersStartedRef.current = true;
    setVisible(true);
    
    fadeTimerRef.current = setTimeout(() => {
      setFading(true);
    }, 3000);

    redirectTimerRef.current = setTimeout(() => {
      const rolGuardado = localStorage.getItem('rol_seleccionado') || rol;
      
      switch(rolGuardado) {
        case 'encuestador':
          router.push('/encuesta');
          break;
        case 'analista':
          router.push('/dashboard');
          break;
        case 'admin':
        case 'superadmin':
          router.push('/admin');
          break;
        default:
          router.push('/dashboard');
      }
    }, 3500);

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
    // U6: Solo dependemos de isInitialized y user para iniciar
    // No incluimos organizacion ni rol para evitar reinicios
  }, [isInitialized, user?.id, router]);

  if (!visible || !user || !organizacion) return null;

  // U11: Mejor manejo de fallback para el nombre
  const getInitials = () => {
    const name = user.user_metadata?.full_name?.trim() || user.email?.trim() || '';
    if (!name) return 'U';
    return name.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const getNombre = () => {
    const fullName = user.user_metadata?.full_name?.trim();
    if (fullName) return fullName;
    const email = user.email?.trim();
    if (email) return email.split('@')[0];
    return 'Usuario';
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(7, 16, 10, 0.95)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.5s ease-out',
      pointerEvents: 'none'
    }}>
      <div style={{
        background: 'rgba(15, 29, 18, 0.98)',
        border: `1px solid ${C.gold}40`,
        borderRadius: 24,
        padding: '48px 64px',
        textAlign: 'center',
        boxShadow: `0 0 60px ${C.gold}20`,
        transform: fading ? 'translateY(-20px) scale(0.95)' : 'translateY(0) scale(1)',
        transition: 'transform 0.5s ease-out'
      }}>
        {/* Avatar con iniciales */}
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.gold}30, ${C.gold}10)`,
          border: `2px solid ${C.gold}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: 28,
          fontWeight: 'bold',
          color: C.gold
        }}>
          {getInitials()}
        </div>

        {/* Saludo */}
        <h1 style={{
          fontSize: 28,
          fontWeight: 600,
          color: C.textPri,
          margin: '0 0 8px 0'
        }}>
          Bienvenido, {getNombre()}
        </h1>

        {/* Info de contexto */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 24,
          padding: '16px 24px',
          background: 'rgba(201, 162, 39, 0.08)',
          borderRadius: 12,
          border: `1px solid ${C.gold}20`
        }}>
          <div style={{ color: C.gold, fontSize: 14, fontWeight: 500 }}>
            {organizacion.nombre}
          </div>
          <div style={{ color: C.textSec, fontSize: 13 }}>
            Municipio: {municipioActual?.nombre || 'No seleccionado'}
          </div>
          <div style={{ color: C.textMut, fontSize: 12, textTransform: 'uppercase' }}>
            Rol: {rol}
          </div>
        </div>

        {/* Indicador de carga */}
        <div style={{
          marginTop: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: C.textMut,
          fontSize: 13
        }}>
          <span className="welcome-spinner" />
          Redirigiendo...
        </div>
      </div>

      {/* U5: Keyframes definidos via styled-jsx para evitar duplicación */}
      <style jsx>{`
        .welcome-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid ${C.border};
          border-top-color: ${C.gold};
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

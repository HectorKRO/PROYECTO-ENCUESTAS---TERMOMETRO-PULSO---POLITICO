'use client';

import { WelcomePopup } from '@/components/auth/WelcomePopup';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { C } from '@/lib/theme';

export default function BienvenidoPage() {
  const { isInitialized, user } = useOrganizacion();
  
  // U5: Mostrar spinner solo mientras no estamos inicializados o no hay usuario
  const showSpinner = !isInitialized || !user;

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <WelcomePopup />
      
      {/* U5: Spinner condicional */}
      {showSpinner && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16
        }}>
          <div className="loading-spinner" style={{
            width: 40,
            height: 40,
            border: `3px solid ${C.border}`,
            borderTopColor: C.gold,
            borderRadius: '50%'
          }} />
          <p style={{ color: C.textSec, fontSize: 14 }}>
            Cargando...
          </p>
        </div>
      )}
      
      <style jsx>{`
        .loading-spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

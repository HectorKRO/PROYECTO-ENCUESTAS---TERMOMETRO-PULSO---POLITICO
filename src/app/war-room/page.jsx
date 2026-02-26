import WarRoom from '@/components/WarRoom';
import { Suspense } from 'react';

export const metadata = {
  title: 'War Room · Mapa Electoral · PulsoElectoral',
  description: 'Análisis territorial con mapa de calor por sección electoral y colonia.',
};

function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#07100a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: '3px solid #264030',
        borderTopColor: '#c9a227',
        animation: 'spin 1s linear infinite',
      }} />
      <span style={{ color: '#8dab94', fontFamily: 'DM Sans, sans-serif', fontSize: 15 }}>
        Cargando War Room...
      </span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function WarRoomPage({ searchParams }) {
  // Obtener campana_id de URL params
  const campanaId = searchParams?.campana || null;
  const campanaId2 = searchParams?.campana2 || null; // Para modo comparación

  return (
    <Suspense fallback={<Loading />}>
      <WarRoom campanaId={campanaId} campanaId2={campanaId2} />
    </Suspense>
  );
}

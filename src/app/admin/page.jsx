'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminPanel from '@/components/AdminPanel';
import CampanasList from '@/components/CampanasList';
import { C } from '@/lib/theme';

function AdminContent() {
  const searchParams = useSearchParams();
  const campanaId = searchParams.get('campana');

  // NavBar ya se renderiza globalmente desde NavBarWrapper en layout.jsx
  if (!campanaId) {
    return <CampanasList />;
  }

  return <AdminPanel campanaId={campanaId} />;
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.textMut }}>Cargando...</div>
      </div>
    }>
      <AdminContent />
    </Suspense>
  );
}

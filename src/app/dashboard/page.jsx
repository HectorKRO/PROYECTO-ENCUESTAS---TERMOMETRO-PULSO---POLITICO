'use client';

import DashboardPolitico from '@/components/DashboardPolitico';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Loading() {
  return (
    <div style={{
      minHeight:'100vh', background:'#07100a',
      display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:16,
    }}>
      <div style={{
        width:48, height:48, borderRadius:'50%',
        border:'3px solid #264030', borderTopColor:'#c9a227',
        animation:'spin 1s linear infinite',
      }}/>
      <span style={{color:'#8dab94', fontFamily:'DM Sans, sans-serif', fontSize:15}}>
        Cargando dashboard…
      </span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function DashboardWithNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campanaId = searchParams?.get('campana');
  
  const handleNavigateToMapa = () => {
    const url = campanaId 
      ? `/war-room?campana=${campanaId}`
      : '/war-room';
    router.push(url);
  };
  
  return <DashboardPolitico onNavigateToMapa={handleNavigateToMapa} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardWithNavigation />
    </Suspense>
  );
}

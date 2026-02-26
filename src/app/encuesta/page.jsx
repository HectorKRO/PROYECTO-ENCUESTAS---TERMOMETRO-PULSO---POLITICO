import FormularioEncuesta from '@/components/FormularioEncuesta';
import { Suspense } from 'react';

export const metadata = {
  title: 'Encuesta Electoral · PulsoElectoral',
  description: 'Formulario de captura de encuesta política en campo.',
};

function Loading() {
  return (
    <div style={{
      minHeight:'100vh', background:'#07100a',
      display:'flex', alignItems:'center', justifyContent:'center',
      color:'#c9a227', fontFamily:'Syne, sans-serif', fontSize:18,
    }}>
      Cargando…
    </div>
  );
}

export default function EncuestaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <FormularioEncuesta />
    </Suspense>
  );
}

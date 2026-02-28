import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { C } from '@/lib/theme';

function LoginContainer() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `
        radial-gradient(ellipse at top, rgba(201, 162, 39, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at bottom, rgba(45, 122, 58, 0.1) 0%, transparent 50%),
        ${C.bg}
      `,
      padding: '20px'
    }}>
      <LoginForm />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold }}>
        Cargando…
      </div>
    }>
      <LoginContainer />
    </Suspense>
  );
}

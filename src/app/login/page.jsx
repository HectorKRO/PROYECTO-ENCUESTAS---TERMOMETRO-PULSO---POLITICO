'use client';

import { LoginForm } from '@/components/auth/LoginForm';
import { C } from '@/lib/theme';

export default function LoginPage() {
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

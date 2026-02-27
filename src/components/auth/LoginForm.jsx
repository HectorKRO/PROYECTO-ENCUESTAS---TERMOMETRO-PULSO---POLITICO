'use client';

import { useState } from 'react';
import { C } from '@/lib/theme';
import { RoleSelector } from './RoleSelector';
import { useAuthFlow } from '@/hooks/useAuthFlow';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState(null);
  const { login, loading, error } = useAuthFlow();

  const handleSubmit = async (e) => {
    e.preventDefault();
    // U10: El check de !rol es redundante porque el botón ya tiene disabled,
    // pero lo mantenemos por claridad y seguridad
    if (!rol) return;
    await login(email, password, rol);
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: 420,
      margin: '0 auto',
      padding: '40px 32px',
      background: 'rgba(10, 21, 16, 0.8)',
      backdropFilter: 'blur(20px)',
      borderRadius: 24,
      border: `1px solid ${C.border}`,
      boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🗳️</div>
        <h1 style={{
          fontSize: 24,
          fontWeight: 600,
          color: C.textPri,
          margin: '0 0 8px 0'
        }}>
          PulsoElectoral
        </h1>
        <p style={{ color: C.textSec, fontSize: 14, margin: 0 }}>
          Acceso a la plataforma
        </p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ display: 'block', color: C.textSec, fontSize: 13, marginBottom: 6 }}>
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'rgba(7, 16, 10, 0.6)',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              color: C.textPri,
              fontSize: 15,
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = C.gold}
            onBlur={(e) => e.target.style.borderColor = C.border}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: C.textSec, fontSize: 13, marginBottom: 6 }}>
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'rgba(7, 16, 10, 0.6)',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              color: C.textPri,
              fontSize: 15,
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = C.gold}
            onBlur={(e) => e.target.style.borderColor = C.border}
          />
        </div>

        {/* Selector de rol */}
        <RoleSelector selected={rol} onSelect={setRol} />

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(224, 82, 82, 0.1)',
            border: `1px solid ${C.danger}40`,
            borderRadius: 8,
            color: C.danger,
            fontSize: 13
          }}>
            {error}
          </div>
        )}

        {/* Botón */}
        <button
          type="submit"
          disabled={!rol || loading}
          style={{
            width: '100%',
            padding: '16px 24px',
            background: !rol ? C.border : `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
            border: 'none',
            borderRadius: 12,
            color: !rol ? C.textMut : C.bg,
            fontSize: 16,
            fontWeight: 600,
            cursor: !rol ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            marginTop: 8
          }}
        >
          {loading ? 'Accediendo...' : rol ? '⚡ Acceder' : 'Selecciona un rol'}
        </button>
      </form>

      {/* Footer */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <p style={{ color: C.textMut, fontSize: 12 }}>
          ¿No tienes acceso?{' '}
          <a href="mailto:soporte@pulsoelectoral.com" style={{ color: C.gold, textDecoration: 'none' }}>
            Contacta al administrador
          </a>
        </p>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/theme';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `
        radial-gradient(ellipse at top, rgba(201, 162, 39, 0.08) 0%, transparent 50%),
        ${C.bg}
      `,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        padding: '40px 32px',
        background: 'rgba(10, 21, 16, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: 24,
        border: `1px solid ${C.border}`,
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56,
            background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 18, fontWeight: 700, color: C.bg,
          }}>
            PE
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: C.textPri, margin: '0 0 8px' }}>
            Nueva contraseña
          </h1>
          <p style={{ color: C.textSec, fontSize: 14, margin: 0 }}>
            Elige una contraseña segura para tu cuenta
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', color: C.greenAcc, fontSize: 15, lineHeight: 1.6 }}>
            Contraseña actualizada correctamente.<br />
            <span style={{ color: C.textSec, fontSize: 13 }}>Redirigiendo al dashboard…</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', color: C.textSec, fontSize: 13, marginBottom: 6 }}>
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                style={{
                  width: '100%', padding: '14px 16px',
                  background: 'rgba(7, 16, 10, 0.6)',
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  color: C.textPri, fontSize: 15, outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = C.gold}
                onBlur={(e) => e.target.style.borderColor = C.border}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: C.textSec, fontSize: 13, marginBottom: 6 }}>
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                required
                style={{
                  width: '100%', padding: '14px 16px',
                  background: 'rgba(7, 16, 10, 0.6)',
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  color: C.textPri, fontSize: 15, outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = C.gold}
                onBlur={(e) => e.target.style.borderColor = C.border}
              />
            </div>

            {error && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(224, 82, 82, 0.1)',
                border: `1px solid ${C.danger}40`,
                borderRadius: 8, color: C.danger, fontSize: 13
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '16px 24px',
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                border: 'none', borderRadius: 12,
                color: C.bg, fontSize: 16, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 8
              }}
            >
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { C, NAV_HEIGHT } from '@/lib/theme';

export default function PerfilPage() {
  const router = useRouter();
  const { user, signOut } = useOrganizacion();
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    // El usuario ya viene del contexto, solo verificamos que exista
    if (user === null && !loading) {
      router.push('/login');
    } else {
      setLoading(false);
    }
  }, [user, loading, router]);

  async function handleChangePassword(e) {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    
    // Validaciones
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Contraseña actualizada exitosamente' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Error al cambiar la contraseña' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: `calc(100vh - ${NAV_HEIGHT}px)`, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.textSec }}>Cargando...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: `calc(100vh - ${NAV_HEIGHT}px)`, background: C.bg, padding: '24px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Header - Sin botones redundantes (NavBar global los proporciona) */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 28, color: C.textPri, marginBottom: 4 }}>
            Mi Perfil
          </h1>
          <p style={{ color: C.textSec, fontSize: 14 }}>Gestiona tu cuenta y seguridad</p>
        </div>

        {/* Info del usuario */}
        <div style={{ 
          background: C.surface, 
          border: `1px solid ${C.border}`, 
          borderRadius: 16, 
          padding: 24,
          marginBottom: 24
        }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 18, color: C.textPri, marginBottom: 16 }}>
            Información de la cuenta
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: C.textMut, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</label>
              <p style={{ color: C.textPri, fontSize: 16, marginTop: 4 }}>{user?.email}</p>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.textMut, textTransform: 'uppercase', letterSpacing: 0.5 }}>ID de usuario</label>
              <p style={{ color: C.textSec, fontSize: 14, marginTop: 4, fontFamily: 'monospace' }}>{user?.id}</p>
            </div>
          </div>
        </div>

        {/* Cambiar contraseña */}
        <div style={{ 
          background: C.surface, 
          border: `1px solid ${C.border}`, 
          borderRadius: 16, 
          padding: 24,
          marginBottom: 24
        }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 18, color: C.textPri, marginBottom: 16 }}>
            🔐 Cambiar contraseña
          </h2>
          
          {message.text && (
            <div style={{ 
              marginBottom: 16, 
              padding: 12, 
              borderRadius: 8, 
              background: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              border: `1px solid ${message.type === 'error' ? C.danger : C.green}`
            }}>
              <p style={{ color: message.type === 'error' ? C.danger : C.green, fontSize: 14, margin: 0 }}>
                {message.text}
              </p>
            </div>
          )}
          
          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: C.textSec, fontWeight: 500 }}>
                Nueva contraseña
              </label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                required 
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  borderRadius: 8, 
                  background: C.surfaceEl, 
                  border: `1px solid ${C.border}`, 
                  color: C.textPri, 
                  fontSize: 15, 
                  outline: 'none'
                }}
              />
            </div>
            
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: C.textSec, fontWeight: 500 }}>
                Confirmar nueva contraseña
              </label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
                minLength={6}
                placeholder="Repite la contraseña"
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  borderRadius: 8, 
                  background: C.surfaceEl, 
                  border: `1px solid ${C.border}`, 
                  color: C.textPri, 
                  fontSize: 15, 
                  outline: 'none'
                }}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={saving}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 8,
                cursor: saving ? 'not-allowed' : 'pointer',
                background: saving ? C.surfaceEl : C.gold,
                border: 'none',
                color: C.bg,
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: 15
              }}
            >
              {saving ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </form>
        </div>

        {/* 
          NOTA: El botón "Cerrar sesión" se eliminó porque el NavBar global 
          (v3.1) ya proporciona esa funcionalidad en la barra superior.
        */}
      </div>
    </div>
  );
}

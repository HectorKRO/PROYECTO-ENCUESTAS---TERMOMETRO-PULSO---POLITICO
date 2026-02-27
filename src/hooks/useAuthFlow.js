'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export function useAuthFlow() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (email, password, rol) => {
    try {
      setLoading(true);
      setError(null);

      // U8: Trimear email antes de enviar
      const cleanEmail = email.trim();
      
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (authError) throw authError;

      localStorage.setItem('rol_seleccionado', rol);
      router.push('/bienvenido');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('rol_seleccionado');
    localStorage.removeItem('municipio_actual_id');
    router.push('/login');
  }, [router]);

  return {
    login,
    logout,
    loading,
    error
  };
}

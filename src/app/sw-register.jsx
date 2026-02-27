'use client';
import { useEffect } from 'react';
import { syncOfflineQueue, getPendingCount } from '@/lib/supabase';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((reg) => console.log('[SW] Registered:', reg.scope))
        .catch((err) => console.warn('[SW] Registration failed:', err));
    }

    // ✅ FIX C2: Sincronizar encuestas offline automáticamente al recuperar conexión
    const handleOnline = async () => {
      const pending = getPendingCount();
      if (pending === 0) return;
      console.log(`[Sync] Conexión recuperada. Sincronizando ${pending} encuesta(s) pendiente(s)…`);
      try {
        const result = await syncOfflineQueue();
        if (result.synced > 0) {
          console.log(`[Sync] ✓ ${result.synced} encuesta(s) sincronizada(s)`);
        }
        if (result.failed > 0) {
          console.warn(`[Sync] ⚠ ${result.failed} encuesta(s) no pudieron sincronizarse`);
        }
      } catch (err) {
        console.error('[Sync] Error en sincronización automática:', err);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return null;
}

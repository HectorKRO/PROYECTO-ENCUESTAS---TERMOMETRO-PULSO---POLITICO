import { useState, useEffect } from 'react';

/**
 * Detecta si el viewport es mobile (< 640px).
 * Empieza en false (SSR-safe) y actualiza en el cliente.
 */
export function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);

  return isMobile;
}

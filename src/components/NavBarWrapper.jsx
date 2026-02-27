'use client';
/**
 * NavBarWrapper.jsx — Wrapper condicional para NavBar
 * 
 * No muestra NavBar en páginas públicas: /, /login, /bienvenido, /encuesta
 */

import { usePathname } from 'next/navigation';
import NavBar from './NavBar';

// Rutas donde NO se muestra el NavBar
const HIDDEN_PATHS = ['/', '/login', '/bienvenido', '/encuesta'];

export function NavBarWrapper() {
  const pathname = usePathname();
  
  // No mostrar en páginas públicas
  if (HIDDEN_PATHS.includes(pathname)) {
    return null;
  }
  
  // No mostrar en subrutas de encuesta
  if (pathname.startsWith('/encuesta/')) {
    return null;
  }
  
  return <NavBar />;
}

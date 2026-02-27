'use client';
/**
 * NavBar.jsx — Barra de navegación global v3.1
 * 
 * Características:
 *   - Sticky con 3 zonas: logo | links | usuario
 *   - Sección activa marcada con subrayado dorado
 *   - Avatar con iniciales del usuario
 *   - Admin solo visible para roles admin/superadmin
 *   - Mobile: menú hamburguesa
 *   - Logout integrado con Supabase
 */

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { C, NAV_HEIGHT } from '@/lib/theme';
import { useOrganizacion } from '@/hooks/useOrganizacion';

const LINKS = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', public: true },
  { key: 'war-room', label: 'War Room', path: '/war-room', public: true },
  { key: 'admin', label: 'Admin', path: '/admin', adminOnly: true },
];

export default function NavBar({ simple = false, campanaNombre = null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, rol: userRole, signOut, esAdmin } = useOrganizacion();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Evitar hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await signOut();
  };

  const getInitials = (email) => {
    if (!email) return '?';
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const isActive = (path) => pathname.startsWith(path);

  if (!mounted) {
    return <div style={{ height: NAV_HEIGHT, background: C.surface }} />;
  }

  // Versión simplificada (para formulario de encuesta)
  if (simple) {
    return (
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 2000,  // Mayor que paneles flotantes (1000)
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: '12px 20px',
        height: NAV_HEIGHT,
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 'bold', color: C.bg,
          }}>
            PE
          </div>
          <span style={{ color: C.textPri, fontSize: 14, fontWeight: 600 }}>
            PulsoElectoral
          </span>
          {campanaNombre && (
            <span style={{ color: C.textMut, fontSize: 12 }}>
              · {campanaNombre}
            </span>
          )}
        </div>
        
        <button
          onClick={handleLogout}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: 'transparent',
            color: C.textSec,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Salir
        </button>
      </nav>
    );
  }

  // Filtrar links según rol
  const visibleLinks = LINKS.filter(link => {
    if (link.adminOnly) {
      return esAdmin;
    }
    return true;
  });

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 2000,  // Mayor que paneles flotantes del WarRoom (1000)
      background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      height: NAV_HEIGHT,
      boxSizing: 'border-box',
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 'bold', color: C.bg,
          }}>
            PE
          </div>
          <span style={{ 
            color: C.textPri, 
            fontSize: 16, 
            fontWeight: 700,
            fontFamily: "'Syne', sans-serif",
            letterSpacing: '-0.02em',
          }}>
            PulsoElectoral
          </span>
        </div>

        {/* Links - Desktop */}
        <div style={{ 
          display: 'flex', 
          gap: 8,
          '@media (max-width: 768px)': { display: 'none' }
        }} className="desktop-links">
          {visibleLinks.map(link => (
            <button
              key={link.key}
              onClick={() => router.push(link.path)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: isActive(link.path) ? `rgba(201, 162, 39, 0.1)` : 'transparent',
                color: isActive(link.path) ? C.gold : C.textSec,
                fontSize: 14,
                fontWeight: isActive(link.path) ? 600 : 400,
                cursor: 'pointer',
                position: 'relative',
                fontFamily: "inherit",
              }}
            >
              {link.label}
              {isActive(link.path) && (
                <span style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 12,
                  right: 12,
                  height: 2,
                  background: C.gold,
                  borderRadius: 1,
                }} />
              )}
            </button>
          ))}
        </div>

        {/* Usuario + Logout - Desktop */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12,
          '@media (max-width: 768px)': { display: 'none' }
        }} className="desktop-user">
          {user && (
            <>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 'bold', color: C.textPri,
                border: `2px solid ${C.border}`,
              }}>
                {getInitials(user.email)}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.textSec,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: "inherit",
                }}
              >
                Salir ↗
              </button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'none',
            padding: 8,
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: 'transparent',
            color: C.textSec,
            cursor: 'pointer',
            '@media (max-width: 768px)': { display: 'block' }
          }}
          className="mobile-menu-btn"
        >
          ☰
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: '12px 24px',
          background: C.bg,
        }} className="mobile-menu">
          {visibleLinks.map(link => (
            <button
              key={link.key}
              onClick={() => {
                router.push(link.path);
                setMobileMenuOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 0',
                border: 'none',
                borderBottom: `1px solid ${C.border}`,
                background: 'transparent',
                color: isActive(link.path) ? C.gold : C.textSec,
                fontSize: 14,
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: "inherit",
              }}
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={handleLogout}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 0',
              border: 'none',
              background: 'transparent',
              color: C.danger,
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              marginTop: 8,
              fontFamily: "inherit",
            }}
          >
            Cerrar sesión ↗
          </button>
        </div>
      )}

      {/* CSS for responsive */}
      <style jsx>{`
        @media (max-width: 768px) {
          .desktop-links,
          .desktop-user {
            display: none !important;
          }
          .mobile-menu-btn {
            display: block !important;
          }
          .mobile-menu {
            display: block !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-menu-btn,
          .mobile-menu {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
}

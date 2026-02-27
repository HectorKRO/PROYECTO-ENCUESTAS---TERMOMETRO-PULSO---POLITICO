'use client';

import Link from 'next/link';
import { C } from '@/lib/theme';

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.textPri
    }}>
      {/* Hero Section */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(201, 162, 39, 0.12), transparent),
          radial-gradient(ellipse 60% 40% at 50% 120%, rgba(45, 122, 58, 0.08), transparent),
          ${C.bg}
        `,
        textAlign: 'center'
      }}>
        {/* Logo */}
        <div style={{ fontSize: 64, marginBottom: 24 }}>🗳️</div>
        
        {/* Título */}
        <h1 style={{
          fontSize: 'clamp(36px, 8vw, 64px)',
          fontWeight: 700,
          margin: '0 0 16px 0',
          background: `linear-gradient(135deg, ${C.textPri} 0%, ${C.gold} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          PulsoElectoral
        </h1>
        
        {/* Subtítulo */}
        <p style={{
          fontSize: 'clamp(18px, 3vw, 24px)',
          color: C.textSec,
          maxWidth: 600,
          margin: '0 0 40px 0',
          lineHeight: 1.6
        }}>
          Plataforma de inteligencia electoral multi-municipio. 
          Conoce el pulso de tu campaña en tiempo real.
        </p>

        {/* CTA Principal */}
        <Link
          href="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '20px 40px',
            background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
            color: C.bg,
            fontSize: 18,
            fontWeight: 600,
            borderRadius: 14,
            textDecoration: 'none',
            transition: 'all 0.3s ease',
            boxShadow: `0 8px 32px ${C.gold}30`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 12px 40px ${C.gold}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 8px 32px ${C.gold}30`;
          }}
        >
          <span>⚡</span>
          Comenzar Ahora
        </Link>

        {/* Características */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 24,
          maxWidth: 800,
          width: '100%',
          marginTop: 80,
          padding: '0 20px'
        }}>
          {[
            { icon: '📊', title: 'Análisis Real-Time', desc: 'Dashboard en vivo' },
            { icon: '🗺️', title: 'Mapas de Calor', desc: 'Por sección electoral' },
            { icon: '📱', title: 'Modo Offline', desc: 'Sincronización automática' },
            { icon: '🏛️', title: 'Multi-Municipio', desc: 'Gestión centralizada' }
          ].map((feature, i) => (
            <div
              key={i}
              style={{
                padding: '24px',
                background: 'rgba(15, 29, 18, 0.6)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{feature.icon}</div>
              <h3 style={{ color: C.gold, fontSize: 16, margin: '0 0 4px 0' }}>
                {feature.title}
              </h3>
              <p style={{ color: C.textSec, fontSize: 13, margin: 0 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px 20px',
        textAlign: 'center',
        borderTop: `1px solid ${C.border}`,
        background: C.surface
      }}>
        <p style={{ color: C.textMut, fontSize: 13, margin: 0 }}>
          © 2026 PulsoElectoral v3.0 — Desarrollado para campañas electorales en Puebla
        </p>
      </footer>
    </div>
  );
}

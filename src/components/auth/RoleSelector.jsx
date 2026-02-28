'use client';

import { C } from '@/lib/theme';

const ROLES = [
  { id: 'encuestador', label: 'Encuestador',    icon: '📝', desc: 'Levantar encuestas en campo' },
  { id: 'analista',    label: 'Analista',        icon: '📊', desc: 'Ver dashboard y reportes' },
  { id: 'admin',       label: 'Administrador',   icon: '⚙️', desc: 'Gestionar campaña y equipo' },
];

export function RoleSelector({ selected, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <p style={{ color: C.textSec, fontSize: 14, textAlign: 'center', margin: '0 0 8px 0' }}>
        Selecciona tu rol para continuar
      </p>
      
      {ROLES.map((rol) => (
        <button
          key={rol.id}
          type="button"
          onClick={() => onSelect(rol.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 20px',
            background: selected === rol.id
              ? `${C.gold}26`
              : C.surfaceEl,
            border: `1px solid ${selected === rol.id ? C.gold : C.border}`,
            borderRadius: 12,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(10px)'
          }}
        >
          <span style={{ fontSize: 24 }}>{rol.icon}</span>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ 
              color: selected === rol.id ? C.gold : C.textPri, 
              fontWeight: 600,
              fontSize: 15 
            }}>
              {rol.label}
            </div>
            <div style={{ color: C.textSec, fontSize: 12, marginTop: 2 }}>
              {rol.desc}
            </div>
          </div>
          {selected === rol.id && (
            <span style={{ color: C.gold, fontSize: 18 }}>✓</span>
          )}
        </button>
      ))}
    </div>
  );
}

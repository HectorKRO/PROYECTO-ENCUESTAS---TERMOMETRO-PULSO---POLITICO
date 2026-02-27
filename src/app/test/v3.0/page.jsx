'use client';
/**
 * Página de Testing v3.0 - Staging
 * 
 * Usar para validar:
 * - Carga de múltiples municipios
 * - Cambio de municipio global
 * - WarRoom comparación
 * - Formulario filtrado por municipio
 */

import { useState } from 'react';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { C } from '@/lib/theme';

function TestCard({ title, status, children }) {
  const colors = {
    pass: C.greenAcc,
    fail: C.danger,
    warn: C.amber,
    info: C.goldLight,
  };
  
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <h3 style={{ margin: 0, color: C.textPri, fontSize: 16 }}>{title}</h3>
        <span style={{
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          background: `${colors[status]}22`,
          color: colors[status],
          border: `1px solid ${colors[status]}44`,
        }}>
          {status}
        </span>
      </div>
      <div style={{ color: C.textSec, fontSize: 14 }}>
        {children}
      </div>
    </div>
  );
}

function DataRow({ label, value, valid }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ color: C.textMut }}>{label}</span>
      <span style={{ 
        color: valid ? C.greenAcc : value ? C.textPri : C.danger,
        fontFamily: 'monospace',
        fontSize: 13,
      }}>
        {value || 'No definido'}
      </span>
    </div>
  );
}

export default function TestV3Page() {
  const {
    user,
    organizacion,
    rol,
    municipios,
    municipioActual,
    cambiarMunicipio,
    loading,
    error,
    esAdmin,
  } = useOrganizacion();

  const [testResults, setTestResults] = useState({});

  const runBasicTests = () => {
    const results = {
      auth: !!user,
      org: !!organizacion,
      municipios: municipios.length > 0,
      municipioActual: !!municipioActual,
      multiMunicipio: municipios.length > 1,
    };
    setTestResults(results);
    return results;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: C.textSec }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
          <div>Cargando contexto...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, padding: 40 }}>
        <div style={{
          background: C.dangerDim,
          border: `1px solid ${C.danger}`,
          borderRadius: 12,
          padding: 24,
          color: C.danger,
        }}>
          <h2>Error de Contexto</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 20px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ color: C.goldLight, margin: '0 0 8px', fontSize: 28 }}>
            🧪 Testing v3.0 Multi-Municipio
          </h1>
          <p style={{ color: C.textMut, margin: 0 }}>
            Validación de funcionalidades multi-tenant
          </p>
        </div>

        {/* Contexto Actual */}
        <TestCard title="Contexto de Organización" status={organizacion ? 'pass' : 'fail'}>
          <DataRow label="Organización" value={organizacion?.nombre} valid={!!organizacion} />
          <DataRow label="Rol" value={rol} valid={!!rol} />
          <DataRow label="Usuario" value={user?.email} valid={!!user} />
          <DataRow label="Municipios asignados" value={`${municipios.length}`} valid={municipios.length > 0} />
          <DataRow label="Municipio actual" value={municipioActual?.nombre} valid={!!municipioActual} />
        </TestCard>

        {/* Selector de Municipio */}
        {municipios.length > 1 && (
          <TestCard title="Selector de Municipio" status="info">
            <p style={{ margin: '0 0 16px' }}>Selecciona un municipio para cambiar el contexto global:</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {municipios.map((m) => (
                <button
                  key={m.id}
                  onClick={() => cambiarMunicipio(m.id)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: `1px solid ${municipioActual?.id === m.id ? C.gold : C.border}`,
                    background: municipioActual?.id === m.id ? `${C.gold}22` : C.surfaceEl,
                    color: municipioActual?.id === m.id ? C.goldLight : C.textSec,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  {municipioActual?.id === m.id ? '✓ ' : ''}{m.nombre}
                </button>
              ))}
            </div>
          </TestCard>
        )}

        {/* Tests Automatizados */}
        <TestCard title="Tests Automatizados" status="info">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button
              onClick={runBasicTests}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                background: C.gold,
                color: C.bg,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ▶ Ejecutar Tests
            </button>
          </div>

          {Object.keys(testResults).length > 0 && (
            <div style={{ 
              background: C.surfaceEl, 
              borderRadius: 8, 
              padding: 16,
              fontFamily: 'monospace',
              fontSize: 13,
            }}>
              {Object.entries(testResults).map(([key, passed]) => (
                <div key={key} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  padding: '4px 0',
                  color: passed ? C.greenAcc : C.danger,
                }}>
                  <span>{passed ? '✓' : '✗'}</span>
                  <span style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </TestCard>

        {/* Enlaces a Componentes */}
        <TestCard title="Navegación a Componentes" status="info">
          <div style={{ display: 'grid', gap: 8 }}>
            <a href="/dashboard" style={linkStyle}>📊 Dashboard</a>
            <a href="/warroom" style={linkStyle}>🗺️ WarRoom (Comparación)</a>
            <a href="/encuesta" style={linkStyle}>📝 Formulario de Encuesta</a>
            {esAdmin && <a href="/admin" style={linkStyle}>⚙️ Panel Admin</a>}
          </div>
        </TestCard>

        {/* Info de Debug */}
        <div style={{
          marginTop: 32,
          padding: 16,
          background: C.surfaceEl,
          borderRadius: 8,
          fontSize: 12,
          color: C.textMut,
          fontFamily: 'monospace',
        }}>
          <div>Debug Info:</div>
          <div style={{ marginTop: 8, opacity: 0.7 }}>
            <div>Organización ID: {organizacion?.id || 'N/A'}</div>
            <div>Municipio Actual ID: {municipioActual?.id || 'N/A'}</div>
            <div>User ID: {user?.id?.slice(0, 8) || 'N/A'}...</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const linkStyle = {
  display: 'block',
  padding: '12px 16px',
  background: 'rgba(201, 162, 39, 0.1)',
  border: '1px solid rgba(201, 162, 39, 0.3)',
  borderRadius: 8,
  color: C.goldLight,
  textDecoration: 'none',
  fontSize: 14,
  transition: 'all 0.2s',
};

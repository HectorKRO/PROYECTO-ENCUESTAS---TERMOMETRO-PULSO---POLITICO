'use client';
/**
 * MunicipioCampanaSelector.jsx — Selector combinado de Municipio + Campaña
 * 
 * USO:
 * <MunicipioCampanaSelector
 *   label="Municipio Izquierdo"
 *   municipios={[{id: 1, nombre: 'Atlixco'}, ...]}
 *   campanas={[{id: '...', nombre: 'Campaña 1'}, ...]}
 *   municipioId={selectedMunId}
 *   campanaId={selectedCampId}
 *   onMunicipioChange={(id) => ...}
 *   onCampanaChange={(id) => ...}
 *   loading={false}
 * />
 */

import { C } from '@/lib/theme';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 200,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: C.textMut,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  select: {
    padding: '10px 12px',
    background: C.surfaceEl,
    color: C.textPri,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    // M1 FIX: Estilos de focus manejados por CSS :focus en lugar de inline
  },
  selectFocused: {
    borderColor: C.gold,
    boxShadow: `0 0 0 2px ${C.gold}20`,
  },
  selectDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  selectFocus: {
    borderColor: C.gold,
    boxShadow: `0 0 0 2px ${C.gold}20`,
  },
  option: {
    background: C.surface,
    color: C.textPri,
  },
  loadingText: {
    fontSize: 12,
    color: C.gold,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 12,
    color: C.textMut,
    fontStyle: 'italic',
  },
};

export function MunicipioCampanaSelector({
  label = 'Selección',
  municipios = [],
  campanas = [],
  municipioId,
  campanaId,
  onMunicipioChange,
  onCampanaChange,
  loading = false,
  disabled = false,
}) {
  const hasMunicipios = municipios.length > 0;
  const hasCampanas = campanas.length > 0;
  const needsMunicipioFirst = !municipioId && hasMunicipios;

  return (
    <div style={styles.container}>
      <span style={styles.label}>{label}</span>
      
      {/* Selector de Municipio */}
      {/* M1 FIX: Usar :focus CSS en lugar de onFocus/onBlur inline */}
      <select
        value={municipioId || ''}
        onChange={(e) => onMunicipioChange?.(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled || loading || !hasMunicipios}
        className="municipio-selector"
        style={{
          ...styles.select,
          ...(disabled || loading ? styles.selectDisabled : {}),
        }}
      >
        <option value="" style={styles.option}>
          {loading ? 'Cargando...' : hasMunicipios ? 'Selecciona municipio' : 'Sin municipios'}
        </option>
        {municipios.map((mun) => (
          <option key={mun.id} value={mun.id} style={styles.option}>
            {mun.nombre}
          </option>
        ))}
      </select>

      {/* Selector de Campaña */}
      <select
        value={campanaId || ''}
        onChange={(e) => onCampanaChange?.(e.target.value || null)}
        disabled={disabled || loading || !municipioId || !hasCampanas}
        className="campana-selector"
        style={{
          ...styles.select,
          ...(disabled || loading || !municipioId ? styles.selectDisabled : {}),
        }}
      >
        <option value="" style={styles.option}>
          {loading 
            ? 'Cargando campañas...' 
            : needsMunicipioFirst 
              ? 'Primero selecciona un municipio' 
              : hasCampanas 
                ? 'Selecciona campaña' 
                : 'Sin campañas disponibles'}
        </option>
        {campanas.map((camp) => (
          <option key={camp.id} value={camp.id} style={styles.option}>
            {camp.nombre} {camp.activa ? '●' : '○'}
          </option>
        ))}
      </select>

      {/* Mensaje de ayuda */}
      {municipioId && !hasCampanas && !loading && (
        <span style={styles.emptyText}>
          No hay campañas para este municipio
        </span>
      )}
    </div>
  );
}

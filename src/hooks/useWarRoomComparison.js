'use client';
/**
 * useWarRoomComparison.js — Hook para manejo de estado del WarRoom modo comparación
 * 
 * FUNCIONALIDADES:
 * - Manejo de dos municipios/campañas independientes (lado izquierdo y derecho)
 * - Carga dinámica de campañas según municipio seleccionado
 * - Sincronización con contexto de organización
 * - Guards de concurrencia para evitar race conditions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useOrganizacion } from './useOrganizacion';

/**
 * @typedef {Object} WarRoomSide
 * @property {number|null} municipioId
 * @property {string|null} campanaId
 * @property {Array} campanasDisponibles
 * @property {boolean} loading
 * @property {string|null} error
 */

/**
 * @typedef {Object} UseWarRoomComparisonReturn
 * @property {WarRoomSide} ladoA
 * @property {WarRoomSide} ladoB
 * @property {Function} setMunicipioA
 * @property {Function} setMunicipioB
 * @property {Function} setCampanaA
 * @property {Function} setCampanaB
 * @property {Function} recargarCampanas
 * @property {boolean} showComparison
 * @property {Function} toggleComparison
 */

export function useWarRoomComparison() {
  const { organizacion, municipios, municipioActual } = useOrganizacion();
  
  // Estado del modo comparación
  const [showComparison, setShowComparison] = useState(false);
  
  // Estado de cada lado (A = izquierda, B = derecha)
  const [ladoA, setLadoA] = useState({
    municipioId: null,
    campanaId: null,
    campanasDisponibles: [],
    loading: false,
    error: null,
  });
  
  const [ladoB, setLadoB] = useState({
    municipioId: null,
    campanaId: null,
    campanasDisponibles: [],
    loading: false,
    error: null,
  });

  // Guards de concurrencia
  const fetchingARef = useRef(false);
  const fetchingBRef = useRef(false);
  const initializedRef = useRef(false);
  // WR-REG FIX: Rastrear si el cambio de Lado A fue manual (por usuario) vs automático (por contexto global)
  const manualSelectionARef = useRef(false);

  /**
   * Carga las campañas disponibles para un municipio
   */
  const fetchCampanasPorMunicipio = useCallback(async (municipioId, side) => {
    if (!municipioId || !organizacion?.id) return;
    
    const isSideA = side === 'A';
    const fetchingRef = isSideA ? fetchingARef : fetchingBRef;
    const setSide = isSideA ? setLadoA : setLadoB;
    
    // W1 FIX: Guard de concurrencia con notificación de estado
    if (fetchingRef.current) {
      // Marcar como loading para que el UI sepa que hay una operación en curso
      setSide(prev => ({ ...prev, loading: true }));
      return;
    }
    fetchingRef.current = true;
    
    setSide(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // W3 FIX: Solo campañas activas
      const { data, error } = await supabase
        .from('campanas')
        .select('id, nombre, fecha_inicio, fecha_fin, activa, meta_encuestas')
        .eq('organizacion_id', organizacion.id)
        .eq('municipio_id', municipioId)
        .eq('activa', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setSide(prev => ({
        ...prev,
        campanasDisponibles: data || [],
        // Si solo hay una campaña activa, seleccionarla automáticamente
        campanaId: data?.length === 1 ? data[0].id : prev.campanaId,
      }));
    } catch (err) {
      console.error(`[WarRoom] Error cargando campañas lado ${side}:`, err);
      setSide(prev => ({ ...prev, error: err.message }));
    } finally {
      setSide(prev => ({ ...prev, loading: false }));
      fetchingRef.current = false;
    }
  }, [organizacion?.id]);

  /**
   * W2 FIX: Inicialización y sincronización con cambio global de municipio
   * Solo sincroniza cuando NO fue selección manual del usuario
   */
  useEffect(() => {
    if (!municipioActual) return;
    
    // WR-REG FIX: Si fue selección manual, no sincronizar
    if (manualSelectionARef.current) {
      manualSelectionARef.current = false; // Reset para próximas veces
      return;
    }
    
    const needsUpdate = !initializedRef.current || ladoA.municipioId !== municipioActual.id;
    
    if (needsUpdate) {
      initializedRef.current = true;
      
      setLadoA(prev => ({
        ...prev,
        municipioId: municipioActual.id,
      }));
      
      // Cargar campañas para el lado A
      fetchCampanasPorMunicipio(municipioActual.id, 'A');
    }
  }, [municipioActual, fetchCampanasPorMunicipio, ladoA.municipioId]);

  /**
   * Setters con carga automática de campañas
   */
  const setMunicipioA = useCallback((municipioId) => {
    // WR-REG FIX: Marcar como selección manual
    manualSelectionARef.current = true;
    
    setLadoA(prev => ({
      ...prev,
      municipioId,
      campanaId: null, // Reset campaña al cambiar municipio
      campanasDisponibles: [],
    }));
    fetchCampanasPorMunicipio(municipioId, 'A');
  }, [fetchCampanasPorMunicipio]);

  const setMunicipioB = useCallback((municipioId) => {
    setLadoB(prev => ({
      ...prev,
      municipioId,
      campanaId: null,
      campanasDisponibles: [],
    }));
    fetchCampanasPorMunicipio(municipioId, 'B');
  }, [fetchCampanasPorMunicipio]);

  const setCampanaA = useCallback((campanaId) => {
    setLadoA(prev => ({ ...prev, campanaId }));
  }, []);

  const setCampanaB = useCallback((campanaId) => {
    setLadoB(prev => ({ ...prev, campanaId }));
  }, []);

  const toggleComparison = useCallback(() => {
    setShowComparison(prev => {
      const nuevo = !prev;
      // Al activar comparación, si no hay municipio en B, sugerir el mismo que A
      if (nuevo && !ladoB.municipioId && ladoA.municipioId) {
        setLadoB(prevB => ({ ...prevB, municipioId: ladoA.municipioId }));
        fetchCampanasPorMunicipio(ladoA.municipioId, 'B');
      }
      return nuevo;
    });
  }, [ladoA.municipioId, ladoB.municipioId, fetchCampanasPorMunicipio]);

  const recargarCampanas = useCallback(() => {
    if (ladoA.municipioId) fetchCampanasPorMunicipio(ladoA.municipioId, 'A');
    if (ladoB.municipioId) fetchCampanasPorMunicipio(ladoB.municipioId, 'B');
  }, [ladoA.municipioId, ladoB.municipioId, fetchCampanasPorMunicipio]);

  return {
    // Datos de cada lado
    ladoA,
    ladoB,
    
    // Setters
    setMunicipioA,
    setMunicipioB,
    setCampanaA,
    setCampanaB,
    
    // Utilidades
    recargarCampanas,
    showComparison,
    toggleComparison,
    
    // Datos derivados
    municipiosDisponibles: municipios,
    organizacion,
  };
}

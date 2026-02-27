'use client';

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';

const OrganizacionContext = createContext(null);

export function OrganizacionProvider({ children }) {
  const [organizacion, setOrganizacion] = useState(null);
  const [rol, setRol] = useState(null);
  const [municipios, setMunicipios] = useState([]);
  const [municipioActual, setMunicipioActual] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  
  // U4: Guard de concurrencia
  const isFetchingRef = useRef(false);
  // U2: Flag para evitar doble carga inicial
  const initialLoadDoneRef = useRef(false);
  // Ref para leer user.id en el callback de auth sin recrear la suscripción
  const currentUserIdRef = useRef(null);

  const loadOrganizacion = useCallback(async (force = false) => {  // eslint-disable-line @typescript-eslint/no-unused-vars
    // O1 FIX: Guard de concurrencia SIEMPRE activo, force solo fuerza re-carga
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    try {
      setLoading(true);
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        setUser(null);
        setOrganizacion(null);
        setRol(null);
        setIsInitialized(true);
        isFetchingRef.current = false;
        return;
      }

      setUser(currentUser);

      const { data: membresias, error: errMembresias } = await supabase
        .from('organizacion_miembros')
        .select(`
          organizacion_id,
          rol,
          organizaciones (
            id, nombre, tipo, plan, limite_municipios, limite_campanas, activa
          )
        `)
        .eq('user_id', currentUser.id)
        .eq('activo', true);

      if (errMembresias) throw errMembresias;
      
      if (!membresias || membresias.length === 0) {
        setError('Usuario no pertenece a ninguna organización');
        setIsInitialized(true);
        isFetchingRef.current = false;
        return;
      }

      const primeraMembresia = membresias[0];
      setRol(primeraMembresia.rol);
      setOrganizacion(primeraMembresia.organizaciones);

      const { data: municipiosOrg, error: errMun } = await supabase
        .from('organizacion_municipios')
        .select(`
          municipio_id,
          municipios (id, nombre, latitud_centro, longitud_centro)
        `)
        .eq('organizacion_id', primeraMembresia.organizacion_id);

      if (errMun) throw errMun;

      const munList = municipiosOrg?.map(m => m.municipios) || [];
      setMunicipios(munList);
      
      const savedMun = localStorage.getItem('municipio_actual_id');
      const defaultMun = munList.find(m => m.id.toString() === savedMun) || munList[0];
      setMunicipioActual(defaultMun);

    } catch (err) {
      console.error('Error cargando organización:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsInitialized(true);
      isFetchingRef.current = false;
    }
  }, []);

  // Mantener ref sincronizado con el estado de user
  useEffect(() => {
    currentUserIdRef.current = user?.id ?? null;
  }, [user]);

  // Carga inicial - solo una vez
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      loadOrganizacion();
    }
  }, [loadOrganizacion]);

  // Suscripción a cambios de auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          initialLoadDoneRef.current = false;
          setUser(null);
          setOrganizacion(null);
          setRol(null);
          setMunicipios([]);
          setMunicipioActual(null);
          localStorage.removeItem('municipio_actual_id');
          setIsInitialized(true);
        } else if (event === 'SIGNED_IN' && session?.user) {
          // O2 FIX: Leer user.id del session para evitar recrear suscripción
          const newUserId = session.user.id;
          const currentUserId = currentUserIdRef.current;
          // U2: Solo recargar si el usuario es diferente
          if (newUserId !== currentUserId) {
            initialLoadDoneRef.current = false;
            await loadOrganizacion(true);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadOrganizacion]);

  const cambiarMunicipio = useCallback((municipioId) => {
    const mun = municipios.find(m => m.id === municipioId);
    if (mun) {
      setMunicipioActual(mun);
      localStorage.setItem('municipio_actual_id', mun.id);
    }
  }, [municipios]);

  const value = {
    user,
    organizacion,
    rol,
    municipios,
    municipioActual,
    cambiarMunicipio,
    loading,
    isInitialized,
    error,
    esSuperadmin: rol === 'superadmin',
    esAdmin: rol === 'admin' || rol === 'superadmin',
    esAnalista: rol === 'analista' || rol === 'admin' || rol === 'superadmin',
    esEncuestador: rol === 'encuestador',
    recargar: () => loadOrganizacion(true)
  };

  return (
    <OrganizacionContext.Provider value={value}>
      {children}
    </OrganizacionContext.Provider>
  );
}

export const useOrganizacion = () => {
  const context = useContext(OrganizacionContext);
  if (!context) {
    throw new Error('useOrganizacion debe usarse dentro de OrganizacionProvider');
  }
  return context;
};

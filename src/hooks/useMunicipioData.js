'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useMunicipioData(municipioId) {
  const [secciones, setSecciones] = useState([]);
  const [colonias, setColonias] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!municipioId) {
      setSecciones([]);
      setColonias([]);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      
      try {
        const [seccionesRes, coloniasRes] = await Promise.all([
          supabase
            .from('secciones_electorales')
            .select('seccion, nombre_zona, tipo, lista_nominal, latitud_centro, longitud_centro')
            .eq('municipio_id', municipioId)
            .order('seccion'),
          supabase
            .from('colonias')
            .select('id, nombre, seccion_id, tipo, codigo_postal')
            .eq('municipio_id', municipioId)
            .eq('activa', true)
            .order('nombre')
        ]);

        if (cancelled) return;

        if (seccionesRes.error) throw seccionesRes.error;
        if (coloniasRes.error) throw coloniasRes.error;

        setSecciones(seccionesRes.data || []);
        setColonias(coloniasRes.data || []);
      } catch (err) {
        console.error('Error cargando datos de municipio:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();

    return () => { cancelled = true; };
  }, [municipioId]);

  return {
    secciones,
    colonias,
    loading
  };
}

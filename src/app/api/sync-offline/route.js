import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { RESPUESTA_FIELDS } from '@/lib/constants';

// ✅ FIX: Sanitiza payload con allowlist en lugar de spread directo
function sanitize(raw) {
  const clean = {};
  for (const key of RESPUESTA_FIELDS) {
    if (raw[key] !== undefined) clean[key] = raw[key];
  }
  return clean;
}

// ✅ FIX: Validación básica de tipos
function validate(enc) {
  if (!enc.campana_id || typeof enc.campana_id !== 'string') return 'campana_id requerido';
  // ✅ FIX A2: El rango válido es 0-5 (0 = "No responde"), antes excluía 0 incorrectamente
  if (enc.intencion_voto !== undefined && (enc.intencion_voto < 0 || enc.intencion_voto > 5)) return 'intencion_voto fuera de rango';
  if (enc.simpatia       !== undefined && (enc.simpatia       < 0 || enc.simpatia       > 5)) return 'simpatia fuera de rango';
  // ✅ FIX M3: Umbral reducido a 30s (antes 45s era demasiado restrictivo para encuestadores expertos)
  if (enc.duracion_segundos !== undefined && enc.duracion_segundos < 30) return 'duracion_segundos muy corta';
  return null;
}

export async function POST(request) {
  try {
    const { encuestas } = await request.json();

    if (!Array.isArray(encuestas) || encuestas.length === 0) {
      return NextResponse.json({ error: 'No hay encuestas para sincronizar' }, { status: 400 });
    }

    if (encuestas.length > 100) {
      return NextResponse.json({ error: 'Máximo 100 encuestas por lote' }, { status: 400 });
    }

    // ✅ FIX: Usa anon key para que RLS aplique, no service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    // Sanitizar y validar cada encuesta
    const cleanEncuestas = [];
    const errors = [];

    for (let i = 0; i < encuestas.length; i++) {
      const err = validate(encuestas[i]);
      if (err) {
        errors.push({ index: i, error: err });
        continue;
      }
      cleanEncuestas.push({
        ...sanitize(encuestas[i]),
        fuente: encuestas[i].fuente || 'offline',
        sincronizada: true,
      });
    }

    if (cleanEncuestas.length === 0) {
      return NextResponse.json({ error: 'Ninguna encuesta pasó validación', errors }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('respuestas')
      .insert(cleanEncuestas)
      .select('id');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      sincronizadas: data?.length ?? 0,
      errores_validacion: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err) {
    console.error('Error sync offline:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno' },
      { status: 500 }
    );
  }
}

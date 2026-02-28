-- ─────────────────────────────────────────────────────────────────────────────
-- 07_encuestador_ubicaciones.sql
-- Tabla para rastreo de ubicación en tiempo real de encuestadores en campo
--
-- DISEÑO:
--   - Una fila por (user_id, campana_id) → upsert semántico
--   - El encuestador actualiza su posición cada 60 segundos
--   - El dashboard lee las filas y sabe quién está activo (updated_at reciente)
--   - "Activo" = updated_at < 5 minutos atrás
--
-- EJECUTAR en Supabase SQL Editor antes de desplegar el feature de Campo
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tabla principal ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS encuestador_ubicaciones (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campana_id  UUID        NOT NULL REFERENCES campanas(id)   ON DELETE CASCADE,

  -- Coordenadas actuales
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  precision_m INT,            -- precisión GPS en metros

  -- Nombre visible en el mapa (desnormalizado para evitar JOINs en tiempo real)
  encuestador_nombre TEXT,

  -- Timestamps
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, campana_id)
);

-- ── Índice para consultas rápidas por campaña ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_enc_ubi_campana
  ON encuestador_ubicaciones (campana_id, updated_at DESC);

-- ── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE encuestador_ubicaciones ENABLE ROW LEVEL SECURITY;

-- Política 1: Encuestador puede insertar y actualizar SOLO su propia fila
CREATE POLICY "enc_ubi_own_write" ON encuestador_ubicaciones
  FOR ALL
  TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Política 2: Admin puede leer todas las ubicaciones de campañas de su org
CREATE POLICY "enc_ubi_admin_read" ON encuestador_ubicaciones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organizacion_miembros om
      JOIN campanas c ON c.organizacion_id = om.organizacion_id
      WHERE om.user_id   = auth.uid()
        AND om.rol       IN ('admin', 'superadmin')
        AND c.id         = encuestador_ubicaciones.campana_id
    )
  );

-- ── Función helper: limpiar ubicaciones antiguas (> 8 horas) ─────────────────
-- Llamar periódicamente via pg_cron o manualmente
CREATE OR REPLACE FUNCTION limpiar_ubicaciones_antiguas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM encuestador_ubicaciones
  WHERE updated_at < now() - interval '8 hours';
END;
$$;

-- ── Habilitar Realtime para esta tabla ───────────────────────────────────────
-- Ejecutar también en Supabase Dashboard → Database → Replication
-- o mediante este comando:
ALTER PUBLICATION supabase_realtime ADD TABLE encuestador_ubicaciones;

-- ── Comentario final ─────────────────────────────────────────────────────────
COMMENT ON TABLE encuestador_ubicaciones IS
  'Posición GPS en tiempo real de encuestadores activos en campo. '
  'Una fila por (user_id, campana_id), actualizada cada ~60s vía upsert. '
  '"Activo" = updated_at < now() - interval ''5 minutes''.';

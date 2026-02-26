-- ============================================================
-- FIX: Corregir alertas de seguridad del Linter de Supabase
-- ============================================================

-- 1. RECREAR VISTAS SIN SECURITY DEFINER (usar SECURITY INVOKER por defecto)
-- Las vistas creadas con CREATE VIEW normalmente no tienen SECURITY DEFINER,
-- pero si fueron creadas explícitamente con esa opción, las recreamos.

-- Vista: v_tendencia_semanal
DROP VIEW IF EXISTS v_tendencia_semanal;
CREATE VIEW v_tendencia_semanal AS
SELECT
  campana_id,
  DATE_TRUNC('week', created_at)::date AS semana,
  COUNT(*) AS encuestas,
  ROUND(AVG(intencion_voto)::numeric, 2) AS promedio_intencion,
  ROUND(100.0 * COUNT(*) FILTER (WHERE intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) AS pct_intencion,
  ROUND(100.0 * COUNT(*) FILTER (WHERE reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(*),0), 1) AS pct_reconocimiento,
  ROUND(100.0 * COUNT(*) FILTER (WHERE imagen_percibida IN ('muy_positiva','positiva')) / NULLIF(COUNT(*),0), 1) AS pct_imagen
FROM respuestas
WHERE completada = true AND deleted_at IS NULL
GROUP BY campana_id, DATE_TRUNC('week', created_at)
ORDER BY semana;

-- Vista: v_por_fuente
DROP VIEW IF EXISTS v_por_fuente;
CREATE VIEW v_por_fuente AS
SELECT
  campana_id, fuente,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY campana_id), 0), 1) AS pct
FROM respuestas
WHERE completada = true AND deleted_at IS NULL
GROUP BY campana_id, fuente;

-- Vista: v_resultados_por_seccion
DROP VIEW IF EXISTS v_resultados_por_seccion;
CREATE VIEW v_resultados_por_seccion AS
SELECT
  r.campana_id,
  r.seccion_id,
  se.nombre_zona,
  se.tipo,
  se.latitud_centro,
  se.longitud_centro,
  se.lista_nominal,
  COUNT(*) AS total,
  ROUND(AVG(r.intencion_voto)::numeric, 2) AS promedio_intencion,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) AS pct_intencion_positiva,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(*),0), 1) AS pct_reconocimiento
FROM respuestas r
JOIN secciones_electorales se ON r.seccion_id = se.seccion
WHERE r.completada = true AND r.deleted_at IS NULL
GROUP BY r.campana_id, r.seccion_id, se.nombre_zona, se.tipo, se.latitud_centro, se.longitud_centro, se.lista_nominal;

-- Vista: v_resultados_por_colonia
DROP VIEW IF EXISTS v_resultados_por_colonia;
CREATE VIEW v_resultados_por_colonia AS
SELECT
  r.campana_id,
  r.colonia_id,
  c.nombre as colonia,
  c.tipo as tipo_colonia,
  c.codigo_postal,
  r.seccion_id,
  se.nombre_zona as zona,
  se.tipo as tipo_seccion,
  se.latitud_centro,
  se.longitud_centro,
  COUNT(*) AS total,
  ROUND(AVG(r.intencion_voto)::numeric, 2) AS promedio_intencion,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) AS pct_intencion_positiva,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(*),0), 1) AS pct_reconocimiento
FROM respuestas r
LEFT JOIN colonias c ON r.colonia_id = c.id
LEFT JOIN secciones_electorales se ON r.seccion_id = se.seccion
WHERE r.completada = true AND r.deleted_at IS NULL AND r.colonia_id IS NOT NULL
GROUP BY r.campana_id, r.colonia_id, c.nombre, c.tipo, c.codigo_postal, r.seccion_id, se.nombre_zona, se.tipo, se.latitud_centro, se.longitud_centro;

-- Vista: v_contactos_seguimiento
DROP VIEW IF EXISTS v_contactos_seguimiento;
CREATE VIEW v_contactos_seguimiento AS
SELECT
  id,
  campana_id,
  seccion_id,
  created_at,
  whatsapp_contacto,
  intencion_voto,
  simpatia,
  comentario_final
FROM respuestas
WHERE consentimiento_contacto = true 
  AND whatsapp_contacto IS NOT NULL 
  AND completada = true 
  AND deleted_at IS NULL;

-- Vista: v_demograficos
DROP VIEW IF EXISTS v_demograficos;
CREATE VIEW v_demograficos AS
SELECT
  campana_id, genero, edad_rango,
  COUNT(*) AS total,
  ROUND(AVG(intencion_voto)::numeric, 2) AS promedio_intencion,
  ROUND(100.0 * COUNT(*) FILTER (WHERE intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) AS pct_intencion_positiva
FROM respuestas
WHERE completada = true AND deleted_at IS NULL
GROUP BY campana_id, genero, edad_rango;

-- Vista: v_kpis_campana
DROP VIEW IF EXISTS v_kpis_campana;
CREATE VIEW v_kpis_campana AS
SELECT
  r.campana_id,
  COUNT(*) AS total_encuestas,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.reconocimiento_asistido NOT IN ('no_conoce')) / NULLIF(COUNT(*),0), 1) AS pct_reconocimiento,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.intencion_voto >= 4) / NULLIF(COUNT(*),0), 1) AS pct_intencion_positiva,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.imagen_percibida IN ('muy_positiva','positiva')) / NULLIF(COUNT(*),0), 1) AS pct_imagen_positiva,
  ROUND(AVG(r.intencion_voto)::numeric, 2) AS promedio_intencion
FROM respuestas r
WHERE r.completada = true AND r.deleted_at IS NULL
GROUP BY r.campana_id;

-- Vista: v_agenda_ciudadana
DROP VIEW IF EXISTS v_agenda_ciudadana;
CREATE VIEW v_agenda_ciudadana AS
SELECT
  campana_id,
  UNNEST(problemas_localidad) AS problema,
  COUNT(*) AS menciones
FROM respuestas
WHERE completada = true AND deleted_at IS NULL
GROUP BY campana_id, problema
ORDER BY menciones DESC;

-- Vista: v_alertas_dashboard
DROP VIEW IF EXISTS v_alertas_dashboard;
CREATE VIEW v_alertas_dashboard AS
SELECT
  a.id,
  a.tipo,
  a.severidad,
  a.titulo,
  a.mensaje,
  a.datos,
  a.leida,
  a.notificada,
  a.created_at,
  CASE
    WHEN a.created_at > NOW() - INTERVAL '1 hour' THEN 'Hace menos de 1 hora'
    WHEN a.created_at > NOW() - INTERVAL '24 hours' THEN 'Hoy'
    WHEN a.created_at > NOW() - INTERVAL '48 hours' THEN 'Ayer'
    ELSE to_char(a.created_at, 'DD Mon YYYY')
  END AS tiempo_relativo,
  CASE a.tipo
    WHEN 'milestone' THEN '🎯'
    WHEN 'seccion_baja' THEN '⚠️'
    WHEN 'pico_encuestas' THEN '📈'
    WHEN 'cambio_semanal' THEN '📊'
    WHEN 'reconocimiento' THEN '👁️'
    WHEN 'encuestador' THEN '👤'
  END AS icono
FROM alertas a
ORDER BY a.created_at DESC;

-- 2. HABILITAR RLS EN TABLAS FALTANTES
ALTER TABLE encuestas_pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_campanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para encuestas_pendientes
DROP POLICY IF EXISTS "encuestas_pendientes_candidato" ON encuestas_pendientes;
CREATE POLICY "encuestas_pendientes_candidato" ON encuestas_pendientes
  FOR ALL TO authenticated
  USING (
    campana_id IN (
      SELECT c.id FROM campanas c
      JOIN candidatos cand ON c.candidato_id = cand.id
      WHERE cand.auth_user_id = auth.uid()
    )
  );

-- Políticas RLS para stats_campanas
DROP POLICY IF EXISTS "stats_campanas_candidato" ON stats_campanas;
CREATE POLICY "stats_campanas_candidato" ON stats_campanas
  FOR ALL TO authenticated
  USING (
    campana_id IN (
      SELECT c.id FROM campanas c
      JOIN candidatos cand ON c.candidato_id = cand.id
      WHERE cand.auth_user_id = auth.uid()
    )
  );

-- Políticas RLS para rate_limits
DROP POLICY IF EXISTS "rate_limits_anon" ON rate_limits;
CREATE POLICY "rate_limits_anon" ON rate_limits
  FOR ALL TO anon
  USING (false);  -- Solo acceso admin/service role

-- 3. ACTUALIZAR FUNCIONES CON SEARCH_PATH EXPLÍCITO

-- Función: fn_marcar_alertas_leidas
CREATE OR REPLACE FUNCTION fn_marcar_alertas_leidas(
    p_campana_id UUID,
    p_alerta_ids UUID[] DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    IF p_alerta_ids IS NOT NULL THEN
        UPDATE alertas SET leida = TRUE
        WHERE campana_id = p_campana_id
          AND id = ANY(p_alerta_ids)
          AND leida = FALSE;
    ELSE
        UPDATE alertas SET leida = TRUE
        WHERE campana_id = p_campana_id
          AND leida = FALSE;
    END IF;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función: fn_actualizar_stats
CREATE OR REPLACE FUNCTION fn_actualizar_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO stats_campanas (campana_id, total_encuestas, encuestas_hoy)
  VALUES (NEW.campana_id, 1, 1)
  ON CONFLICT (campana_id) DO UPDATE
    SET total_encuestas = stats_campanas.total_encuestas + 1,
        encuestas_hoy = CASE
          WHEN stats_campanas.ultimo_update::date < CURRENT_DATE THEN 1
          ELSE stats_campanas.encuestas_hoy + 1
        END,
        ultimo_update = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función: fn_stats_rapidas
CREATE OR REPLACE FUNCTION fn_stats_rapidas(p_campana_id UUID)
RETURNS JSON AS $$
DECLARE
  resultado JSON;
BEGIN
  WITH base AS (
    SELECT * FROM respuestas
    WHERE campana_id = p_campana_id AND completada = true AND deleted_at IS NULL
  ),
  totales AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS hoy,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', NOW())) AS esta_semana,
      ROUND(100.0 * COUNT(*) FILTER (WHERE reconocimiento_asistido NOT IN ('no_conoce'))
        / NULLIF(COUNT(*),0), 1) AS reconocimiento,
      ROUND(100.0 * COUNT(*) FILTER (WHERE intencion_voto >= 4)
        / NULLIF(COUNT(*),0), 1) AS intencion_positiva,
      ROUND(100.0 * COUNT(*) FILTER (WHERE imagen_percibida IN ('muy_positiva','positiva'))
        / NULLIF(COUNT(*),0), 1) AS imagen_positiva
    FROM base
  ),
  fuentes AS (
    SELECT COALESCE(json_object_agg(fuente, cnt), '{}'::json) AS por_fuente
    FROM (SELECT fuente, COUNT(*) AS cnt FROM base GROUP BY fuente) sub
  )
  SELECT json_build_object(
    'total_encuestas', t.total,
    'hoy', t.hoy,
    'esta_semana', t.esta_semana,
    'reconocimiento', t.reconocimiento,
    'intencion_positiva', t.intencion_positiva,
    'imagen_positiva', t.imagen_positiva,
    'por_fuente', f.por_fuente
  )
  INTO resultado
  FROM totales t, fuentes f;

  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función: fn_evaluar_alertas
CREATE OR REPLACE FUNCTION fn_evaluar_alertas()
RETURNS TRIGGER AS $$
DECLARE
    v_config config_alertas%ROWTYPE;
BEGIN
    IF NEW.completada IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_config
    FROM config_alertas
    WHERE campana_id = NEW.campana_id;

    IF v_config IS NULL THEN
        RETURN NEW;
    END IF;

    IF v_config.milestones_activo THEN
        PERFORM _alerta_milestone(NEW.campana_id, v_config);
    END IF;

    IF v_config.seccion_baja_activo AND NEW.seccion_id IS NOT NULL THEN
        PERFORM _alerta_seccion_baja(NEW.campana_id, NEW.seccion_id, v_config);
    END IF;

    IF v_config.pico_activo THEN
        PERFORM _alerta_pico(NEW.campana_id, v_config);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función: _alerta_milestone
CREATE OR REPLACE FUNCTION _alerta_milestone(
    p_campana_id UUID,
    p_config config_alertas
)
RETURNS VOID AS $$
DECLARE
    v_total INT;
    v_milestone INT;
    v_ya_existe BOOLEAN;
BEGIN
    SELECT total_encuestas INTO v_total
    FROM stats_campanas
    WHERE campana_id = p_campana_id;

    IF v_total IS NULL THEN RETURN; END IF;

    FOREACH v_milestone IN ARRAY p_config.milestones_valores
    LOOP
        IF v_total >= v_milestone THEN
            SELECT EXISTS(
                SELECT 1 FROM alertas
                WHERE campana_id = p_campana_id
                  AND tipo = 'milestone'
                  AND (datos->>'milestone')::INT = v_milestone
            ) INTO v_ya_existe;

            IF NOT v_ya_existe THEN
                INSERT INTO alertas (campana_id, tipo, severidad, titulo, mensaje, datos)
                VALUES (
                    p_campana_id,
                    'milestone',
                    CASE WHEN v_milestone >= 500 THEN 'critical'
                         WHEN v_milestone >= 200 THEN 'warning'
                         ELSE 'info' END,
                    '🎯 ¡' || v_milestone || ' encuestas alcanzadas!',
                    'La campaña ha alcanzado ' || v_total || ' encuestas. Milestone de ' || v_milestone || ' superado.',
                    jsonb_build_object(
                        'milestone', v_milestone,
                        'total_actual', v_total,
                        'fecha', NOW()
                    )
                );
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función: _alerta_seccion_baja
CREATE OR REPLACE FUNCTION _alerta_seccion_baja(
    p_campana_id UUID,
    p_seccion_id TEXT,
    p_config config_alertas
)
RETURNS VOID AS $$
DECLARE
    v_seccion RECORD;
    v_intencion NUMERIC;
    v_total_sec INT;
    v_ya_existe BOOLEAN;
BEGIN
    SELECT
        COUNT(*) AS total,
        ROUND(AVG(CASE WHEN intencion_voto >= 4 THEN 100.0 ELSE 0.0 END), 1) AS pct_intencion
    INTO v_total_sec, v_intencion
    FROM respuestas
    WHERE campana_id = p_campana_id
      AND seccion_id = p_seccion_id
      AND completada = TRUE;

    IF v_total_sec < p_config.seccion_baja_min_enc THEN RETURN; END IF;
    IF v_intencion >= p_config.seccion_baja_umbral THEN RETURN; END IF;

    SELECT EXISTS(
        SELECT 1 FROM alertas
        WHERE campana_id = p_campana_id
          AND tipo = 'seccion_baja'
          AND (datos->>'seccion_id') = p_seccion_id
          AND created_at > NOW() - INTERVAL '24 hours'
    ) INTO v_ya_existe;

    IF v_ya_existe THEN RETURN; END IF;

    SELECT * INTO v_seccion
    FROM secciones_electorales
    WHERE seccion = p_seccion_id;

    INSERT INTO alertas (campana_id, tipo, severidad, titulo, mensaje, datos)
    VALUES (
        p_campana_id,
        'seccion_baja',
        'warning',
        '⚠️ Sección ' || COALESCE(v_seccion.seccion, '?') || ' por debajo del umbral',
        'La sección ' || COALESCE(v_seccion.nombre_zona, '?') ||
        ' tiene ' || v_intencion || '% de intención de voto.',
        jsonb_build_object(
            'seccion_id', p_seccion_id,
            'seccion', COALESCE(v_seccion.seccion, '?'),
            'zona', COALESCE(v_seccion.nombre_zona, '?'),
            'intencion_pct', v_intencion
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función: _alerta_pico
CREATE OR REPLACE FUNCTION _alerta_pico(
    p_campana_id UUID,
    p_config config_alertas
)
RETURNS VOID AS $$
DECLARE
    v_count_hora INT;
    v_ya_existe BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO v_count_hora
    FROM respuestas
    WHERE campana_id = p_campana_id
      AND created_at > NOW() - INTERVAL '1 hour';

    IF v_count_hora < p_config.pico_por_hora THEN RETURN; END IF;

    SELECT EXISTS(
        SELECT 1 FROM alertas
        WHERE campana_id = p_campana_id
          AND tipo = 'pico_encuestas'
          AND created_at > NOW() - INTERVAL '1 hour'
    ) INTO v_ya_existe;

    IF v_ya_existe THEN RETURN; END IF;

    INSERT INTO alertas (campana_id, tipo, severidad, titulo, mensaje, datos)
    VALUES (
        p_campana_id,
        'pico_encuestas',
        'warning',
        '📈 Pico de actividad detectado',
        'Se registraron ' || v_count_hora || ' encuestas en la última hora.',
        jsonb_build_object(
            'encuestas_hora', v_count_hora,
            'umbral', p_config.pico_por_hora
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. VERIFICACIÓN FINAL
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fix de seguridad aplicado exitosamente';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Vistas recreadas (sin SECURITY DEFINER)';
  RAISE NOTICE '✓ RLS habilitado en tablas faltantes';
  RAISE NOTICE '✓ Funciones actualizadas con SET search_path';
END $$;

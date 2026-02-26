-- ═══════════════════════════════════════════════════════════
-- alertas_supabase.sql — Sistema de alertas de campaña v1.1
-- EJECUTAR DESPUÉS de schema.sql v2.1
--
-- BUGS CORREGIDOS vs v1.0:
--   ✅ [CRÍTICO] FROM encuestas → FROM respuestas (tabla no existía)
--   ✅ [CRÍTICO] ON encuestas → ON respuestas en los 3 triggers
--   ✅ [CRÍTICO] v_seccion.seccion_ine → v_seccion.seccion (columna correcta)
--   ✅ [CRÍTICO] Arquitectura de triggers: fn_evaluar_alertas() usaba PERFORM
--               sobre funciones TRIGGER, que es imposible en PostgreSQL.
--               Refactorizado a: 1 único trigger → 1 función maestra que llama
--               helpers VOID con parámetros explícitos.
--   ✅ [PERF]   COUNT(*) full scan en cada INSERT reemplazado por lectura de
--               stats_campanas.total_encuestas (O(1), tabla del schema v2.1)
-- ═══════════════════════════════════════════════════════════

-- ── 1. Tabla de alertas ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS alertas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campana_id      UUID REFERENCES campanas(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL CHECK (tipo IN (
        'milestone',
        'seccion_baja',
        'pico_encuestas',
        'cambio_semanal',
        'reconocimiento',
        'encuestador'
    )),
    severidad       TEXT NOT NULL DEFAULT 'info' CHECK (severidad IN ('info', 'warning', 'critical')),
    titulo          TEXT NOT NULL,
    mensaje         TEXT NOT NULL,
    datos           JSONB DEFAULT '{}',
    leida           BOOLEAN DEFAULT FALSE,
    notificada      BOOLEAN DEFAULT FALSE,
    canal_notif     TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertas_campana        ON alertas(campana_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_no_leidas      ON alertas(campana_id) WHERE leida = FALSE;
-- ✅ NEW: índice parcial para la query de alertas de sección en últimas 24h
CREATE INDEX IF NOT EXISTS idx_alertas_seccion_reciente ON alertas(campana_id, tipo, created_at)
    WHERE tipo = 'seccion_baja';

-- ── 2. Configuración de alertas por campaña ─────────────────
CREATE TABLE IF NOT EXISTS config_alertas (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campana_id              UUID REFERENCES campanas(id) ON DELETE CASCADE UNIQUE,
    milestones_activo       BOOLEAN DEFAULT TRUE,
    milestones_valores      INT[] DEFAULT '{50, 100, 200, 300, 400, 500, 750, 1000}',
    seccion_baja_activo     BOOLEAN DEFAULT TRUE,
    seccion_baja_umbral     INT DEFAULT 35,
    seccion_baja_min_enc    INT DEFAULT 10,
    pico_activo             BOOLEAN DEFAULT TRUE,
    pico_por_hora           INT DEFAULT 15,
    cambio_semanal_activo   BOOLEAN DEFAULT TRUE,
    cambio_semanal_delta    INT DEFAULT 5,
    email_destino           TEXT,
    whatsapp_destino        TEXT,
    push_activo             BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Helpers VOID (no son triggers — reciben parámetros explícitos) ──────
-- ✅ FIX: Las funciones anteriores eran RETURNS TRIGGER pero fn_evaluar_alertas()
--    las llamaba con PERFORM sin argumentos. PostgreSQL no permite llamar funciones
--    TRIGGER directamente — generan error o recursión infinita.
--    Solución: helpers son funciones VOID normales que reciben los datos del NEW
--    como parámetros. El trigger maestro los llama con los valores correctos.

-- ── Helper 3a: Evaluar milestone ────────────────────────────
-- ✅ FIX PERF: Lee stats_campanas.total_encuestas en lugar de COUNT(*) full scan
CREATE OR REPLACE FUNCTION _alerta_milestone(
    p_campana_id  UUID,
    p_config      config_alertas
)
RETURNS VOID AS $$
DECLARE
    v_total       INT;
    v_milestone   INT;
    v_ya_existe   BOOLEAN;
BEGIN
    -- ✅ FIX: O(1) — lee el contador materializado, no escanea respuestas
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
                        'milestone',     v_milestone,
                        'total_actual',  v_total,
                        'fecha',         NOW()
                    )
                );
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ── Helper 3b: Evaluar sección baja ─────────────────────────
CREATE OR REPLACE FUNCTION _alerta_seccion_baja(
    p_campana_id  UUID,
    p_seccion_id  TEXT,
    p_config      config_alertas
)
RETURNS VOID AS $$
DECLARE
    v_seccion     RECORD;
    v_intencion   NUMERIC;
    v_total_sec   INT;
    v_ya_existe   BOOLEAN;
BEGIN
    -- ✅ FIX: FROM respuestas (no FROM encuestas)
    SELECT
        COUNT(*)                                                              AS total,
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

    -- ✅ FIX: v_seccion.seccion (no v_seccion.seccion_ine — columna no existía)
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
        ' tiene ' || v_intencion || '% de intención de voto (' ||
        v_total_sec || ' encuestas). Umbral: ' || p_config.seccion_baja_umbral || '%.',
        jsonb_build_object(
            'seccion_id',       p_seccion_id,
            'seccion',          COALESCE(v_seccion.seccion, '?'),  -- ✅ columna correcta
            'zona',             COALESCE(v_seccion.nombre_zona, '?'),
            'intencion_pct',    v_intencion,
            'total_encuestas',  v_total_sec,
            'umbral',           p_config.seccion_baja_umbral
        )
    );
END;
$$ LANGUAGE plpgsql;

-- ── Helper 3c: Detectar pico de encuestas ───────────────────
-- ✅ FIX PERF: COUNT solo en ventana de 1 hora + índice idx_respuestas_fecha_campana
CREATE OR REPLACE FUNCTION _alerta_pico(
    p_campana_id  UUID,
    p_config      config_alertas
)
RETURNS VOID AS $$
DECLARE
    v_count_hora  INT;
    v_ya_existe   BOOLEAN;
BEGIN
    -- ✅ FIX: FROM respuestas (no FROM encuestas)
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
        'Se registraron ' || v_count_hora || ' encuestas en la última hora. ' ||
        'Umbral configurado: ' || p_config.pico_por_hora || ' por hora.',
        jsonb_build_object(
            'encuestas_hora',   v_count_hora,
            'umbral',           p_config.pico_por_hora,
            'ventana_inicio',   NOW() - INTERVAL '1 hour'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- ── 4. TRIGGER MAESTRO — única función TRIGGER del módulo ────
-- ✅ FIX ARQUITECTURA: Un único RETURNS TRIGGER que llama a los helpers VOID.
--    Antes: fn_evaluar_alertas() hacía PERFORM fn_evaluar_milestone() — inválido
--    porque las funciones TRIGGER no pueden llamarse como funciones normales.
--    Ahora: trigger llama a helpers normales con los parámetros de NEW.
CREATE OR REPLACE FUNCTION fn_evaluar_alertas()
RETURNS TRIGGER AS $$
DECLARE
    v_config  config_alertas%ROWTYPE;
BEGIN
    -- Solo evaluar encuestas completadas
    IF NEW.completada IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    -- Cargar configuración una sola vez para los 3 evaluaciones
    SELECT * INTO v_config
    FROM config_alertas
    WHERE campana_id = NEW.campana_id;

    -- Sin config → no hay alertas que evaluar
    IF v_config IS NULL THEN
        RETURN NEW;
    END IF;

    -- ✅ Llamadas correctas: helpers VOID con parámetros explícitos
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
$$ LANGUAGE plpgsql;

-- ✅ FIX: ON respuestas (no ON encuestas — tabla inexistente)
-- Un único trigger en lugar de 3 para reducir overhead por INSERT
DROP TRIGGER IF EXISTS trg_alertas_encuesta  ON respuestas;
DROP TRIGGER IF EXISTS trg_alertas_milestone ON respuestas;
DROP TRIGGER IF EXISTS trg_alertas_seccion   ON respuestas;
DROP TRIGGER IF EXISTS trg_alertas_pico      ON respuestas;
DROP TRIGGER IF EXISTS trg_alertas           ON respuestas; -- ✅ FIX: Eliminar si ya existe

CREATE TRIGGER trg_alertas
    AFTER INSERT ON respuestas              -- ✅ FIX: respuestas, no encuestas
    FOR EACH ROW
    WHEN (NEW.completada = TRUE)
    EXECUTE FUNCTION fn_evaluar_alertas();

-- ── 5. Vista: Alertas para dashboard ─────────────────────────
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
        WHEN a.created_at > NOW() - INTERVAL '1 hour'   THEN 'Hace menos de 1 hora'
        WHEN a.created_at > NOW() - INTERVAL '24 hours' THEN 'Hoy'
        WHEN a.created_at > NOW() - INTERVAL '48 hours' THEN 'Ayer'
        ELSE to_char(a.created_at, 'DD Mon YYYY')
    END AS tiempo_relativo,
    CASE a.tipo
        WHEN 'milestone'      THEN '🎯'
        WHEN 'seccion_baja'   THEN '⚠️'
        WHEN 'pico_encuestas' THEN '📈'
        WHEN 'cambio_semanal' THEN '📊'
        WHEN 'reconocimiento' THEN '👁️'
        WHEN 'encuestador'    THEN '👤'
    END AS icono
FROM alertas a
ORDER BY a.created_at DESC;

-- ── 6. Función: Marcar alertas como leídas ───────────────────
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
$$ LANGUAGE plpgsql;

-- ── 7. RLS ────────────────────────────────────────────────────
ALTER TABLE alertas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_alertas ENABLE ROW LEVEL SECURITY;

-- La RLS en campanas usa candidato_id, pero auth.uid() es el auth_user_id del candidato
-- JOIN correcto: campanas → candidatos → auth_user_id
DROP POLICY IF EXISTS alertas_candidato_select ON alertas;
CREATE POLICY alertas_candidato_select ON alertas
    FOR SELECT
    USING (
        campana_id IN (
            SELECT c.id FROM campanas c
            JOIN candidatos cand ON c.candidato_id = cand.id
            WHERE cand.auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS alertas_candidato_update ON alertas;
CREATE POLICY alertas_candidato_update ON alertas
    FOR UPDATE
    USING (
        campana_id IN (
            SELECT c.id FROM campanas c
            JOIN candidatos cand ON c.candidato_id = cand.id
            WHERE cand.auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        campana_id IN (
            SELECT c.id FROM campanas c
            JOIN candidatos cand ON c.candidato_id = cand.id
            WHERE cand.auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS config_alertas_candidato ON config_alertas;
CREATE POLICY config_alertas_candidato ON config_alertas
    FOR ALL
    USING (
        campana_id IN (
            SELECT c.id FROM campanas c
            JOIN candidatos cand ON c.candidato_id = cand.id
            WHERE cand.auth_user_id = auth.uid()
        )
    );

-- ── 8. Config por defecto (descomentar y reemplazar UUID) ────
/*
INSERT INTO config_alertas (campana_id, email_destino, whatsapp_destino)
VALUES (
    '<CAMPANA_UUID>',
    'coordinador@campaña.mx',
    '+522441234567'
);
*/

-- ═══════════════════════════════════════════════════════════
-- EDGE FUNCTION — supabase/functions/enviar-alerta/index.ts
-- ═══════════════════════════════════════════════════════════
/*
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: alertas } = await supabase
    .from("alertas")
    .select(`*, campanas!inner(*, candidatos!inner(auth_user_id))`)
    .eq("notificada", false)
    .order("created_at", { ascending: false })
    .limit(10);

  for (const alerta of alertas || []) {
    // Obtener config del destinatario
    const { data: config } = await supabase
      .from("config_alertas")
      .select("email_destino, whatsapp_destino")
      .eq("campana_id", alerta.campana_id)
      .single();

    if (!config) continue;

    if (config.email_destino) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "alertas@encuestadora.mx",
          to: config.email_destino,
          subject: alerta.titulo,
          html: `<h2>${alerta.titulo}</h2><p>${alerta.mensaje}</p>`,
        }),
      });
    }

    if (config.whatsapp_destino) {
      const sid = Deno.env.get("TWILIO_SID");
      const auth = Deno.env.get("TWILIO_AUTH");
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { "Authorization": "Basic " + btoa(`${sid}:${auth}`), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          From: "whatsapp:+14155238886",
          To: `whatsapp:${config.whatsapp_destino}`,
          Body: `${alerta.titulo}\n\n${alerta.mensaje}`,
        }),
      });
    }

    await supabase.from("alertas").update({ notificada: true }).eq("id", alerta.id);
  }

  return new Response(JSON.stringify({ processed: alertas?.length || 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
*/

-- ═══════════════════════════════════════════════════════════
-- CRON: Cada 5 minutos (requiere pg_cron en Supabase)
-- ═══════════════════════════════════════════════════════════
-- NOTA: Ejecutar manualmente en SQL Editor de Supabase:
-- SELECT cron.schedule('enviar-alertas', '*/5 * * * *', $$
--   SELECT net.http_post(
--     url := 'https://<PROJECT>.supabase.co/functions/v1/enviar-alerta',
--     headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
--   );
-- $$);

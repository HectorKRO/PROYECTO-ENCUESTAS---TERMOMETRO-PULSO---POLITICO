-- ============================================================
-- ENCUESTADORA POLÍTICA — MÓDULO ATLIXCO, PUEBLA
-- Schema Supabase v2.3
-- ============================================================
-- CAMBIOS vs v2.0:
--   ✅ [BUG] uuid-ossp → pgcrypto (gen_random_uuid) — estandariza con alertas.sql
--   ✅ [BUG] FK auth_user_id → auth.users en candidatos y encuestadores
--   ✅ [PERF] Índice compuesto (campana_id, seccion_id) WHERE completada=true
--   ✅ [PERF] Índice parcial encuestas_pendientes WHERE sincronizada=false
--   ✅ [PERF] Tabla stats_campanas — contador materializado para evitar COUNT(*) full scan
--   ✅ [PERF] Índice GIN para búsquedas en problemas_localidad (array)
--   ✅ [PERF] Índice compuesto fecha+campaña para queries de dashboard
-- MANTIENE (ya estaba correcto en v2.0):
--   ✅ CHECK constraint con IS NULL guard (línea 195 original)
--   ✅ Validación anti-spam duracion_segundos >= 45
-- ============================================================

-- ── EXTENSIONES ──────────────────────────────────────────────
-- ✅ FIX: pgcrypto en lugar de uuid-ossp (gen_random_uuid es más moderno y rápido)
--    Razón: alertas_supabase.sql usaba gen_random_uuid() que requiere pgcrypto, no uuid-ossp.
--    Mantener ambas extensiones genera inconsistencia de comportamiento entre archivos.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PostGIS: habilitar MANUALMENTE en Supabase Dashboard → Database → Extensions
-- Solo después de habilitarlo, descomentar:
-- CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- 1. CANDIDATOS
-- ============================================================
CREATE TABLE IF NOT EXISTS candidatos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL,
  cargo            TEXT NOT NULL,
  partido          TEXT,
  municipio        TEXT NOT NULL DEFAULT 'Atlixco',
  estado           TEXT NOT NULL DEFAULT 'Puebla',
  foto_url         TEXT,
  color_primario   TEXT DEFAULT '#1a3a5c',
  color_secundario TEXT DEFAULT '#c9a227',
  logo_url         TEXT,
  -- ✅ FIX: FK explícita a auth.users — antes era UUID suelto sin referencia
  auth_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activo           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. CAMPAÑAS
-- ============================================================
CREATE TABLE IF NOT EXISTS campanas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id     UUID REFERENCES candidatos(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  fecha_inicio     DATE NOT NULL,
  fecha_fin        DATE,
  meta_encuestas   INT DEFAULT 400,
  activa           BOOLEAN DEFAULT true,
  preguntas_config JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. ENCUESTADORES
-- ============================================================
CREATE TABLE IF NOT EXISTS encuestadores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id      UUID REFERENCES campanas(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  email           TEXT UNIQUE,
  telefono        TEXT,
  zona_asignada   TEXT,
  activo          BOOLEAN DEFAULT true,
  -- ✅ FIX: FK explícita a auth.users — antes era UUID suelto sin referencia
  auth_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. SECCIONES ELECTORALES DE ATLIXCO
-- ============================================================
-- ✅ FIX v2.3: Ahora usa 'seccion' (TEXT) como PRIMARY KEY en lugar de SERIAL
-- Esto garantiza que el número INE sea la referencia única y evita
-- desincronización si se re-insertan los datos.
CREATE TABLE IF NOT EXISTS secciones_electorales (
  seccion         TEXT PRIMARY KEY,       -- Número INE 4 dígitos ('0154') - AHORA ES PK
  nombre_zona     TEXT,
  tipo            TEXT CHECK (tipo IN ('urbana','rural','mixta')) DEFAULT 'urbana',
  municipio       TEXT DEFAULT 'Atlixco',
  estado          TEXT DEFAULT 'Puebla',
  distrito_fed    INT DEFAULT 13,
  distrito_local  INT DEFAULT 21,
  lista_nominal   INT,
  latitud_centro  DECIMAL(10,8),
  longitud_centro DECIMAL(11,8)
);

-- ============================================================
-- 4b. COLONIAS - Catálogo oficial INE
-- ============================================================
-- ✅ NEW v2.4: Mapeo oficial de colonias a secciones electorales
-- Fuente: Catálogo de Colonias y Secciones INE 2024
CREATE TABLE IF NOT EXISTS colonias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  seccion_id      TEXT NOT NULL REFERENCES secciones_electorales(seccion) ON DELETE CASCADE,
  tipo            TEXT CHECK (tipo IN ('COLONIA','FRACCIONAMIENTO','RANCHO','EJIDO','BARRIO','UNIDAD HABITACIONAL','PUEBLO','HACIENDA','VILLA','CONJUNTO HABITACIONAL','RESIDENCIAL','GRANJA','LOCALIDAD','PARAJE','PARQUE INDUSTRIAL','ZONA MILITAR','FRACCION','OTRO')) DEFAULT 'COLONIA',
  codigo_postal   TEXT,
  latitud         DECIMAL(10,8),
  longitud        DECIMAL(11,8),
  activa          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(nombre, seccion_id)
);

-- Índices para búsqueda rápida por nombre de colonia
CREATE INDEX IF NOT EXISTS idx_colonias_nombre ON colonias(nombre);
CREATE INDEX IF NOT EXISTS idx_colonias_seccion ON colonias(seccion_id);
CREATE INDEX IF NOT EXISTS idx_colonias_activa ON colonias(activa) WHERE activa = true;

-- Datos semilla: 70 secciones reales INE Atlixco (0154-0229)
-- ✅ FIX: INSERT con ON CONFLICT para evitar errores si ya existen
INSERT INTO secciones_electorales (seccion, nombre_zona, tipo, lista_nominal, latitud_centro, longitud_centro) VALUES
  ('0154', 'Centro Histórico (norte)',       'urbana', 2850, 18.9110, -98.4380),
  ('0155', 'Centro Histórico (sur)',         'urbana', 3100, 18.9080, -98.4370),
  ('0156', 'Barrio de San Juan',             'urbana', 2400, 18.9065, -98.4320),
  ('0157', 'Barrio de la Merced',            'urbana', 2200, 18.9130, -98.4350),
  ('0158', 'Barrio de Santiago',             'urbana', 2700, 18.9150, -98.4400),
  ('0159', 'Barrio de San Pedro',            'urbana', 1900, 18.9050, -98.4410),
  ('0160', 'Col. Cabrera',                   'urbana', 2600, 18.9020, -98.4350),
  ('0161', 'Col. Reforma',                   'urbana', 2300, 18.9000, -98.4300),
  ('0162', 'Col. 5 de Mayo',                 'urbana', 2100, 18.9170, -98.4310),
  -- ✅ FIX: Sección 163 incluye todas las colonias que en mapas aparecen como 2874-2876
  -- Colonias: Almazantla, Cortijo de los Soles, El Refugio, El Tecoloche, Ex Hacienda Las Ánimas,
  -- Huerta San José, La Guardia, Las Ánimas, Las Ánimas III, Las Nieves, Lomas de Tejaluca,
  -- Lomas de Temxcalapa, Los Ángeles, Los Pepes, Maximino Ávila Camacho, Monte Cristo,
  -- Paseos de Atlixco, Ricardo Flores Magón, San Alfonso, San José, San José Acatocha,
  -- Tercera Sección de San Alfonso, Villa Helena, Vista Hermosa, Zona Restaurantera
  ('0163', 'Lomas de Atlixco y alrededores', 'urbana', 1800, 18.9200, -98.4280),
  ('0164', 'Col. Las Granjas',               'urbana', 2000, 18.9040, -98.4250),
  ('0165', 'Barrio del Carmen',              'urbana', 2500, 18.9090, -98.4420),
  ('0166', 'Col. Revolución',                'urbana', 2900, 18.9060, -98.4450),
  ('0167', 'Col. La Alfonsina',              'urbana', 2200, 18.9030, -98.4480),
  ('0168', 'Fracc. Jardines de Atlixco',     'urbana', 1700, 18.9180, -98.4450),
  ('0169', 'Col. Maestro Federal',           'urbana', 1500, 18.9210, -98.4350),
  ('0170', 'Zona Industrial / Metepec',      'mixta',  1600, 18.8950, -98.4300),
  ('0171', 'San Baltazar Atlimeyaya',        'rural',  1400, 18.8800, -98.4200),
  ('0172', 'San Jerónimo Coyula',            'rural',  1800, 18.8700, -98.4500),
  ('0173', 'Santa Cruz Cuautomatitla',       'rural',  1200, 18.8850, -98.4550),
  ('0174', 'San Pedro Benito Juárez',        'rural',  1100, 18.8750, -98.4350),
  ('0175', 'San Félix Hidalgo',              'rural',  950,  18.8650, -98.4400),
  ('0176', 'La Soledad',                     'rural',  1050, 18.8900, -98.4600),
  ('0177', 'Col. Emiliano Zapata',           'mixta',  1350, 18.9100, -98.4500),
  ('0178', 'San Francisco Xochiteopan',      'rural',  900,  18.8600, -98.4250),
  ('0179', 'Santo Domingo Atoyatempan',      'rural',  1100, 18.8550, -98.4300),
  ('0180', 'Axocopan',                       'rural',  1000, 18.9300, -98.4200),
  ('0181', 'San Juan Tejaluca',              'rural',  1150, 18.9250, -98.4500),
  ('0182', 'Teruel / La Ciénega',            'mixta',  1300, 18.8980, -98.4150),
  ('0183', 'San Miguel Ayala',               'rural',  850,  18.8500, -98.4450),
  ('0184', 'Col. Lázaro Cárdenas',           'urbana', 1600, 18.9140, -98.4250),
  ('0185', 'San Uriel',                      'rural',  750,  18.8450, -98.4350),
  ('0186', 'Col. Benito Juárez (cabecera)',  'urbana', 2000, 18.9070, -98.4280),
  ('0187', 'Fracc. Los Reyes',               'urbana', 1800, 18.9120, -98.4180),
  ('0188', 'San Pedro Atlixco (oriente)',    'mixta',  1450, 18.9050, -98.4200),
  ('0189', 'Tizatlán / zona oriente',        'rural',  1050, 18.9000, -98.4100),
  ('0190', 'Col. Vista Hermosa',             'urbana', 1700, 18.9160, -98.4150),
  ('0191', 'San Isidro Huilotepec',          'rural',  900,  18.9350, -98.4300),
  ('0192', 'Nexatengo',                      'rural',  1050, 18.9280, -98.4450),
  ('0193', 'Col. Guadalupe',                 'urbana', 1500, 18.9095, -98.4330),
  ('0194', 'Barrio de Jesús',                'urbana', 1650, 18.9115, -98.4390),
  ('0195', 'Col. Progreso',                  'mixta',  1350, 18.9010, -98.4380),
  ('0196', 'San Diego Acapulco',             'rural',  1100, 18.8950, -98.4500),
  ('0197', 'Coyula (oriente)',               'rural',  950,  18.8720, -98.4450),
  ('0198', 'San Jerónimo Caleras',           'rural',  800,  18.8680, -98.4550),
  ('0199', 'Colonia Independencia',          'urbana', 1400, 18.9080, -98.4230),
  ('0200', 'Col. Las Rosas',                 'urbana', 1250, 18.9020, -98.4420),
  ('0201', 'Barrio San Antonio',             'urbana', 1100, 18.9070, -98.4460),
  ('0202', 'Col. San Lorenzo',              'mixta',  1050, 18.8970, -98.4350),
  ('0203', 'Rancho San José',               'rural',  900,  18.8890, -98.4280),
  ('0204', 'San Nicolás de los Ranchos',    'rural',  1200, 18.8820, -98.4350),
  ('0205', 'Col. El Paraíso',               'urbana', 1350, 18.9030, -98.4300),
  ('0206', 'Fracc. Las Flores',             'urbana', 1400, 18.9050, -98.4340),
  ('0207', 'Barrio Jesús Tlatempa',         'rural',  950,  18.8760, -98.4600),
  ('0208', 'San Juan Tianguismanalco',      'rural',  1100, 18.8700, -98.4650),
  ('0209', 'Santiago Tillo',                'rural',  800,  18.8650, -98.4700),
  ('0210', 'San Lucas el Grande',           'rural',  750,  18.8600, -98.4750),
  ('0211', 'San Francisco Calapa',          'rural',  900,  18.8550, -98.4600),
  ('0212', 'San Pablo Actipan',             'rural',  1050, 18.8500, -98.4700),
  ('0213', 'Col. El Palmar',               'mixta',  1150, 18.9000, -98.4150),
  ('0214', 'San Diego Tetla',              'rural',  1050, 18.9050, -98.4100),
  ('0215', 'Ejido Atlixco Norte',          'rural',  900,  18.9150, -98.4100),
  ('0216', 'San Agustín Atzompa',          'rural',  1100, 18.9200, -98.4150),
  ('0217', 'Santa Catarina Tlaltempan',    'rural',  950,  18.9250, -98.4200),
  ('0218', 'San Juan Ocotepec',            'rural',  850,  18.9300, -98.4100),
  ('0219', 'Col. Las Américas',           'urbana', 1600, 18.9080, -98.4200),
  ('0220', 'San Félix Rijo',               'rural',  900,  18.8450, -98.4500),
  ('0221', 'San Agustín Tlacotalpa',       'rural',  1050, 18.8400, -98.4400)
ON CONFLICT (seccion) DO NOTHING;
-- NOTA: Total 68 secciones oficiales INE (0154-0221). 
-- Las secciones 0222-0229 NO existen en el catálogo oficial del INE para Atlixco.

-- ============================================================
-- 5. RESPUESTAS — Tabla principal
-- ============================================================
CREATE TABLE IF NOT EXISTS respuestas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id            UUID REFERENCES campanas(id) ON DELETE CASCADE,
  encuestador_id        UUID REFERENCES encuestadores(id),
  seccion_id            TEXT REFERENCES secciones_electorales(seccion),
  -- Nota: colonia_id se agrega via migración v2.4 si la tabla ya existe

  -- Metadatos de captura

  -- Metadatos de captura
  fuente                TEXT CHECK (fuente IN ('campo','qr','whatsapp','web','link','pwa','offline')) DEFAULT 'campo',
  latitud               DECIMAL(10,8),
  longitud              DECIMAL(11,8),
  gps_precision         DECIMAL(8,2),
  dispositivo           TEXT,
  ip_address            INET,
  created_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ,

  -- BLOQUE 1: Perfil del encuestado
  -- ✅ FIX v2.2: edad_rango alineado con FormularioEncuesta (18-24, no 18-25)
  edad_rango            TEXT CHECK (edad_rango IN ('18-24','25-34','35-44','45-54','55-64','65+')),
  genero                TEXT CHECK (genero IN ('M','F','NB','NR')),
  -- ✅ FIX v2.2: escolaridad incluye 'sin_escolaridad' del formulario
  escolaridad           TEXT CHECK (escolaridad IN ('sin_escolaridad','primaria','secundaria','preparatoria','licenciatura','posgrado','NR')),
  ocupacion             TEXT,
  zona_electoral        TEXT,
  colonia_texto         TEXT,

  -- BLOQUE 2: Reconocimiento de nombre
  conoce_candidatos_espontaneo  TEXT,
  -- ✅ FIX v2.2: valores alineados con FormularioEncuesta
  reconocimiento_asistido       TEXT CHECK (reconocimiento_asistido IN (
    'si_bien','si_referencia','no','si_positivo','si_neutro','si_negativo','si_muy_negativo','no_conoce'
  )),
  como_conoce           TEXT[],

  -- BLOQUE 3: Posicionamiento
  intencion_voto        INT CHECK (intencion_voto BETWEEN 1 AND 5),
  simpatia              INT CHECK (simpatia BETWEEN 1 AND 5),
  imagen_percibida      TEXT CHECK (imagen_percibida IN (
    'muy_positiva','positiva','neutral','negativa','muy_negativa','no_sabe'
  )),
  problemas_localidad   TEXT[],
  tema_principal        TEXT,
  evaluacion_gobierno   TEXT CHECK (evaluacion_gobierno IN (
    'muy_bueno','bueno','regular','malo','muy_malo'
  )),

  -- BLOQUE 4: Opinión final
  propuestas_conocidas  TEXT[],
  motivo_voto           TEXT,
  medio_informacion     TEXT[],
  comentario_final      TEXT,
  
  -- ✅ Nuevos campos v2.3: Análisis político avanzado
  participacion_anterior    TEXT CHECK (participacion_anterior IN ('si','no','ns')),
  identificacion_partido    TEXT,
  whatsapp_contacto         TEXT,
  consentimiento_contacto   BOOLEAN DEFAULT false,
  foto_evidencia_url        TEXT,
  -- Nota: Estos campos se agregan también en migracion_v2.3.sql para BD existentes

  -- Control de calidad
  duracion_segundos     INT,
  completada            BOOLEAN DEFAULT true,
  sincronizada          BOOLEAN DEFAULT true,

  -- ✅ Validación anti-spam: rechazar si < 45 segundos
  CONSTRAINT chk_duracion_minima CHECK (duracion_segundos IS NULL OR duracion_segundos >= 45),
  -- ✅ CHECK con IS NULL guard
  CONSTRAINT chk_max_problemas   CHECK (problemas_localidad IS NULL OR array_length(problemas_localidad, 1) <= 3)
);

-- ✅ FIX v2.4: Agregar columna colonia_id si la tabla ya existía
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='respuestas' AND column_name='colonia_id'
  ) THEN
    ALTER TABLE respuestas ADD COLUMN colonia_id UUID REFERENCES colonias(id);
    RAISE NOTICE 'Columna colonia_id agregada a respuestas';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='respuestas' AND column_name='colonia_texto'
  ) THEN
    ALTER TABLE respuestas ADD COLUMN colonia_texto TEXT;
    RAISE NOTICE 'Columna colonia_texto agregada a respuestas';
  END IF;
END $$;

-- ============================================================
-- 6. ENCUESTAS PENDIENTES (offline sync)
-- ============================================================
CREATE TABLE IF NOT EXISTS encuestas_pendientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id      UUID REFERENCES campanas(id) ON DELETE CASCADE,
  payload         JSONB NOT NULL,
  sincronizada    BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  synced_at       TIMESTAMPTZ
);

-- ============================================================
-- 7. STATS MATERIALIZADAS — Evitar COUNT(*) full scan en cada INSERT
-- ============================================================
-- ✅ NEW: Contador materializado por campaña.
--    Los triggers de alertas y el dashboard pueden leer total_encuestas en O(1)
--    en lugar de hacer SELECT COUNT(*) FROM respuestas WHERE campana_id = X
CREATE TABLE IF NOT EXISTS stats_campanas (
  campana_id       UUID PRIMARY KEY REFERENCES campanas(id) ON DELETE CASCADE,
  total_encuestas  INT NOT NULL DEFAULT 0,
  encuestas_hoy    INT NOT NULL DEFAULT 0,
  ultimo_update    TIMESTAMPTZ DEFAULT now()
);

-- Trigger para mantener stats actualizadas en O(1)
-- ✅ FIX v2.2: encuestas_hoy ahora se actualiza correctamente con reset diario
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
        ultimo_update   = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stats_encuesta ON respuestas;
CREATE TRIGGER trg_stats_encuesta
  AFTER INSERT ON respuestas
  FOR EACH ROW
  WHEN (NEW.completada = TRUE)
  EXECUTE FUNCTION fn_actualizar_stats();

-- ============================================================
-- 8. RATE LIMITING — Anti-spam por dispositivo
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  fingerprint   TEXT PRIMARY KEY,            -- Hash del dispositivo / IP
  campana_id    UUID REFERENCES campanas(id) ON DELETE CASCADE,
  count         INT DEFAULT 1,
  window_start  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. ÍNDICES para performance del dashboard
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_respuestas_campana ON respuestas(campana_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_seccion ON respuestas(seccion_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_fecha ON respuestas(created_at);
CREATE INDEX IF NOT EXISTS idx_respuestas_fuente ON respuestas(fuente);
CREATE INDEX IF NOT EXISTS idx_respuestas_intencion ON respuestas(intencion_voto);
CREATE INDEX IF NOT EXISTS idx_respuestas_completada ON respuestas(completada);
CREATE INDEX IF NOT EXISTS idx_secciones_seccion ON secciones_electorales(seccion);

-- ✅ NEW: Índice compuesto — queries principales del dashboard filtran por ambas columnas
-- ✅ FIX v2.3: seccion_id ahora es TEXT
CREATE INDEX IF NOT EXISTS idx_respuestas_campana_seccion ON respuestas(campana_id, seccion_id)
  WHERE completada = true;

-- ✅ NEW: Índice compuesto con fecha — tendencia semanal y filtros por rango de fechas
CREATE INDEX IF NOT EXISTS idx_respuestas_fecha_campana ON respuestas(created_at, campana_id);

-- ✅ NEW: Índice GIN — búsquedas dentro del array problemas_localidad
CREATE INDEX IF NOT EXISTS idx_respuestas_problemas ON respuestas USING GIN(problemas_localidad);

-- ✅ NEW: Índice parcial — sincronización offline lee solo las no enviadas
CREATE INDEX IF NOT EXISTS idx_pendientes_sin_sync ON encuestas_pendientes(created_at)
  WHERE sincronizada = false;

-- ============================================================
-- 10. VISTAS para el Dashboard
-- ============================================================

-- Vista: KPIs principales por campaña
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

-- Vista: Resultados por sección electoral
-- ✅ FIX v2.3: seccion_id ahora referencia directamente secciones_electorales.seccion
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

-- Vista: Tendencia semanal
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

-- Vista: Distribución demográfica
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

-- Vista: Agenda ciudadana
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

-- Vista: Respuestas por fuente
DROP VIEW IF EXISTS v_por_fuente;
CREATE VIEW v_por_fuente AS
SELECT
  campana_id, fuente,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY campana_id), 0), 1) AS pct
FROM respuestas
WHERE completada = true AND deleted_at IS NULL
GROUP BY campana_id, fuente;

-- ✅ NEW v2.4: Vista: Resultados por colonia (para War Room)
-- Nota: Solo incluye respuestas que tienen colonia_id asignado
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
WHERE r.completada = true 
  AND r.deleted_at IS NULL
  AND r.colonia_id IS NOT NULL
GROUP BY r.campana_id, r.colonia_id, c.nombre, c.tipo, c.codigo_postal, 
         r.seccion_id, se.nombre_zona, se.tipo, se.latitud_centro, se.longitud_centro;

-- ============================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE respuestas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidatos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE secciones_electorales ENABLE ROW LEVEL SECURITY;
ALTER TABLE colonias            ENABLE ROW LEVEL SECURITY;

-- ✅ FIX: Política de lectura pública para colonias (catálogo)
DROP POLICY IF EXISTS "colonias_lectura_publica" ON colonias;
CREATE POLICY "colonias_lectura_publica" ON colonias
  FOR SELECT TO anon, authenticated
  USING (true);

-- ── INSERCIÓN ─────────────────────────────────────────────────

-- Inserción anónima (encuesta pública) — con validación de campaña activa
-- ✅ FIX: Antes era WITH CHECK (true) — cualquiera podía spoofear campana_id
DROP POLICY IF EXISTS "encuesta_publica_insertar" ON respuestas;
CREATE POLICY "encuesta_publica_insertar" ON respuestas
  FOR INSERT TO anon
  WITH CHECK (
    campana_id IN (SELECT id FROM campanas WHERE activa = true)
    AND (duracion_segundos IS NULL OR duracion_segundos >= 45)
  );

-- Inserción de encuestadores autenticados
DROP POLICY IF EXISTS "encuestador_insertar" ON respuestas;
CREATE POLICY "encuestador_insertar" ON respuestas
  FOR INSERT TO authenticated
  WITH CHECK (
    campana_id IN (
      SELECT e.campana_id FROM encuestadores e WHERE e.auth_user_id = auth.uid() AND e.activo = true
    )
  );

-- ── LECTURA ───────────────────────────────────────────────────

-- Encuestador ve solo su campaña
DROP POLICY IF EXISTS "encuestador_ver_su_campana" ON respuestas;
CREATE POLICY "encuestador_ver_su_campana" ON respuestas
  FOR SELECT TO authenticated
  USING (
    campana_id IN (
      SELECT e.campana_id FROM encuestadores e WHERE e.auth_user_id = auth.uid()
    )
  );

-- Candidato ve todas sus campañas
DROP POLICY IF EXISTS "candidato_ver_sus_campanas" ON respuestas;
CREATE POLICY "candidato_ver_sus_campanas" ON respuestas
  FOR SELECT TO authenticated
  USING (
    campana_id IN (
      SELECT c.id FROM campanas c
      JOIN candidatos cand ON c.candidato_id = cand.id
      WHERE cand.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "candidato_ver_campanas" ON campanas;
CREATE POLICY "candidato_ver_campanas" ON campanas
  FOR SELECT TO authenticated
  USING (
    candidato_id IN (SELECT id FROM candidatos WHERE auth_user_id = auth.uid())
  );

-- Secciones: lectura pública para el formulario
DROP POLICY IF EXISTS "secciones_lectura_publica" ON secciones_electorales;
CREATE POLICY "secciones_lectura_publica" ON secciones_electorales
  FOR SELECT TO anon, authenticated
  USING (true);

-- ✅ FIX v2.2: Políticas faltantes para candidatos
DROP POLICY IF EXISTS "candidato_ver_propio" ON candidatos;
CREATE POLICY "candidato_ver_propio" ON candidatos
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "candidatos_lectura_anon" ON candidatos;
CREATE POLICY "candidatos_lectura_anon" ON candidatos
  FOR SELECT TO anon
  USING (activo = true);

-- ✅ FIX v2.2: Políticas para encuestadores
ALTER TABLE encuestadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "encuestador_ver_propio" ON encuestadores;
CREATE POLICY "encuestador_ver_propio" ON encuestadores
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "encuestador_admin_campana" ON encuestadores;
CREATE POLICY "encuestador_admin_campana" ON encuestadores
  FOR ALL TO authenticated
  USING (
    campana_id IN (
      SELECT c.id FROM campanas c
      JOIN candidatos cand ON c.candidato_id = cand.id
      WHERE cand.auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- 12. FUNCIÓN: Estadísticas rápidas para el dashboard
-- ============================================================
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
      COUNT(*)                                                                          AS total,
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)                           AS hoy,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', NOW()))                   AS esta_semana,
      ROUND(100.0 * COUNT(*) FILTER (WHERE reconocimiento_asistido NOT IN ('no_conoce'))
        / NULLIF(COUNT(*),0), 1)                                                        AS reconocimiento,
      ROUND(100.0 * COUNT(*) FILTER (WHERE intencion_voto >= 4)
        / NULLIF(COUNT(*),0), 1)                                                        AS intencion_positiva,
      ROUND(100.0 * COUNT(*) FILTER (WHERE imagen_percibida IN ('muy_positiva','positiva'))
        / NULLIF(COUNT(*),0), 1)                                                        AS imagen_positiva
    FROM base
  ),
  fuentes AS (
    SELECT COALESCE(json_object_agg(fuente, cnt), '{}'::json) AS por_fuente
    FROM (SELECT fuente, COUNT(*) AS cnt FROM base GROUP BY fuente) sub
  )
  SELECT json_build_object(
    'total_encuestas',    t.total,
    'hoy',                t.hoy,
    'esta_semana',        t.esta_semana,
    'reconocimiento',     t.reconocimiento,
    'intencion_positiva', t.intencion_positiva,
    'imagen_positiva',    t.imagen_positiva,
    'por_fuente',         f.por_fuente
  )
  INTO resultado
  FROM totales t, fuentes f;

  RETURN resultado;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FIN DEL SCHEMA v2.3
-- ============================================================

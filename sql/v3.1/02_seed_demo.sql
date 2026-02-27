-- ============================================================
-- V3.1: DATOS DEMO — CAMPAÑA PACO GARCÍA 2025
-- ============================================================
-- Versión: v3.1
-- Fecha: 2026-02-27
--
-- PROPÓSITO:
--   Poblar la base de datos con datos realistas para demostrar
--   la plataforma a clientes. No usar en producción real.
--
-- PRERREQUISITOS:
--   - 01_campanas_multitenant.sql ejecutado
--   - 07_setup_superadmin.sql ejecutado (organización legacy existe)
--
-- SEGURO DE RE-EJECUTAR: usa ON CONFLICT DO NOTHING en todo
-- ============================================================

-- UUIDs fijos para referencia estable entre re-ejecuciones
-- Candidato principal
DO $$ BEGIN
  PERFORM 1 FROM candidatos WHERE id = 'a1000000-0000-0000-0000-000000000001'::UUID;
  IF NOT FOUND THEN
    INSERT INTO candidatos (
      id, organizacion_id, nombre, cargo, partido,
      municipio, color_primario, activo
    ) VALUES (
      'a1000000-0000-0000-0000-000000000001'::UUID,
      '00000000-0000-0000-0000-000000000001'::UUID,
      'Francisco García Hernández',
      'Presidente Municipal',
      'MORENA',
      'Atlixco',
      '#c9a227',
      true
    );
    RAISE NOTICE '✅ Candidato principal creado: Francisco García Hernández';
  ELSE
    RAISE NOTICE 'ℹ️  Candidato principal ya existe, omitiendo.';
  END IF;
END $$;

-- ============================================================
-- 2. CAMPAÑA DEMO
-- ============================================================
DO $$ BEGIN
  PERFORM 1 FROM campanas WHERE id = 'b2000000-0000-0000-0000-000000000001'::UUID;
  IF NOT FOUND THEN
    INSERT INTO campanas (
      id, nombre, candidato_id, organizacion_id,
      municipio_id, fecha_inicio, meta_encuestas, activa
    ) VALUES (
      'b2000000-0000-0000-0000-000000000001'::UUID,
      'Paco García 2025',
      'a1000000-0000-0000-0000-000000000001'::UUID,
      '00000000-0000-0000-0000-000000000001'::UUID,
      1,  -- Atlixco
      '2025-01-15',
      400,
      true
    );
    RAISE NOTICE '✅ Campaña demo creada: Paco García 2025';
  ELSE
    RAISE NOTICE 'ℹ️  Campaña demo ya existe, omitiendo.';
  END IF;
END $$;

-- ============================================================
-- 3. ENCUESTADORES DEMO
-- ============================================================
DO $$ BEGIN
  -- Encuestador 1
  INSERT INTO encuestadores (id, nombre, email, campana_id, activo, encuestas)
  VALUES (
    'c3000000-0000-0000-0000-000000000001'::UUID,
    'María González López',
    'maria.gonzalez@demo.pulsoelectoral.mx',
    'b2000000-0000-0000-0000-000000000001'::UUID,
    true,
    47
  ) ON CONFLICT (id) DO NOTHING;

  -- Encuestador 2
  INSERT INTO encuestadores (id, nombre, email, campana_id, activo, encuestas)
  VALUES (
    'c3000000-0000-0000-0000-000000000002'::UUID,
    'Carlos Ramírez Flores',
    'carlos.ramirez@demo.pulsoelectoral.mx',
    'b2000000-0000-0000-0000-000000000001'::UUID,
    true,
    63
  ) ON CONFLICT (id) DO NOTHING;

  -- Encuestador 3
  INSERT INTO encuestadores (id, nombre, email, campana_id, activo, encuestas)
  VALUES (
    'c3000000-0000-0000-0000-000000000003'::UUID,
    'Ana Pérez Mendoza',
    'ana.perez@demo.pulsoelectoral.mx',
    'b2000000-0000-0000-0000-000000000001'::UUID,
    false,
    12
  ) ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '✅ 3 encuestadores demo creados';
END $$;

-- ============================================================
-- 4. CANDIDATOS RIVALES DEMO
-- ============================================================
DO $$ BEGIN
  INSERT INTO candidatos_rivales (id, organizacion_id, campana_id, nombre, partido, cargo, activo, orden)
  VALUES
    (
      'd4000000-0000-0000-0000-000000000001'::UUID,
      '00000000-0000-0000-0000-000000000001'::UUID,
      'b2000000-0000-0000-0000-000000000001'::UUID,
      'Roberto Hernández Soto',
      'PAN',
      'Candidato a Presidente Municipal',
      true,
      1
    ),
    (
      'd4000000-0000-0000-0000-000000000002'::UUID,
      '00000000-0000-0000-0000-000000000001'::UUID,
      'b2000000-0000-0000-0000-000000000001'::UUID,
      'Laura Méndez Torres',
      'PRI',
      'Candidata a Presidente Municipal',
      true,
      2
    ),
    (
      'd4000000-0000-0000-0000-000000000003'::UUID,
      '00000000-0000-0000-0000-000000000001'::UUID,
      'b2000000-0000-0000-0000-000000000001'::UUID,
      'Jorge Castillo Vega',
      'MC',
      'Candidato a Presidente Municipal',
      true,
      3
    ),
    (
      'd4000000-0000-0000-0000-000000000004'::UUID,
      '00000000-0000-0000-0000-000000000001'::UUID,
      'b2000000-0000-0000-0000-000000000001'::UUID,
      'Patricia Ruiz Morales',
      'PRD',
      'Candidata a Presidente Municipal',
      false,
      4
    )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '✅ 4 candidatos rivales demo creados (3 activos)';
END $$;

-- ============================================================
-- 5. VALIDACIÓN FINAL
-- ============================================================
DO $$
DECLARE
  v_campanas   INT;
  v_candidatos INT;
  v_encuestadores INT;
  v_rivales    INT;
BEGIN
  SELECT COUNT(*) INTO v_campanas      FROM campanas       WHERE organizacion_id = '00000000-0000-0000-0000-000000000001'::UUID;
  SELECT COUNT(*) INTO v_candidatos    FROM candidatos     WHERE organizacion_id = '00000000-0000-0000-0000-000000000001'::UUID;
  SELECT COUNT(*) INTO v_encuestadores FROM encuestadores  WHERE campana_id = 'b2000000-0000-0000-0000-000000000001'::UUID;
  SELECT COUNT(*) INTO v_rivales       FROM candidatos_rivales WHERE organizacion_id = '00000000-0000-0000-0000-000000000001'::UUID;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '✅ SEED DEMO COMPLETADO';
  RAISE NOTICE '   Campañas:            %', v_campanas;
  RAISE NOTICE '   Candidatos:          %', v_candidatos;
  RAISE NOTICE '   Encuestadores:       %', v_encuestadores;
  RAISE NOTICE '   Candidatos rivales:  %', v_rivales;
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Para probar: ve a /admin → selecciona "Paco García 2025"';
END $$;

-- ============================================================
-- FIN SEED DEMO V3.1
-- ============================================================

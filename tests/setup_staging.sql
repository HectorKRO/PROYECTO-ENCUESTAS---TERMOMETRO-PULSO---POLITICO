-- ============================================================================
-- SETUP AMBIENTE STAGING v3.0
-- Crea usuarios de prueba y datos mínimos para validación multi-tenant
-- Ejecutar en proyecto Supabase de staging (NO en producción)
-- ============================================================================
-- NOTA: Ejecutar este script en el SQL Editor de Supabase (no usa \echo)
-- ============================================================================

-- ============================================================================
-- 1. CREAR ORGANIZACIONES DE PRUEBA
-- ============================================================================

-- Organización 1: Partido Verde Demo
INSERT INTO organizaciones (id, nombre, tipo, plan, activa, created_at)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Partido Verde Demo',
    'partido',
    'basico',
    true,
    NOW()
)
ON CONFLICT (id) DO UPDATE SET 
    nombre = EXCLUDED.nombre,
    activa = true;

-- Organización 2: Movimiento Ciudadano Demo
INSERT INTO organizaciones (id, nombre, tipo, plan, activa, created_at)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    'Movimiento Ciudadano Demo',
    'candidato',
    'profesional',  -- FIX S2: 'pro' -> 'profesional'
    true,
    NOW()
)
ON CONFLICT (id) DO UPDATE SET 
    nombre = EXCLUDED.nombre,
    activa = true;

-- ============================================================================
-- 2. ASIGNAR MUNICIPIOS A ORGANIZACIONES (sin columna activo - FIX S1)
-- ============================================================================

-- FIX S3: Solo Atlixco (municipio_id = 1) que sí existe
-- Partido Verde: Solo Atlixco (quitar San Martín hasta tener sus datos)
INSERT INTO organizacion_municipios (organizacion_id, municipio_id)
VALUES 
    ('22222222-2222-2222-2222-222222222222', 1)
ON CONFLICT (organizacion_id, municipio_id) DO NOTHING;

-- Movimiento Ciudadano: Solo Atlixco
INSERT INTO organizacion_municipios (organizacion_id, municipio_id)
VALUES 
    ('33333333-3333-3333-3333-333333333333', 1)
ON CONFLICT (organizacion_id, municipio_id) DO NOTHING;

-- ============================================================================
-- 3. CREAR CAMPANAS DE PRUEBA (con UUIDs fijos - FIX S5)
-- ============================================================================

INSERT INTO campanas (
    id, organizacion_id, municipio_id, nombre, 
    fecha_inicio, fecha_fin, activa, meta_encuestas
) VALUES 
    -- Partido Verde en Atlixco (UUID fijo)
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        '22222222-2222-2222-2222-222222222222',
        1,
        'Campaña Atlixco PV 2024',
        '2024-01-01', '2024-06-30', true, 1000
    ),
    -- Movimiento Ciudadano en Atlixco (UUID fijo)
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        '33333333-3333-3333-3333-333333333333',
        1,
        'Campaña Atlixco MC 2024',
        '2024-01-01', '2024-06-30', true, 800
    )
ON CONFLICT (id) DO UPDATE SET 
    nombre = EXCLUDED.nombre,
    activa = EXCLUDED.activa;

-- ============================================================================
-- 4. INSTRUCCIONES PARA CREAR USUARIOS EN AUTH
-- ============================================================================
/*
INSTRUCCIONES MANUALES (ejecutar en Supabase Dashboard):

1. Ve a Authentication > Users > Add User

2. Crear Usuario 1: Héctor (Superadmin)
   - Email: hector@pulsodemo.com
   - Password: (generar contraseña segura de 16+ caracteres)
   - User Metadata: {"rol": "superadmin"}
   - Guardar contraseña en gestor de secretos

3. Crear Usuario 2: Paco (Admin Org1)
   - Email: paco@pulsodemo.com
   - Password: (generar contraseña segura de 16+ caracteres)
   - User Metadata: {"rol": "admin"}
   - Guardar contraseña en gestor de secretos

4. Crear Usuario 3: Tester (Analista Org2)
   - Email: tester@pulsodemo.com
   - Password: (generar contraseña segura de 16+ caracteres)
   - User Metadata: {"rol": "analista"}
   - Guardar contraseña en gestor de secretos

5. Después de crear cada usuario, copia su UUID (auth.users.id)

6. Reemplaza <UUID-XXXX> en la sección 5 con los UUIDs reales
*/

-- ============================================================================
-- 5. ASIGNAR MEMBRESÍAS (ejecutar después de crear usuarios en Auth)
-- ============================================================================
/*
-- Descomentar y reemplazar <UUID-XXXX> con los valores reales:

-- Héctor - Superadmin en ambas organizaciones
INSERT INTO organizacion_miembros (organizacion_id, user_id, rol, activo)
VALUES 
    ('22222222-2222-2222-2222-222222222222', '<UUID-HECTOR>', 'superadmin', true),
    ('33333333-3333-3333-3333-333333333333', '<UUID-HECTOR>', 'superadmin', true)
ON CONFLICT (organizacion_id, user_id) DO UPDATE SET rol = 'superadmin', activo = true;

-- Paco - Admin en Partido Verde
INSERT INTO organizacion_miembros (organizacion_id, user_id, rol, activo)
VALUES 
    ('22222222-2222-2222-2222-222222222222', '<UUID-PACO>', 'admin', true)
ON CONFLICT (organizacion_id, user_id) DO UPDATE SET rol = 'admin', activo = true;

-- Tester - Analista en Movimiento Ciudadano
INSERT INTO organizacion_miembros (organizacion_id, user_id, rol, activo)
VALUES 
    ('33333333-3333-3333-3333-333333333333', '<UUID-TESTER>', 'analista', true)
ON CONFLICT (organizacion_id, user_id) DO UPDATE SET rol = 'analista', activo = true;
*/

-- ============================================================================
-- 6. VERIFICACIÓN DE SETUP
-- ============================================================================

-- Mostrar organizaciones creadas
SELECT 
    o.id,
    o.nombre,
    o.tipo,
    COUNT(DISTINCT om.municipio_id) as municipios,
    COUNT(DISTINCT c.id) as campanas
FROM organizaciones o
LEFT JOIN organizacion_municipios om ON o.id = om.organizacion_id
LEFT JOIN campanas c ON o.id = c.organizacion_id AND c.activa = true
WHERE o.id IN (
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
)
GROUP BY o.id, o.nombre, o.tipo;

-- ============================================================================
-- RESUMEN
-- ============================================================================
/*
SETUP STAGING COMPLETADO (parcialmente)

Próximos pasos manuales:
1. Crear los 3 usuarios en Supabase Auth (instrucciones arriba)
2. Copiar los UUIDs de los usuarios creados
3. Descomentar y ejecutar la sección 5 con los UUIDs reales
4. Ejecutar tests/v3.0_validate.sql para validar

Datos creados:
- 2 organizaciones de prueba (Partido Verde, Movimiento Ciudadano)
- 1 municipio asignado por organización (Atlixco)
- 2 campañas de prueba con UUIDs fijos

Nota: San Martín Texmelucan se agregará cuando se ejecute el template
06_template_nuevo_municipio.sql con los datos reales del municipio.
*/

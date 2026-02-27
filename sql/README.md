# 📋 Guía de Instalación SQL - PulsoElectoral v3.0

## Nuevo en v3.0 — Multi-municipio / Multi-tenant

La versión 3.0 introduce soporte para múltiples organizaciones y múltiples municipios por organización.

---

## 🚀 Instalación Limpia (Base de datos vacía)

Ejecutar en orden en el SQL Editor de Supabase:

```sql
-- 1. Catálogo geográfico (municipios, secciones, colonias)
\i sql/v3.0/01_catalogo_geografico.sql

-- 2. Organizaciones, usuarios, membresías (multi-tenant)
\i sql/v3.0/02_organizaciones.sql

-- 3. Tabla respuestas con campos de contexto (municipio_id, organizacion_id)
\i sql/v3.0/03_respuestas_contexto.sql

-- 4. Políticas RLS unificadas con AND explícito
\i sql/v3.0/04_rls_unificado.sql

-- 5. Vistas corregidas para multi-municipio
\i sql/v3.0/05_vistas_corregidas.sql

-- 6. (Opcional) Template para agregar nuevo municipio
\i sql/v3.0/06_template_nuevo_municipio.sql
```

**Nota:** El comando `\i` solo funciona en psql CLI. En el SQL Editor web de Supabase, copiar y pegar el contenido de cada archivo.

---

## ✅ Validación Post-Instalación

```sql
-- Ejecutar tests de validación
\i tests/v3.0_validate.sql
```

Resultado esperado: **✅ TODOS LOS TESTS PASARON (11/11)**

---

## 🧪 Setup de Staging/Desarrollo

```sql
-- Crear usuarios de prueba y organizaciones demo
\i tests/setup_staging.sql
```

---

## 📊 Estructura de Datos v3.0

```
organizaciones (N)
  └── organizacion_miembros (N usuarios)
  └── organizacion_municipios (N municipios)
  
municipios (1)
  └── secciones_electorales (N)
  └── colonias (N)
  
campanas (N por organización)
  └── respuestas (N, con municipio_id y organizacion_id)
```

---

## 🔐 Seguridad RLS v3.0

Todas las tablas tienen Row Level Security activado:

- **organizacion_miembros**: Aislamiento por organización
- **organizacion_municipios**: Aislamiento por organización
- **campanas**: Aislamiento por organización
- **respuestas**: Aislamiento por organización + por municipio según membresía

---

## 📁 Scripts Opcionales

| Script | Descripción |
|--------|-------------|
| `sql/optional/alertas_supabase.sql` | Sistema de alertas automáticas (feature avanzado) |

---

## 📁 Scripts Históricos (v2.x)

Los scripts de versiones anteriores están en `sql/historico/` para referencia.


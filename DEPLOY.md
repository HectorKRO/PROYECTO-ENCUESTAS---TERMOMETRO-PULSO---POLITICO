# 🗳️ PulsoElectoral — Guía de Deploy v3.0
## Plataforma de Encuestas· Atlixco, Puebla

---

## VERSIÓN 3.0 (REFINADA)

| Módulo | Archivo | Estado |
|---|---|---|
| Landing page SaaS | `src/app/page.jsx` | ✅ Nuevo |
| Login con Magic Link | `src/app/login/page.jsx` | ✅ Nuevo |
| Formulario de campo (PWA) | `src/components/FormularioEncuesta.jsx` | ✅ Actualizado |
| Dashboard ejecutivo | `src/components/DashboardPolitico.jsx` | ✅ Actualizado |
| Panel de administración | `src/components/AdminPanel.jsx` | ✅ Integrado |
| Análisis de sentimiento | `src/components/AnalisisSentimiento.jsx` | ✅ Integrado |
| Exportación PDF | `src/components/ReportePDF.jsx` | ✅ Integrado |
| Supabase client unificado | `src/lib/supabase.js` | ✅ Nuevo |
| API sync offline | `src/app/api/sync-offline/route.js` | ✅ Nuevo |
| Schema SQL completo | `sql/schema.sql` | ✅ Actualizado |
| GeoJSON Atlixco | `public/atlixco_secciones.geojson` | ✅ |
| PWA manifest + SW | `public/manifest.json` | ✅ |

---

## ESTRUCTURA DEL PROYECTO

```
encuestadora-saas/
├── src/
│   ├── app/
│   │   ├── page.jsx                ← Landing page SaaS (nuevo)
│   │   ├── layout.jsx              ← Layout global con fuentes
│   │   ├── globals.css             ← Estilos globales + variables CSS
│   │   ├── login/page.jsx          ← Login Magic Link
│   │   ├── encuesta/page.jsx       ← Formulario de campo
│   │   ├── dashboard/page.jsx      ← Dashboard ejecutivo
│   │   ├── admin/page.jsx          ← Panel de administración
│   │   └── api/
│   │       └── sync-offline/route.js  ← Sync de encuestas offline
│   ├── components/
│   │   ├── FormularioEncuesta.jsx  ← App de captura (Supabase integrado)
│   │   ├── DashboardPolitico.jsx   ← Dashboard (datos reales + demo)
│   │   ├── AdminPanel.jsx          ← Gestión de campañas
│   │   ├── AnalisisSentimiento.jsx ← Análisis de comentarios
│   │   └── ReportePDF.jsx          ← Exportación ejecutiva
│   └── lib/
│       └── supabase.js             ← Cliente unificado + helpers
├── sql/
│   ├── schema.sql                  ← Schema completo (ejecutar en Supabase)
│   └── alertas_supabase.sql        ← Triggers y alertas
├── public/
│   ├── atlixco_secciones.geojson   ← Polígonos electorales Atlixco
│   ├── manifest.json               ← PWA config
│   └── service-worker.js           ← Offline support
├── .env.example                    ← Variables de entorno (copiar a .env.local)
├── next.config.mjs
└── package.json                    ← Next.js 15 + todas las dependencias
```

---

## PASO 1 — Clonar y configurar

```bash
# En tu máquina (o desde el ZIP descargado)
cd encuestadora-saas
npm install
cp .env.example .env.local
# Editar .env.local con tus credenciales (ver Paso 2)
```

---

## PASO 2 — Supabase

### 2a. Crear proyecto
1. **https://supabase.com** → New Project
2. Nombre: `pulsoelectoral` · Región: **South America (São Paulo)**
3. Guardar la contraseña de DB

### 2b. Habilitar PostGIS
- Dashboard → Database → Extensions → buscar `postgis` → **Enable**

### 2c. Ejecutar schema
- SQL Editor → pegar `sql/schema.sql` → Run
- Verificar tablas: `candidatos`, `campanas`, `encuestadores`, `secciones_electorales`, `respuestas`

### 2d. Ejecutar alertas (opcional)
- SQL Editor → pegar `sql/alertas_supabase.sql` → Run

### 2e. Guardar credenciales en `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
NEXT_PUBLIC_DEMO_MODE=false
```

---

## PASO 3 — Modo demo (sin Supabase)

Para la demo con clientes potenciales, **no necesitas Supabase**:

```env
NEXT_PUBLIC_DEMO_MODE=true
```

Con `DEMO_MODE=true`:
- El dashboard muestra datos mock realistas (347 encuestas, 5 semanas)
- El formulario simula envío sin conectar a DB
- El login redirige directamente sin verificar email
- Todas las rutas funcionan sin credenciales

---

## PASO 4 — Levantar localmente

```bash
npm run dev
# Abrir http://localhost:3000
```

Rutas disponibles:
```
/                   → Landing page (muestra el producto)
/login              → Login con Magic Link o acceso demo
/encuesta?demo=true → Formulario de campo (modo demo)
/dashboard          → Dashboard ejecutivo (modo demo)
/admin              → Panel de administración
```

---

## PASO 5 — Deploy en Vercel

```bash
# Opción A: desde CLI
npm i -g vercel
vercel

# Opción B: desde GitHub
# 1. git push a tu repo
# 2. Conectar repo en vercel.com
# 3. Agregar variables de entorno en Vercel Dashboard
```

**Variables de entorno en Vercel:**
```
NEXT_PUBLIC_SUPABASE_URL = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
NEXT_PUBLIC_APP_URL = https://tu-app.vercel.app
NEXT_PUBLIC_DEMO_MODE = false   ← cambiar a false cuando tengas Supabase
```

---

## PASO 6 — Configurar primer cliente (candidato)

### Insertar candidato en Supabase
```sql
-- ✅ FIX v3.1: columnas alineadas con schema.sql v2.2
INSERT INTO candidatos (nombre, cargo, partido, municipio, color_primario, color_secundario)
VALUES ('Juan Francisco García Martínez', 'Presidente Municipal', 'Independiente', 'Atlixco', '#c9a227', '#2d7a3a')
RETURNING id;
-- Guarda el id del candidato
```

### Crear campaña
```sql
INSERT INTO campanas (candidato_id, nombre, fecha_inicio, fecha_fin, meta_encuestas)
VALUES ('<candidato_id>', 'Campaña Municipal 2025', '2025-01-01', '2025-06-01', 400)
RETURNING id;
-- Guarda el campana_id
```

### URLs para el candidato
```
# Dashboard del candidato:
https://tu-app.vercel.app/dashboard?campana=<campana_id>

# Encuesta desde campo:
https://tu-app.vercel.app/encuesta?campana=<campana_id>&candidato=Paco%20García&fuente=campo

# Encuesta desde QR en evento:
https://tu-app.vercel.app/encuesta?campana=<campana_id>&candidato=Paco%20García&fuente=qr

# Encuesta por WhatsApp:
https://tu-app.vercel.app/encuesta?campana=<campana_id>&candidato=Paco%20García&fuente=whatsapp
```

---

## PASO 7 — Autenticación de encuestadores

Para trackear qué encuestador capturó cada encuesta:

1. **Crear usuarios encuestadores en Supabase Auth:**
   - Authentication → Users → Invite User → email del encuestador
   
2. **El encuestador recibe un magic link** → hace login
   
3. **La URL de la encuesta detecta su sesión automáticamente** y registra `encuestador_id`

4. **Para acceso rápido en campo**, puedes usar el login rápido:
   ```
   https://tu-app.vercel.app/login → seleccionar "Encuestador" → magic link
   ```

---

## PASO 8 — PWA para encuestadores

Para instalar la app en el teléfono del encuestador:

1. Abrir `/encuesta` en Chrome (Android) o Safari (iOS)
2. En Chrome: menú → "Agregar a pantalla de inicio"
3. En Safari: botón compartir → "Agregar a pantalla de inicio"
4. La app funciona **offline** — las encuestas se guardan en `localStorage`
5. Al recuperar señal, se **sincronizan automáticamente** a Supabase

---

## COSTOS TOTALES

| Servicio | Plan | Costo mensual |
|---|---|---|
| Supabase | Free (500MB, 50K req/mes) | $0 |
| Vercel | Free (hobby) | $0 |
| Dominio .mx | Anual ÷ 12 | ~$17 MXN/mes |
| Google Fonts | CDN gratis | $0 |
| GeoJSON INE | Datos públicos | $0 |
| **TOTAL** | | **~$17 MXN/mes** |

Para producción con múltiples clientes:
- Supabase Pro: $25 USD/mes (8GB DB, 5M req/mes)
- Vercel Pro: $20 USD/mes (builds ilimitados)

---

## FLUJO MULTI-CLIENTE

Con la arquitectura actual (Opción B — instancias separadas):

```bash
# Para cada cliente nuevo:
# 1. Fork o copy del proyecto
git clone <repo> cliente-nuevo && cd cliente-nuevo
npm install

# 2. Crear nuevo proyecto en Supabase (gratis)
# Ejecutar schema.sql

# 3. Crear nuevo proyecto en Vercel (gratis)
vercel --name cliente-nuevo

# 4. Configurar .env con las credenciales de este cliente
# 5. Deploy: vercel --prod
```

Cada cliente tiene:
- URL única: `https://cliente-nombre.vercel.app`
- Base de datos aislada (su propio Supabase)
- Branding parametrizado (logo, colores en candidatos table)
- Dashboard con sus datos exclusivos

---

## CHECKLIST PARA LA DEMO

- [ ] `NEXT_PUBLIC_DEMO_MODE=true` configurado
- [ ] `npm run dev` funciona sin errores
- [ ] Landing page `/` carga con animaciones
- [ ] `/login` muestra selector candidato/encuestador
- [ ] `/encuesta?demo=true` tiene 4 pasos completos y se puede enviar
- [ ] `/dashboard` muestra 5 KPIs + gráficas + tendencia
- [ ] `/admin` muestra panel de gestión
- [ ] QR demo generado con URL de la encuesta
- [ ] Deploy en Vercel completado y URL pública activa

---

*PulsoElectoral v3.0 · Next.js 15 · Supabase · Leaflet · Atlixco, Puebla*
*Secciones electorales: INE Distrito Fed. 13 / Local 21 · 70 secciones confirmadas*

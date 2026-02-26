# 🗳️ PulsoElectoral — Plataforma de Inteligencia Política

Sistema profesional de encuestas electorales con análisis en tiempo real, mapas de calor por sección electoral y modo offline para captura en campo.

## ✨ Características Principales

- 📊 **Dashboard Analítico** — Visualización de KPIs, tendencias semanales y demográficos
- 📱 **Formulario de Encuestas** — Captura en campo con geolocalización GPS
- 🗺️ **Mapas de Calor** — Visualización por sección electoral (INE)
- 📴 **Modo Offline** — Sincronización automática cuando recupera conexión
- 🔐 **Autenticación OTP** — Login sin contraseña vía email
- 📄 **Exportación CSV** — Datos listos para Excel
- 📊 **Gráficos Interactivos** — Recharts para visualización avanzada

## 🏗️ Estructura del Proyecto

```
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── admin/           # Panel de administración
│   │   ├── dashboard/       # Dashboard analítico
│   │   ├── encuesta/        # Formulario de captura
│   │   ├── login/           # Página de autenticación
│   │   ├── offline/         # Página offline
│   │   ├── api/             # API Routes
│   │   ├── layout.jsx       # Layout principal
│   │   └── globals.css      # Estilos globales
│   ├── components/          # Componentes React
│   │   ├── AdminPanel.jsx
│   │   ├── DashboardPolitico.jsx
│   │   ├── FormularioEncuesta.jsx
│   │   └── ...
│   ├── lib/                 # Utilidades y configuración
│   │   ├── supabase.js      # Cliente Supabase
│   │   ├── theme.js         # Colores y tipografía
│   │   ├── constants.js     # Constantes de la app
│   │   └── exportData.js    # Funciones de exportación
│   └── middleware.js        # Middleware de Next.js
├── public/                  # Archivos estáticos
├── sql/                     # Scripts de base de datos
└── Docs/                    # Documentación adicional
```

## 📋 Requisitos Previos

- **Node.js** 18.x o superior
- **npm** 9.x o superior
- Cuenta en [Supabase](https://supabase.com) (gratuita)
- (Opcional) Cuenta en Vercel para deploy

## 🚀 Tutorial de Deploy

### Paso 1: Clonar el Proyecto

```bash
git clone <tu-repositorio>
cd pulsoelectoral
```

### Paso 2: Instalar Dependencias

```bash
npm install
```

### Paso 3: Configurar Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui

# Modo Demo (opcional)
NEXT_PUBLIC_DEMO_MODE=false
```

**Obtener credenciales de Supabase:**
1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Project Settings** → **API**
4. Copia **URL** y **anon public**

### Paso 4: Configurar Base de Datos (Supabase)

Ejecuta los scripts SQL en orden:

1. Ve al **SQL Editor** en Supabase Dashboard
2. Crea una nueva query
3. Copia y pega el contenido de `sql/schema.sql`
4. Ejecuta
5. Repite para `sql/views.sql` y `sql/seed.sql`

### Paso 5: Verificar Build Local

```bash
npm run build
```

Si el build es exitoso, verás:
```
✓ Compiled successfully
✓ Linting and checking validity of types...
✓ Collecting page data...
✓ Generating static pages (9/9)...
✓ Finalizing page optimization...
```

### Paso 6: Deploy en Vercel (Recomendado)

#### Opción A: Deploy Automático (Git)

1. Sube tu código a GitHub/GitLab/Bitbucket
2. Ve a [Vercel Dashboard](https://vercel.com)
3. Clic en **Add New Project**
4. Importa tu repositorio
5. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Clic en **Deploy**

#### Opción B: Deploy Manual (CLI)

Instala Vercel CLI:
```bash
npm i -g vercel
```

Login y deploy:
```bash
vercel login
vercel --prod
```

Sigue las instrucciones interactivas.

### Paso 7: Configurar Dominio (Opcional)

En Vercel Dashboard:
1. Ve a tu proyecto
2. **Settings** → **Domains**
3. Agrega tu dominio personalizado

## ⚙️ Configuración Avanzada

### Variables de Entorno Completas

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase | ✅ Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase | ✅ Sí |
| `NEXT_PUBLIC_DEMO_MODE` | Activa modo demo sin BD | ❌ No (default: false) |

### Configuración de Email (Magic Links)

En Supabase Dashboard:
1. Ve a **Authentication** → **Email Templates**
2. Personaliza las plantillas de email
3. En **URL Configuration**, agrega tu dominio:
   - `https://tudominio.com`
   - `https://tudominio.com/login`

### Configurar PWA (Opcional)

El proyecto incluye Service Worker para modo offline. Para activar completamente:

1. Genera iconos en [PWA Asset Generator](https://pwa-asset-generator.nicepkg.cn/)
2. Coloca los iconos en `public/icons/`
3. Actualiza `public/manifest.json` con tus datos

## 🔧 Solución de Problemas

### Error: "Missing environment variables"

**Problema:** No se configuraron las variables de Supabase

**Solución:**
```bash
# Verifica que el archivo existe
cat .env.local

# Debe contener:
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Error: "Table not found"

**Problema:** No se ejecutaron los scripts SQL

**Solución:**
1. Ve a Supabase → SQL Editor
2. Ejecuta los scripts en `sql/`
3. Verifica en **Table Editor** que las tablas existen

### Build falla por errores de ESLint

**Solución:**
```bash
# Ver errores detallados
npm run lint

# O desactiva ESLint en build (no recomendado)
# next.config.mjs:
# eslint: { ignoreDuringBuilds: true }
```

### Error 404 en rutas

**Solución:**
Asegúrate de que `next.config.mjs` tenga:
```javascript
const nextConfig = {
  output: 'standalone', // Para Docker/VPS
  // o
  // output: 'export',  // Para hosting estático
}
```

## 📝 Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia servidor de desarrollo (localhost:3000) |
| `npm run build` | Genera build de producción |
| `npm run start` | Inicia servidor de producción |
| `npm run lint` | Ejecuta ESLint |

## 🌐 Demo en Línea

Para ver el sistema sin configurar Supabase:

```
https://tudominio.com/login?demo
```

O agrega `?demo=true` a cualquier URL.

## 📄 Licencia

Proyecto privado — Atlixco, Puebla 2024-2025

---

## 🆘 Soporte

¿Problemas con el deploy?

1. Revisa los logs de Vercel: Dashboard → Deployments → Logs
2. Verifica variables de entorno estén configuradas
3. Confirma que Supabase está activo y accesible
4. Revisa que los scripts SQL se ejecutaron correctamente

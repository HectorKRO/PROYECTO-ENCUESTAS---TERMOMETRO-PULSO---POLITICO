# 🗺️ War Room - Guía de Uso

## ¿Qué es el War Room?

Sistema de análisis territorial electoral con mapa interactivo que permite visualizar:
- **68 secciones electorales** de Atlixco coloreadas por intención de voto
- **417 colonias** con drill-down desde secciones
- **Mapa de calor** por concentración de encuestas
- **Comparación lado a lado** de dos campañas

---

## 🚀 Acceso

### Desde el Dashboard
1. Ve al Dashboard (`/dashboard`)
2. En la pestaña "Campo" hay un link "Mapa de calor por sección electoral"
3. Click para abrir el War Room

### URL Directa
```
/war-room?campana=TU_CAMPANA_ID
```

### Modo Comparación
```
/war-room?campana=CAMPANA_1&campana2=CAMPANA_2
```

---

## 🎨 Leyenda de Colores

| Color | Intención | Significado |
|-------|-----------|-------------|
| 🟢 Verde oscuro | ≥55% | Muy Alta - Fortaleza |
| 🟢 Verde lima | 45-54% | Alta - Potencial |
| 🟡 Amarillo | 35-44% | Media - Competitivo |
| 🟠 Naranja | 25-34% | Baja - Débil |
| 🔴 Rojo | <25% | Muy Baja - Crítico |
| ⚫ Gris | Sin datos | Sin encuestas |

---

## 📊 Funcionalidades

### 1. Mapa Coroplético (Vista por Defecto)
- Muestra las 68 secciones coloreadas
- Click en una sección para ver detalles
- Popup al hover con datos básicos

### 2. Panel Lateral (Drill-down)
Al seleccionar una sección se muestra:
- **Intención de voto** (grande y coloreada)
- **Encuestas totales** en la sección
- **Reconocimiento** del candidato
- **Zona y tipo** (Urbano/Rural/Mixto)
- **Lista de colonias** con intención individual

### 3. Exportación de Reportes
Dos botones de descarga:
- **"Descargar Reporte de Sección"** - CSV con datos agregados
- **"Descargar Reporte de Colonias"** - CSV con todas las colonias de la sección

Formato del CSV:
```csv
Colonia,Tipo,Encuestas,Intención %,Reconocimiento %
Centro Histórico,COLONIA,45,52.3,68.5
La Merced,BARRIO,23,48.1,55.2
...
```

### 4. Modo Comparación
- Toggle "Modo Comparación" en el header
- Divide pantalla en dos mapas
- Compara dos campañas lado a lado
- Útil para analizar evolución temporal

### 5. Selector de Vista
- **Por Sección**: Mapa coroplético (default)
- **Por Colonia**: Todos los puntos de colonias
- **Heatmap**: Capa de calor por densidad

---

## 🔄 Actualización de Datos

| Acción | Frecuencia |
|--------|------------|
| Carga inicial | Al abrir la página |
| Suscripción Realtime | Cada 30 segundos (debounce) |
| Botón "Actualizar" | Bajo demanda |
| Cambio de campaña | Inmediato |

---

## 📁 Archivos del Sistema

```
public/data/atlixco_secciones.geojson    # Polígonos de 68 secciones
src/components/WarRoom.jsx               # Componente principal
src/app/war-room/page.jsx                # Página Next.js
```

---

## 💡 Tips de Uso

1. **Identificar zonas débiles**: Busca secciones en rojo/naranja
2. **Planificar recorridos**: Prioriza colonias con baja intención pero alta población
3. **Comparar semanas**: Usa modo comparación con la misma campaña en fechas distintas
4. **Exportar para análisis**: Los CSV pueden abrirse en Excel para análisis profundo

---

## 🔧 Solución de Problemas

### El mapa no carga
- Verifica que el archivo `public/data/atlixco_secciones.geojson` exista
- Revisa la consola del navegador (F12) por errores

### No hay datos en el mapa
- Asegúrate de tener el parámetro `?campana=ID` en la URL
- Verifica que haya encuestas en la base de datos

### El heatmap no funciona
- Requiere al menos 10 encuestas para generar densidad visible
- Zoom in para ver mejor la distribución

---

*Documento generado: 2026-02-25*
*Versión: v2.4*

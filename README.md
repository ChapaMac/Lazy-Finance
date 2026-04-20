# FinanzasMX 💳

App de finanzas personales para México — compatible con BBVA México y American Express México.

---

## Instalación y Configuración

### Requisitos
- Node.js 18 o superior
- npm 9 o superior

### Primer uso

```bash
# 1. Entra a la carpeta del proyecto
cd finanzas-mx

# 2. Instala todas las dependencias (cliente y servidor)
npm run install:all

# 3. Inicia la app en modo desarrollo
npm run dev
```

La app abre automáticamente en: **http://localhost:5173**

El servidor API corre en: **http://localhost:3001**

### Primera vez
- Crea una cuenta en la pantalla de login
- La base de datos se crea automáticamente (`database.sqlite`)
- Se generan 180 movimientos de muestra para explorar la app

---

## Setup & Configuration (English)

### Requirements
- Node.js 18+
- npm 9+

### Quick Start

```bash
cd finanzas-mx
npm run install:all
npm run dev
```

App opens at **http://localhost:5173** · API at **http://localhost:3001**

---

## Cómo exportar estados de cuenta

### BBVA México

**PDF:**
BBVA App → Mis Productos → selecciona tu cuenta → Estado de Cuenta → descarga PDF

**CSV:**
BBVA en Línea (web) → Mis Cuentas → Movimientos → Exportar → CSV

### American Express México

**PDF:**
americanexpress.com.mx → Estado de Cuenta → Descargar → PDF

**XLSX:**
americanexpress.com.mx → Estado de Cuenta → Descargar → Excel

---

## Estructura del proyecto

```
finanzas-mx/
├── client/          → React + Vite + Tailwind CSS
│   └── src/
│       ├── pages/   → Login, Dashboard, Transactions, Upload, Insights
│       ├── components/
│       ├── contexts/ → Auth, i18n
│       └── i18n/    → es.json, en.json
├── server/          → Node.js + Express
│   ├── routes/      → auth, transactions, uploads, insights
│   ├── parsers/     → BBVA PDF/CSV, AmEx PDF/XLSX
│   ├── db/          → SQLite schema + queries
│   ├── middleware/  → JWT auth
│   └── utils/       → categorize, seed
├── database.sqlite  → se crea automáticamente
└── package.json
```

## Funcionalidades

| Característica | Detalle |
|---|---|
| Autenticación | JWT + bcrypt, sesiones de 30 días |
| Dashboard | Balance total, gráficas, top comercios, alertas de presupuesto |
| Carga de estados | Drag & drop, vista previa antes de guardar, deduplicación automática |
| Auto-categorización | 10 categorías con más de 100 palabras clave |
| Tabla de movimientos | Búsqueda, filtros, edición de categoría/notas, exportar CSV |
| Análisis | Comparativa mensual, heatmap de gastos diarios, tendencias |
| Idioma | Español / English toggle |

## Variables de entorno (opcional)

Crea `server/.env` para personalizar:

```env
PORT=3001
JWT_SECRET=tu-secreto-seguro-aqui
```

---

## Licencias

Todas las dependencias son MIT / Apache 2.0 — aptas para uso comercial.

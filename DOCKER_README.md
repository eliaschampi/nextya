# Docker Setup for NextYa - Modern SvelteKit + PostgreSQL

Configuración **moderna, eficiente y limpia** para SvelteKit con PostgreSQL, OpenCV y npm.

## 🚀 Comandos útiles

```bash
# Levantar los servicios
npm run docker:up

# Ver logs de la app
npm run docker:logs

# Conectar a PostgreSQL
npm run docker:db

# Rebuild sin cache
npm run docker:build

# Limpiar todo (volumes + containers)
npm run docker:clean

# Detener servicios
npm run docker:down
```

## 🌐 Acceso

- **App**: http://localhost:5173 (Vite dev server + hot reload)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 📁 Estructura

```
nextya/
├── src/                    # Código fuente SvelteKit
├── docker/
│   ├── app.dockerfile     # Multi-stage Dockerfile con OpenCV
│   ├── data/              # Volúmenes persistentes
│   │   ├── postgres/      # Data PostgreSQL
│   │   └── redis/         # Data Redis
│   └── init/              # Scripts inicialización DB
├── docker-compose.yml     # Orquestación profesional
└── .env.docker           # Variables de entorno
```

## Variables de entorno

- `DB_HOST=postgres`
- `DB_USER=postgres`
- `DB_PASSWORD=postgres`
- `DB_NAME=nextya`
- `NODE_ENV=production`

## ✨ Características

- **🔧 OpenCV Ready**: Usa `urielch/opencv-nodejs:6.2.4` (sin errores de compilación)
- **⚡ Bun + Node**: Compatibilidad completa con tu stack
- **🐘 PostgreSQL 14**: Preparado para migración desde Supabase
- **🔄 Hot Reload**: Desarrollo con volúmenes delegados
- **🏗️ Multi-stage**: Build optimizado para producción
- **🌐 Networks**: Comunicación segura entre servicios
- **💾 Persistencia**: Data PostgreSQL y Redis persistente
- **🧹 Cleanup**: Scripts de limpieza automática

## 🔧 Solución OpenCV

Usa la imagen especializada `urielch/opencv-nodejs:6.2.4` que resuelve todos los problemas de compilación de `@u4/opencv4nodejs` en Docker.

## 🗄️ Base de Datos

```bash
# Conectar a PostgreSQL
bun run docker:db

# La DB se inicializa automáticamente con:
# - Extensiones UUID y pgcrypto
# - Tabla users para JWT auth
# - Índices optimizados
```

## 🚀 Migración Ready

Esta configuración está **100% preparada** para la migración Supabase → Kysely + PostgreSQL con JWT auth.

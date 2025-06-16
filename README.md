# NextYa - Migración Supabase → PostgreSQL + Kysely

Configuración **moderna, eficiente y limpia** para SvelteKit con PostgreSQL, Kysely ORM, JWT Auth y Docker.

## 🎯 Estado de Migración

✅ **COMPLETADO**: Migración de Supabase a PostgreSQL self-hosted con Kysely
✅ **COMPLETADO**: Sistema de autenticación JWT personalizado
✅ **COMPLETADO**: Docker setup con PostgreSQL
✅ **COMPLETADO**: Estructura de base de datos migrada
🔄 **EN PROGRESO**: Migración de módulos de datos

## 🚀 Comandos Docker (Sin npm local requerido)

```bash
# Levantar los servicios (PostgreSQL + App)
docker-compose up -d

# Ver logs de la aplicación
docker-compose logs -f app

# Conectar a PostgreSQL
docker exec -it nextya_postgres psql -U postgres -d nextya

# Rebuild sin cache
docker-compose build --no-cache

# Limpiar todo (volumes + containers)
docker-compose down -v && docker system prune -f

# Detener servicios
docker-compose down

# Generar tipos de Kysely (dentro del container)
docker exec -it nextya_app npm run db:generate
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

### Docker (.env.docker)
- `DB_HOST=postgres`
- `DB_USER=postgres`
- `DB_PASSWORD=postgres`
- `DB_NAME=nextya`
- `JWT_SECRET=your-super-secret-jwt-key-change-in-production-2024`
- `NODE_ENV=development`

### Producción
- Cambiar `JWT_SECRET` por una clave segura
- Configurar `NODE_ENV=production`

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
npm run docker:db

# La DB se inicializa automáticamente con:
# - Extensiones UUID y pgcrypto
# - Tabla users para JWT auth
# - Índices optimizados
```

## 🚀 Migración Completada

✅ **Migración Supabase → Kysely + PostgreSQL completada**

### Características implementadas:
- 🔐 **Autenticación JWT** con cookies seguras
- 🗄️ **PostgreSQL** con schema completo migrado
- 🔧 **Kysely ORM** type-safe para consultas SQL
- 🐳 **Docker** setup completo y funcional
- 🧹 **Clean Architecture** sin dependencias de Supabase

### Próximos pasos:
1. Migrar módulos de datos restantes
2. Implementar funciones SQL complejas
3. Testing y validación completa

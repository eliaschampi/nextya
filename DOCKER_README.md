# Docker Setup for NextYa - PostgreSQL Migration

Configuración **minimalista y profesional** para SvelteKit con PostgreSQL usando Docker y Bun.

## Comandos útiles

```bash
# Levantar los servicios
bun run docker:up

# Detener y limpiar
bun run docker:down

# Ver logs en tiempo real
bun run docker:logs

# Rebuild containers
bun run docker:build
```

## Acceso

- **App**: http://localhost:5173 (Vite dev server)
- **PostgreSQL**: localhost:5432

## Estructura

```
your-project/
├── src/               # Código fuente de SvelteKit
├── Dockerfile         # Definición del contenedor de SvelteKit
├── docker-compose.yml # Orquestación de servicios
└── .env.docker        # Variables de entorno
```

## Variables de entorno

- `DB_HOST=postgres`
- `DB_USER=postgres`
- `DB_PASSWORD=postgres`
- `DB_NAME=nextya`
- `NODE_ENV=production`

## Ventajas de esta configuración

- **Minimalista**: Solo incluye lo necesario
- **Funcional**: SvelteKit + PostgreSQL trabajan juntos
- **Profesional**: Usa prácticas estándar (volúmenes, variables de entorno)
- **Escalable**: Fácil de extender con más servicios

## Conexión a PostgreSQL

```bash
# Conectar a PostgreSQL
docker exec -it nextya-postgres-1 psql -U postgres -d nextya

# Generar tipos de Kysely
bun run db:generate
```

Esta configuración proporciona una base limpia para la migración de Supabase a Kysely.

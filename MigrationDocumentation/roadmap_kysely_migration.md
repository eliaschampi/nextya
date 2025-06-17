# Roadmap de Migración a PostgreSQL con Kysely

Este documento describe los entregables y patrones clave para migrar un proyecto SvelteKit v2 + Svelte 5 + TypeScript desde Supabase a PostgreSQL self-hosted usando únicamente Kysely.

## Entregables Principales

1. **Entorno de Base de Datos**: Servidor PostgreSQL configurado con usuario y permisos.
2. **Configuración de Kysely**: Pool de conexiones y dialecto PostgreSQL.
3. **Tipos y Migrations**: Generación de tipos con `kysely-codegen` y archivos de migración controlados por `kysely-ctl`.
4. **Autenticación JWT**: Generar, verificar y refrescar tokens; gestión de sesión con cookies seguras.
5. **Modelo de Permisos**: Tabla `permissions` y funciones para verificar acciones.
6. **Hooks y Layouts**: Integrar `db`, sesión y permisos en `hooks.server.ts` y layout.
7. **Módulos de Datos**: Patrón `db.selectFrom(...).execute()` para CRUD.
8. **Endpoints API**: Ejemplos para GET, POST usando `locals.db` y control de errores.
9. **Testing**: Unitarios para auth y data; integración para endpoints.
10. **Checklist de Deployment**: Backup, migraciones, build y reinicio en producción.

---

## 1. Entorno de Base de Datos

**Comandos esenciales en Debian**:

```bash
apt update && apt install postgresql postgresql-contrib
sudo -u postgres createdb app_production
sudo -u postgres createuser app_user
sudo -u postgres psql -c "ALTER USER app_user WITH PASSWORD 'SECURE_PASS';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE app_production TO app_user;"
```

## 2. Configuración de Kysely

\`\`

```ts
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool })
});
```

## 3. Generación de Tipos y Migrations

\`\`

```ts
import { defineConfig } from 'kysely-codegen';
export default defineConfig({
  dialect: 'postgres',
  connectionString: process.env.DATABASE_URL,
  out: 'src/lib/database/types.ts',
  camelCase: true
});
```

```bash
npm install -D kysely-codegen kysely-ctl
npx kysely-codegen --config kysely.config.ts
```

**Ejemplo de migración** `src/lib/database/migrations/001_initial.ts`

```ts
import { Kysely, sql } from 'kysely';
export async function up(db: Kysely<any>) {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);
  await db.schema
    .createTable('users')
    .addColumn('id','uuid',col=>col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email','varchar(255)',col=>col.notNull().unique())
    .addColumn('password_hash','text',col=>col.notNull())
    .execute();
}
export async function down(db: Kysely<any>) {
  await db.schema.dropTable('users').execute();
}
```

## 4. Autenticación JWT y Sesiones

\`\`

```ts
import jwt from 'jsonwebtoken';
export const generateToken=(id:string,email:string)=>
  jwt.sign({ id,email },process.env.JWT_SECRET!,{expiresIn:'8h'});
export const verifyToken=(t:string)=>{try{return jwt.verify(t,process.env.JWT_SECRET!);}catch{return null;}};
```

\`\`

```ts
import { db } from '$lib/database';
import { generateToken,verifyToken } from './jwt';
export async function createSession(id:string,cookies:any){
  const user=await db.selectFrom('users').selectAll().where('id','=',id).executeTakeFirst();
  if(!user) return null;
  const token=generateToken(user.id,user.email);
  cookies.set('app_session',token,{httpOnly:true,sameSite:'strict',maxAge:28800});
  return { user,token };
}
export function getSession(cookies:any){
  const t=cookies.get('app_session');
  return t?verifyToken(t):null;
}
export function destroySession(cookies:any){cookies.delete('app_session');}
```

## 5. Permisos

\*\*Tabla \*\*\`\`: `{ id uuid PK, user_id uuid, entity text, action text }`

\`\`

```ts
import { db } from '$lib/database';
export const hasPermission=async(user:string,entity:string,action:string)=>
  !!(await db.selectFrom('permissions')
    .select('id')
    .where('user_id','=',user)
    .where('entity','=',entity)
    .where('action','=',action)
    .executeTakeFirst());
```

## 6. Hooks y Layouts

\`\`

```ts
import { sequence } from '@sveltejs/kit/hooks';
import { getSession } from '$lib/auth/session';
export const handle=sequence(
  ({ event,resolve })=>{event.locals.db=db;return resolve(event);},
  async({ event,resolve })=>{
    event.locals.user=getSession(event.cookies);
    return resolve(event);
  }
);
```

## 7. Patrón para Módulos de Datos

```ts
import { db } from '$lib/database';
export const getCourses=()=>
  db.selectFrom('courses').selectAll().orderBy('order','asc').execute();
```

## 8. Endpoints API

```ts
// src/routes/api/courses/+server.ts
import { json } from '@sveltejs/kit';
export const GET=async({ locals })=>json(await locals.db.selectFrom('courses').selectAll().execute());
```

## 9. Testing

- **Unitarios**: auth/jwt, data modules.
- **Integración**: endpoints (GET, POST flows).

## 10. Deployment Checklist

- Realizar backup `pg_dump`.
- Ejecutar migraciones `npx kysely-ctl migrate`.
- Generar build `npm run build`.
- Reiniciar servicio en producción.

---

Con esta base, el resto de módulos y endpoints sigue el mismo patrón: usar `locals.db` con Kysely para todas las operaciones SQL, gestión de sesión y permisos centralizada, y migraciones codificadas con `kysely-ctl`.


# ROADMAP: Migración de Supabase a PostgreSQL Self-Hosted con Kysely

Este documento ofrece una guía exhaustiva para migrar una aplicación de Supabase a una base de datos PostgreSQL autohospedada, utilizando Kysely como ORM. Está pensado para proyectos con Svelte 5 y TypeScript, asegurando continuidad funcional, seguridad y rendimiento óptimo tras la migración.

---

## Introducción

Migrar de Supabase a PostgreSQL self-hosted con Kysely permite mayor control sobre la infraestructura, reduce costos a largo plazo y mejora la flexibilidad. Kysely, un constructor de consultas SQL type-safe, es ideal para aplicaciones modernas con SvelteKit, ofreciendo seguridad y eficiencia en la gestión de datos.

### Beneficios clave
- **Control total**: Gestión directa de la base de datos y su configuración.
- **Rendimiento**: Queries optimizados y personalizados con Kysely.
- **Costo**: Eliminación de tarifas de Supabase.
- **Seguridad**: Autenticación y permisos personalizados.
- **Escalabilidad**: Infraestructura adaptable a necesidades específicas.

### Prerrequisitos
- Conocimientos básicos de PostgreSQL, TypeScript y SvelteKit.
- Acceso al schema y datos actuales en Supabase.
- Servidor Debian/Ubuntu para hosting (o equivalente).

---

## Análisis del Proyecto Actual

### Arquitectura Actual
- **Frontend**: SvelteKit 2 con Svelte 5.
- **Backend**: Supabase (PostgreSQL gestionado, autenticación, APIs).
- **ORM**: Cliente de Supabase (`@supabase/supabase-js`).
- **Autenticación**: Supabase Auth con SSR.
- **Módulos**: Múltiples archivos en `src/lib/data/` (ej. `courses.ts`, `dashboard.ts`).
- **APIs**: Endpoints en `src/routes/api/` usando `locals.supabase`.
- **Funciones SQL**: Lógicas complejas en PostgreSQL (ej. `get_level_dashboard_data`).

### Arquitectura Objetivo
- **Frontend**: Sin cambios (SvelteKit 2, Svelte 5).
- **Backend**: PostgreSQL self-hosted en Debian.
- **ORM**: Kysely con tipos generados automáticamente.
- **Autenticación**: JWT con cookies seguras.
- **Gestión de Schema**: Migraciones con `kysely-ctl`.

---

## FASE 1: PREPARACIÓN Y CONFIGURACIÓN

### Objetivo
Establecer el entorno base para la migración.

### Entregables
- Entorno local con PostgreSQL y Kysely.
- Schema actual exportado y documentado.

### Tareas
1. **Instalación de PostgreSQL**:
   - En Debian/Ubuntu:
     ```bash
     sudo apt update
     sudo apt install postgresql-15 postgresql-contrib
     sudo systemctl enable postgresql
     sudo systemctl start postgresql
     ```
   - Crear base de datos y usuario:
     ```bash
     sudo -u postgres psql
     CREATE DATABASE myapp_dev;
     CREATE USER myapp_user WITH PASSWORD 'secure_password';
     GRANT ALL PRIVILEGES ON DATABASE myapp_dev TO myapp_user;
     \q
     ```

2. **Instalación de dependencias**:
   ```bash
   npm install kysely pg jsonwebtoken bcryptjs cookie
   npm install -D @types/pg kysely-codegen kysely-ctl @types/jsonwebtoken @types/bcryptjs @types/cookie
   ```

3. **Exportación del schema de Supabase**:
   - Usar CLI de Supabase:
     ```bash
     supabase db dump --schema-only > schema.sql
     ```
   - Inspeccionar `schema.sql` para tablas, índices y funciones.

4. **Configuración de variables de entorno**:
   - Archivo `.env`:
     ```
     DATABASE_URL=postgres://myapp_user:secure_password@localhost:5432/myapp_dev
     JWT_SECRET=your-very-secure-secret-here
     NODE_ENV=development
     ```

---

## FASE 2: CONFIGURACIÓN DE KYSELY

### Objetivo
Integrar Kysely como ORM principal.

### Entregables
- Instancia de Kysely funcional.
- Tipos generados para TypeScript.
- Migraciones iniciales.

### Tareas
1. **Configuración de Kysely**:
   - Archivo `src/lib/database/index.ts`:
     ```typescript
     import { Kysely, PostgresDialect } from 'kysely';
     import { Pool } from 'pg';
     import type { Database } from './types';

     const pool = new Pool({
       connectionString: process.env.DATABASE_URL,
       max: 20,
       idleTimeoutMillis: 30000,
       connectionTimeoutMillis: 2000,
     });

     export const db = new Kysely<Database>({
       dialect: new PostgresDialect({ pool }),
     });

     process.on('SIGTERM', async () => {
       await pool.end();
     });
     ```

2. **Generación de tipos**:
   - Configuración en `kysely.config.ts`:
     ```typescript
     import { defineConfig } from 'kysely-codegen';

     export default defineConfig({
       dialect: 'postgres',
       connectionString: process.env.DATABASE_URL,
       out: 'src/lib/database/types.ts',
       camelCase: true,
     });
     ```
   - Ejecutar:
     ```bash
     npx kysely-codegen --config kysely.config.ts
     ```

3. **Migraciones**:
   - Crear `src/lib/database/migrations/001_initial.ts`:
     ```typescript
     import { Kysely, sql } from 'kysely';

     export async function up(db: Kysely<any>): Promise<void> {
       await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);
       await db.schema
         .createTable('users')
         .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
         .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
         .addColumn('password_hash', 'text', (col) => col.notNull())
         .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
         .execute();
     }

     export async function down(db: Kysely<any>): Promise<void> {
       await db.schema.dropTable('users').execute();
     }
     ```
   - Aplicar migración:
     ```bash
     npx kysely-ctl up
     ```

---

## FASE 3: SISTEMA DE AUTENTICACIÓN

### Objetivo
Reemplazar Supabase Auth con un sistema personalizado.

### Entregables
- Autenticación basada en JWT.
- Gestión de sesiones y permisos.

### Tareas
1. **Configuración de JWT**:
   - Archivo `src/lib/auth/jwt.ts`:
     ```typescript
     import jwt from 'jsonwebtoken';

     export interface TokenPayload {
       userId: string;
       email: string;
       iat?: number;
       exp?: number;
     }

     export function generateToken(userId: string, email: string): string {
       return jwt.sign({ userId, email }, process.env.JWT_SECRET!, { expiresIn: '8h' });
     }

     export function verifyToken(token: string): TokenPayload | null {
       try {
         return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
       } catch (error) {
         console.error('Invalid token:', error);
         return null;
       }
     }
     ```

2. **Gestión de sesiones**:
   - Archivo `src/lib/auth/session.ts`:
     ```typescript
     import { generateToken, verifyToken } from './jwt';
     import type { Cookies } from '@sveltejs/kit';

     export async function createSession(userId: string, email: string, cookies: Cookies) {
       const token = generateToken(userId, email);
       cookies.set('session', token, {
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
         sameSite: 'strict',
         maxAge: 8 * 60 * 60,
         path: '/',
       });
       return token;
     }

     export async function getSession(cookies: Cookies) {
       const token = cookies.get('session');
       if (!token) return null;
       return verifyToken(token);
     }

     export function destroySession(cookies: Cookies) {
       cookies.delete('session', { path: '/' });
     }
     ```

3. **Autenticación de usuarios**:
   - Archivo `src/lib/auth/index.ts`:
     ```typescript
     import { db } from '$lib/database';
     import { hash, compare } from 'bcryptjs';
     import { createSession } from './session';

     export async function signup(email: string, password: string, cookies: Cookies) {
       const passwordHash = await hash(password, 12);
       const user = await db
         .insertInto('users')
         .values({ email, password_hash: passwordHash })
         .returning(['id', 'email'])
         .executeTakeFirstOrThrow();
       await createSession(user.id, user.email, cookies);
       return user;
     }

     export async function login(email: string, password: string, cookies: Cookies) {
       const user = await db
         .selectFrom('users')
         .select(['id', 'email', 'password_hash'])
         .where('email', '=', email)
         .executeTakeFirst();
       if (!user || !(await compare(password, user.password_hash))) {
         throw new Error('Invalid credentials');
       }
       await createSession(user.id, user.email, cookies);
       return { id: user.id, email: user.email };
     }
     ```

---

## FASE 4: REFACTORIZACIÓN DE HOOKS Y LAYOUTS

### Objetivo
Adaptar SvelteKit a la nueva autenticación.

### Entregables
- Hooks y layouts funcionales sin Supabase.

### Tareas
1. **Actualización de hooks**:
   - Archivo `src/hooks.server.ts`:
     ```typescript
     import { sequence } from '@sveltejs/kit/hooks';
     import { getSession } from '$lib/auth/session';
     import { db } from '$lib/database';

     export const handle = sequence(async ({ event, resolve }) => {
       const session = await getSession(event.cookies);
       event.locals.user = session ? { id: session.userId, email: session.email } : null;
       event.locals.db = db;
       return resolve(event);
     });
     ```

2. **Actualización de layouts**:
   - Archivo `src/routes/+layout.server.ts`:
     ```typescript
     import type { LayoutServerLoad } from './$types';

     export const load: LayoutServerLoad = async ({ locals }) => {
       return {
         user: locals.user || null,
       };
     };
     ```

---

## FASE 5: MIGRACIÓN DE MÓDULOS DE DATOS

### Objetivo
Reemplazar el cliente de Supabase por Kysely en los módulos.

### Entregables
- Módulos de datos migrados (ej. `courses.ts`).

### Tareas
1. **Migración de `courses.ts`**:
   - Antes:
     ```typescript
     export async function getCourses(supabase: SupabaseClient) {
       const { data } = await supabase.from('courses').select('*');
       return data;
     }
     ```
   - Después:
     ```typescript
     import { db } from '$lib/database';

     export async function getCourses() {
       return await db
         .selectFrom('courses')
         .selectAll()
         .orderBy('order', 'asc')
         .execute();
     }

     export async function createCourse(name: string, order: number) {
       return await db
         .insertInto('courses')
         .values({ name, order })
         .returningAll()
         .executeTakeFirstOrThrow();
     }
     ```

2. **Validación**:
   - Asegurarse de que todas las consultas reflejen la lógica original.

---

## FASE 6: MIGRACIÓN DE FUNCIONES POSTGRESQL

### Objetivo
Integrar funciones SQL existentes con Kysely.

### Entregables
- Funciones complejas accesibles desde Kysely.

### Tareas
1. **Migración de `get_level_dashboard_data`**:
   - Archivo `src/lib/data/dashboard.ts`:
     ```typescript
     import { db } from '$lib/database';
     import { sql } from 'kysely';

     export async function getLevelDashboardData(levelCode: string) {
       const result = await db
         .selectFrom(sql`get_level_dashboard_data(${levelCode}) as dashboard`)
         .selectAll()
         .execute();
       return result;
     }
     ```

2. **Replicación de RLS**:
   - Implementar lógica en middleware si es necesario.

---

## FASE 7: MIGRACIÓN DE ENDPOINTS API

### Objetivo
Actualizar APIs para usar Kysely.

### Entregables
- Endpoints funcionales sin Supabase.

### Tareas
1. **Migración de `/api/student`**:
   - Antes:
     ```typescript
     export const GET: RequestHandler = async ({ locals }) => {
       const { data } = await locals.supabase.from('students').select('*');
       return json(data);
     };
     ```
   - Después:
     ```typescript
     import { json } from '@sveltejs/kit';

     export const GET: RequestHandler = async ({ locals, url }) => {
       const search = url.searchParams.get('search') || '';
       const students = await locals.db
         .selectFrom('students')
         .selectAll()
         .where('name', 'ilike', `%${search}%`)
         .execute();
       return json(students);
     };
     ```

---

## FASE 8: TESTING Y VALIDACIÓN

### Objetivo
Garantizar la estabilidad post-migración.

### Entregables
- Suite de tests automatizados.

### Tareas
1. **Configuración de Vitest**:
   ```bash
   npm install -D vitest @testing-library/svelte
   ```

2. **Test de `courses.ts`**:
   - Archivo `src/lib/data/courses.test.ts`:
     ```typescript
     import { describe, it, expect, beforeAll } from 'vitest';
     import { getCourses, createCourse } from './courses';
     import { db } from '$lib/database';

     describe('Courses', () => {
       beforeAll(async () => {
         await db.deleteFrom('courses').execute();
       });

       it('creates and fetches courses', async () => {
         await createCourse('Math', 1);
         const courses = await getCourses();
         expect(courses).toContainEqual(expect.objectContaining({ name: 'Math', order: 1 }));
       });
     });
     ```

---

## FASE 9: DEPLOYMENT Y MIGRACIÓN EN PRODUCCIÓN

### Objetivo
Llevar la aplicación a producción.

### Entregables
- Sistema en producción con datos migrados.

### Tareas
1. **Configuración del servidor**:
   ```bash
   sudo apt install postgresql-15
   sudo -u postgres createdb myapp_production
   sudo -u postgres createuser myapp_user -P
   ```

2. **Migración de datos**:
   - Script `scripts/migrate.ts`:
     ```typescript
     import { createClient } from '@supabase/supabase-js';
     import { db } from '$lib/database';

     const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

     async function migrateTable(table: string) {
       const { data } = await supabase.from(table).select('*');
       if (data?.length) {
         await db.insertInto(table).values(data).execute();
       }
     }

     async function runMigration() {
       await migrateTable('users');
       await migrateTable('courses');
       console.log('Migration complete');
     }

     runMigration().catch(console.error);
     ```

3. **Despliegue**:
   ```bash
   npm run build
   pm2 start npm --name "myapp" -- start
   ```

---

## FASE 10: OPTIMIZACIÓN Y MONITOREO

### Objetivo
Mejorar rendimiento y supervisión.

### Entregables
- Índices y health checks implementados.

### Tareas
1. **Optimización de índices**:
   - Archivo `src/lib/database/optimizations.ts`:
     ```typescript
     import { db } from './index';

     export async function createIndexes() {
       await db.schema
         .createIndex('idx_students_name')
         .on('students')
         .column('name')
         .execute();
     }
     ```

2. **Endpoint de salud**:
   - Archivo `src/routes/api/health/+server.ts`:
     ```typescript
     import { json } from '@sveltejs/kit';

     export const GET: RequestHandler = async ({ locals }) => {
       const health = await locals.db.selectFrom('users').select('id').limit(1).execute();
       return json({ status: health.length ? 'healthy' : 'unhealthy' });
     };
     ```

---

## Conclusión

Este roadmap proporciona una migración estructurada, segura y optimizada de Supabase a PostgreSQL self-hosted con Kysely. El resultado es un sistema robusto, escalable y mantenible, perfectamente alineado con Svelte 5 y TypeScript.

### Próximos pasos
- Monitorear rendimiento en producción.
- Iterar sobre índices según uso real.
- Considerar caching con Redis si es necesario.
# ROADMAP: Migración de Supabase a PostgreSQL Self-Hosted con Kysely

## Análisis del Proyecto Actual

### Arquitectura Actual
- **Frontend**: SvelteKit 2 con Svelte 5
- **Backend**: Supabase (PostgreSQL + Auth + SSR)
- **ORM**: Supabase Client directo
- **Autenticación**: Supabase Auth con SSR
- **Deployment**: Producción en carrioneduca.edu.pe

### Dependencias Supabase Identificadas
- `@supabase/ssr`: SSR authentication
- `@supabase/supabase-js`: Cliente principal
- Hooks de autenticación en `hooks.server.ts`
- Layouts con gestión de sesión
- **11 módulos de datos** en `src/lib/data/`:
  - `courses.ts`, `dashboard.ts`, `eval.ts`, `evalDashboard.ts`
  - `levels.ts`, `question.ts`, `register.ts`, `studentDashboard.ts`
  - `courseDashboard.ts`, `entities.ts`, `modality.ts`
- **15+ endpoints API** que usan `locals.supabase`:
  - `/api/student/*`, `/api/eval/*`, `/api/dashboard/*`
  - `/api/impcsv/*`, `/api/logout`
- **Funciones PostgreSQL** complejas:
  - `get_level_dashboard_data`, `get_group_dashboard_data`
  - `get_eval_dashboard_data`, `get_student_score_evolution`
  - `get_student_course_scores`, `get_student_course_evolution`
  - `get_level_course_scores`

### Arquitectura Objetivo
- **Frontend**: SvelteKit 2 con Svelte 5 (sin cambios)
- **Backend**: PostgreSQL self-hosted en Debian
- **ORM**: Kysely (type-safe SQL query builder)
- **Autenticación**: Custom JWT con cookies seguras
- **Migraciones**: kysely-ctl
- **Tipos**: kysely-codegen para generación automática

## FASE 1: PREPARACIÓN Y ANÁLISIS (Días 1-3)

### 1.1 Configuración del Entorno de Desarrollo
```bash
# Instalar dependencias principales
npm install kysely pg
npm install -D @types/pg kysely-codegen kysely-ctl

# Instalar dependencias de autenticación
npm install jsonwebtoken bcryptjs cookie
npm install -D @types/jsonwebtoken @types/bcryptjs @types/cookie
```

### 1.2 Configuración de PostgreSQL Self-Hosted
```bash
# En servidor Debian
sudo apt update && sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear base de datos y usuario
sudo -u postgres createdb nextya_production
sudo -u postgres createuser nextya_user
sudo -u postgres psql -c "ALTER USER nextya_user WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE nextya_production TO nextya_user;"
```

### 1.3 Análisis de Schema Actual
- **Exportar schema de Supabase**:
  ```bash
  supabase db dump --schema-only > current_schema.sql
  ```
- **Identificar dependencias**:
  - 9 tablas principales: `users`, `levels`, `courses`, `students`, `registers`, `evals`, `eval_sections`, `eval_questions`, `eval_answers`, `eval_results`
  - 1 tabla de permisos: `permissions`
  - 1 vista: `student_registers`
  - 7 funciones PostgreSQL complejas
  - RLS policies (Row Level Security)

### 1.4 Mapeo de Funcionalidades
| Componente Actual | Reemplazo con Kysely |
|-------------------|---------------------|
| `locals.supabase.from('table')` | `db.selectFrom('table')` |
| `locals.supabase.auth` | Custom JWT auth |
| `locals.supabase.rpc()` | `db.selectFrom(sql`function_call`)` |
| Supabase SSR | Custom session management |
| RLS policies | Middleware de permisos |

## FASE 2: CONFIGURACIÓN DE KYSELY (Días 4-6)

### 2.1 Estructura de Archivos Nueva
```
src/
├── lib/
│   ├── database/
│   │   ├── index.ts              # Configuración principal de Kysely
│   │   ├── types.ts              # Tipos generados por kysely-codegen
│   │   ├── migrations/           # Migraciones con kysely-ctl
│   │   │   ├── 001_initial.ts
│   │   │   ├── 002_permissions.ts
│   │   │   └── 003_functions.ts
│   │   └── connection.ts         # Pool de conexiones
│   ├── auth/
│   │   ├── jwt.ts               # Manejo de JWT
│   │   ├── session.ts           # Gestión de sesiones
│   │   ├── middleware.ts        # Middleware de autenticación
│   │   └── permissions.ts       # Sistema de permisos
│   └── data/                    # Módulos de datos refactorizados
└── hooks.server.ts              # Hooks refactorizados
```

### 2.2 Configuración Principal de Kysely
**Archivo: `src/lib/database/index.ts`**
```typescript
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './types';
import {
  DATABASE_URL,
  DATABASE_HOST,
  DATABASE_PORT,
  DATABASE_NAME,
  DATABASE_USER,
  DATABASE_PASSWORD
} from '$env/static/private';

// Configuración del pool de conexiones
const pool = new Pool({
  connectionString: DATABASE_URL,
  host: DATABASE_HOST,
  port: parseInt(DATABASE_PORT || '5432'),
  database: DATABASE_NAME,
  user: DATABASE_USER,
  password: DATABASE_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Instancia principal de Kysely
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
  log: (event) => {
    if (event.level === 'query') {
      console.log('Query:', event.query.sql);
      console.log('Parameters:', event.query.parameters);
    }
  },
});

export type DB = typeof db;
export * from './types';
```

### 2.3 Generación de Tipos con kysely-codegen
**Archivo: `kysely.config.ts`**
```typescript
import { defineConfig } from 'kysely-codegen';

export default defineConfig({
  dialect: 'postgres',
  connectionString: process.env.DATABASE_URL,
  out: 'src/lib/database/types.ts',
  camelCase: true,
  excludePattern: '^(auth\\..*|storage\\..*|realtime\\..*)$',
});
```

**Script de generación:**
```bash
# Generar tipos automáticamente
npx kysely-codegen --config kysely.config.ts
```

### 2.4 Sistema de Migraciones
**Archivo: `src/lib/database/migrations/001_initial.ts`**
```typescript
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Crear enum
  await sql`
    CREATE TYPE entity_enum AS ENUM (
      'users', 'levels', 'courses', 'students', 'registers',
      'evals', 'eval_sections', 'eval_questions', 'eval_answers', 'eval_results'
    )
  `.execute(db);

  // Crear tabla de usuarios (reemplaza auth.users)
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('name', 'varchar(100)')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('last_login', 'timestamptz')
    .addColumn('is_active', 'boolean', (col) => col.defaultTo(true))
    .execute();

  // Crear tabla de niveles
  await db.schema
    .createTable('levels')
    .addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .addColumn('abr', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('users', sql`uuid[]`, (col) => col.notNull())
    .execute();

  // Continuar con el resto de tablas...
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('levels').execute();
  await db.schema.dropTable('users').execute();
  await sql`DROP TYPE entity_enum`.execute(db);
}
```

## FASE 3: SISTEMA DE AUTENTICACIÓN CUSTOM (Días 7-10)

### 3.1 Configuración JWT y Sesiones
**Archivo: `src/lib/auth/jwt.ts`**
```typescript
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '$env/static/private';

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN || '8h' }
  );
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function refreshToken(token: string): string | null {
  const payload = verifyToken(token);
  if (!payload) return null;

  // Regenerar token si está próximo a expirar (menos de 1 hora)
  const timeUntilExpiry = payload.exp * 1000 - Date.now();
  if (timeUntilExpiry < 3600000) {
    return generateToken(payload.userId, payload.email);
  }

  return token;
}
```

### 3.2 Gestión de Sesiones
**Archivo: `src/lib/auth/session.ts`**
```typescript
import type { Cookies } from '@sveltejs/kit';
import { verifyToken, refreshToken, type JWTPayload } from './jwt';
import { db } from '$lib/database';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
}

export interface Session {
  user: SessionUser;
  token: string;
  expiresAt: number;
}

const SESSION_COOKIE_NAME = 'nextya_session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 8, // 8 horas
  path: '/'
};

export async function createSession(userId: string, cookies: Cookies): Promise<Session | null> {
  try {
    // Obtener datos del usuario
    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'name', 'isActive'])
      .where('id', '=', userId)
      .where('isActive', '=', true)
      .executeTakeFirst();

    if (!user) return null;

    // Generar token
    const token = generateToken(user.id, user.email);
    const payload = verifyToken(token);
    if (!payload) return null;

    // Crear sesión
    const session: Session = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive
      },
      token,
      expiresAt: payload.exp * 1000
    };

    // Establecer cookie
    cookies.set(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);

    // Actualizar último login
    await db
      .updateTable('users')
      .set({ lastLogin: new Date() })
      .where('id', '=', userId)
      .execute();

    return session;
  } catch (error) {
    console.error('Error creating session:', error);
    return null;
  }
}

export async function getSession(cookies: Cookies): Promise<Session | null> {
  try {
    const token = cookies.get(SESSION_COOKIE_NAME);
    if (!token) return null;

    // Verificar y refrescar token si es necesario
    const newToken = refreshToken(token);
    if (!newToken) {
      destroySession(cookies);
      return null;
    }

    const payload = verifyToken(newToken);
    if (!payload) {
      destroySession(cookies);
      return null;
    }

    // Obtener datos actuales del usuario
    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'name', 'isActive'])
      .where('id', '=', payload.userId)
      .where('isActive', '=', true)
      .executeTakeFirst();

    if (!user) {
      destroySession(cookies);
      return null;
    }

    // Actualizar cookie si el token fue refrescado
    if (newToken !== token) {
      cookies.set(SESSION_COOKIE_NAME, newToken, COOKIE_OPTIONS);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive
      },
      token: newToken,
      expiresAt: payload.exp * 1000
    };
  } catch (error) {
    console.error('Error getting session:', error);
    destroySession(cookies);
    return null;
  }
}

export function destroySession(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}
```

### 3.3 Sistema de Permisos
**Archivo: `src/lib/auth/permissions.ts`**
```typescript
import { db } from '$lib/database';
import type { EntityType } from '$lib/data/entities';

export type PermissionAction = 'read' | 'create' | 'update' | 'delete';

export interface Permission {
  code: string;
  userCode: string;
  entity: EntityType;
  userAction: PermissionAction;
}

export async function getUserPermissions(userId: string): Promise<Permission[]> {
  try {
    const permissions = await db
      .selectFrom('permissions')
      .selectAll()
      .where('userCode', '=', userId)
      .execute();

    return permissions;
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return [];
  }
}

export async function hasPermission(
  userId: string,
  entity: EntityType,
  action: PermissionAction
): Promise<boolean> {
  try {
    const permission = await db
      .selectFrom('permissions')
      .select('code')
      .where('userCode', '=', userId)
      .where('entity', '=', entity)
      .where('userAction', '=', action)
      .executeTakeFirst();

    return !!permission;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

export function createPermissionChecker(userId: string) {
  return {
    can: (entity: EntityType, action: PermissionAction) =>
      hasPermission(userId, entity, action),

    canRead: (entity: EntityType) => hasPermission(userId, entity, 'read'),
    canCreate: (entity: EntityType) => hasPermission(userId, entity, 'create'),
    canUpdate: (entity: EntityType) => hasPermission(userId, entity, 'update'),
    canDelete: (entity: EntityType) => hasPermission(userId, entity, 'delete'),
  };
}
```

## FASE 4: REFACTORIZACIÓN DE HOOKS Y LAYOUTS (Días 11-13)

### 4.1 Nuevo hooks.server.ts
**Archivo: `src/hooks.server.ts`**
```typescript
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getSession, destroySession } from '$lib/auth/session';
import { getUserPermissions, createPermissionChecker } from '$lib/auth/permissions';
import { db } from '$lib/database';

// Handle de base de datos
const databaseHandle: Handle = async ({ event, resolve }) => {
  // Hacer disponible la instancia de Kysely
  event.locals.db = db;

  return resolve(event);
};

// Handle de autenticación
const authHandle: Handle = async ({ event, resolve }) => {
  // Obtener sesión de las cookies
  const session = await getSession(event.cookies);

  if (session) {
    event.locals.session = session;
    event.locals.user = session.user;

    // Cargar permisos del usuario
    const permissions = await getUserPermissions(session.user.id);
    event.locals.permissions = permissions;
    event.locals.can = createPermissionChecker(session.user.id);
  } else {
    event.locals.session = null;
    event.locals.user = null;
    event.locals.permissions = [];
    event.locals.can = {
      can: () => Promise.resolve(false),
      canRead: () => Promise.resolve(false),
      canCreate: () => Promise.resolve(false),
      canUpdate: () => Promise.resolve(false),
      canDelete: () => Promise.resolve(false),
    };
  }

  return resolve(event);
};

// Guardia de autenticación
const authGuard: Handle = async ({ event, resolve }) => {
  const isAuthPage = event.url.pathname === '/auth';
  const hasSession = !!event.locals.session;

  // Redirigir a auth si no hay sesión y no está en página de auth
  if (!hasSession && !isAuthPage) {
    throw redirect(303, '/auth');
  }

  // Redirigir a home si hay sesión y está en página de auth
  if (hasSession && isAuthPage) {
    throw redirect(303, '/');
  }

  return resolve(event);
};

// Combinar todos los handles
export const handle = sequence(databaseHandle, authHandle, authGuard);
```

### 4.2 Actualización de app.d.ts
**Archivo: `src/app.d.ts`**
```typescript
import type { DB } from '$lib/database';
import type { Session, SessionUser } from '$lib/auth/session';
import type { Permission } from '$lib/auth/permissions';
import type { EntityType } from '$lib/data/entities';
import type { PermissionAction } from '$lib/auth/permissions';

declare global {
  namespace App {
    interface Locals {
      db: DB;
      session: Session | null;
      user: SessionUser | null;
      permissions: Permission[];
      can: {
        can: (entity: EntityType, action: PermissionAction) => Promise<boolean>;
        canRead: (entity: EntityType) => Promise<boolean>;
        canCreate: (entity: EntityType) => Promise<boolean>;
        canUpdate: (entity: EntityType) => Promise<boolean>;
        canDelete: (entity: EntityType) => Promise<boolean>;
      };
      title?: string;
    }
    interface PageData {
      session: Session | null;
      user: SessionUser | null;
      title?: string;
    }
  }
}

export {};
```

### 4.3 Actualización de layout.server.ts
**Archivo: `src/routes/+layout.server.ts`**
```typescript
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    session: locals.session,
    user: locals.user,
    title: locals.title
  };
};
```

### 4.4 Actualización de layout.ts
**Archivo: `src/routes/+layout.ts`**
```typescript
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data }) => {
  return {
    session: data.session,
    user: data.user,
    title: data.title
  };
};
```

### 4.5 Actualización de layout.svelte
**Archivo: `src/routes/+layout.svelte`**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidate } from '$app/navigation';
  import { browser } from '$app/environment';

  let { data, children } = $props();
  import '../style.css';
  import '$lib/styles/utils.css';
  import Toast from '$lib/components/Toast.svelte';

  let { session, user } = $derived(data);

  // Verificar sesión periódicamente (cada 5 minutos)
  onMount(() => {
    if (!browser) return;

    const interval = setInterval(() => {
      if (session) {
        // Verificar si la sesión ha expirado
        if (Date.now() > session.expiresAt) {
          invalidate('app:auth');
        }
      }
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  });
</script>

<Toast />

{@render children()}
```

## FASE 5: MIGRACIÓN DE MÓDULOS DE DATOS (Días 14-18)

### 5.1 Patrón de Migración de Módulos
**Antes (Supabase):**
```typescript
export async function getCourses(supabase: SupabaseClient) {
  const { data: courses, error } = await supabase
    .from('courses')
    .select('*')
    .order('order', { ascending: true });
  return error ? [] : courses;
}
```

**Después (Kysely):**
```typescript
import { db, type DB } from '$lib/database';
import type { Course } from '$lib/database/types';

export async function getCourses(database: DB = db): Promise<Course[]> {
  try {
    const courses = await database
      .selectFrom('courses')
      .selectAll()
      .orderBy('order', 'asc')
      .execute();

    return courses;
  } catch (error) {
    console.error('Error fetching courses:', error);
    return [];
  }
}
```

### 5.2 Migración de courses.ts
**Archivo: `src/lib/data/courses.ts`**
```typescript
import { db, type DB } from '$lib/database';
import type { Course, NewCourse, CourseUpdate } from '$lib/database/types';

export async function getCourses(database: DB = db): Promise<Course[]> {
  try {
    return await database
      .selectFrom('courses')
      .selectAll()
      .orderBy('order', 'asc')
      .execute();
  } catch (error) {
    console.error('Error fetching courses:', error);
    return [];
  }
}

export async function updateCourseOrder(
  courseCode: string,
  newOrder: number,
  database: DB = db
): Promise<boolean> {
  try {
    const result = await database
      .updateTable('courses')
      .set({ order: newOrder })
      .where('code', '=', courseCode)
      .executeTakeFirst();

    return result.numUpdatedRows > 0;
  } catch (error) {
    console.error('Error updating course order:', error);
    return false;
  }
}

export async function createCourse(
  course: NewCourse,
  database: DB = db
): Promise<Course | null> {
  try {
    return await database
      .insertInto('courses')
      .values(course)
      .returningAll()
      .executeTakeFirst();
  } catch (error) {
    console.error('Error creating course:', error);
    return null;
  }
}

export async function updateCourse(
  courseCode: string,
  updates: CourseUpdate,
  database: DB = db
): Promise<boolean> {
  try {
    const result = await database
      .updateTable('courses')
      .set(updates)
      .where('code', '=', courseCode)
      .executeTakeFirst();

    return result.numUpdatedRows > 0;
  } catch (error) {
    console.error('Error updating course:', error);
    return false;
  }
}

export async function deleteCourse(
  courseCode: string,
  database: DB = db
): Promise<boolean> {
  try {
    const result = await database
      .deleteFrom('courses')
      .where('code', '=', courseCode)
      .executeTakeFirst();

    return result.numDeletedRows > 0;
  } catch (error) {
    console.error('Error deleting course:', error);
    return false;
  }
}
```

### 5.3 Migración de levels.ts
**Archivo: `src/lib/data/levels.ts`**
```typescript
import { db, type DB } from '$lib/database';
import type { Level } from '$lib/database/types';

// Cache para almacenar niveles por usuario
const levelsCache = new Map<string, { data: Level[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function getLevels(
  userID: string,
  forceRefresh = false,
  database: DB = db
): Promise<Level[]> {
  // Verificar caché
  if (!forceRefresh && levelsCache.has(userID)) {
    const cache = levelsCache.get(userID)!;
    const now = Date.now();

    if (now - cache.timestamp < CACHE_TTL) {
      return cache.data;
    }
  }

  try {
    // Obtener niveles donde el usuario está en el array de users
    const levels = await database
      .selectFrom('levels')
      .selectAll()
      .where('users', '@>', JSON.stringify([userID]))
      .execute();

    // Actualizar caché
    levelsCache.set(userID, {
      data: levels,
      timestamp: Date.now()
    });

    return levels;
  } catch (error) {
    console.error('Error fetching levels:', error);
    return [];
  }
}

export async function getLevelByCode(
  levelCode: string,
  database: DB = db
): Promise<Level | null> {
  try {
    return await database
      .selectFrom('levels')
      .selectAll()
      .where('code', '=', levelCode)
      .executeTakeFirst() || null;
  } catch (error) {
    console.error('Error fetching level:', error);
    return null;
  }
}

export function clearLevelsCache(userID?: string): void {
  if (userID) {
    levelsCache.delete(userID);
  } else {
    levelsCache.clear();
  }
}
```

### 5.4 Migración de question.ts
**Archivo: `src/lib/data/question.ts`**
```typescript
import { db, type DB } from '$lib/database';
import type { EvalQuestion } from '$lib/database/types';

export async function fetchQuestions(
  evalCode: string,
  database: DB = db
): Promise<EvalQuestion[]> {
  try {
    return await database
      .selectFrom('evalQuestions')
      .selectAll()
      .where('evalCode', '=', evalCode)
      .orderBy('orderInEval', 'asc')
      .execute();
  } catch (error) {
    console.error('Error fetching questions:', error);
    return [];
  }
}

export async function hasEvalQuestions(
  evalCode: string,
  database: DB = db
): Promise<boolean> {
  try {
    const question = await database
      .selectFrom('evalQuestions')
      .select('code')
      .where('evalCode', '=', evalCode)
      .limit(1)
      .executeTakeFirst();

    return !!question;
  } catch (error) {
    console.error('Error checking eval questions:', error);
    return false;
  }
}

export async function getQuestionByCode(
  questionCode: string,
  database: DB = db
): Promise<EvalQuestion | null> {
  try {
    return await database
      .selectFrom('evalQuestions')
      .selectAll()
      .where('code', '=', questionCode)
      .executeTakeFirst() || null;
  } catch (error) {
    console.error('Error fetching question:', error);
    return null;
  }
}
```

## FASE 6: MIGRACIÓN DE FUNCIONES POSTGRESQL (Días 19-22)

### 6.1 Estrategia para Funciones Complejas
Las funciones PostgreSQL existentes se pueden manejar de dos formas:
1. **Mantener como funciones**: Usar `sql` template literal de Kysely
2. **Convertir a queries**: Reescribir la lógica en TypeScript con Kysely

### 6.2 Migración de dashboard.ts
**Archivo: `src/lib/data/dashboard.ts`**
```typescript
import { db, type DB, sql } from '$lib/database';
import type { LevelDashboardData, GroupDashboardData } from '$lib/types/dashboard';

// Opción 1: Mantener función PostgreSQL
export async function getLevelDashboardData(
  levelCode: string,
  database: DB = db
): Promise<LevelDashboardData | null> {
  try {
    const result = await sql<{
      data_type: string;
      json_data: any;
    }>`
      SELECT * FROM get_level_dashboard_data(${levelCode})
    `.execute(database);

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const dashboardData: LevelDashboardData = {
      scoresByGroup: [],
      correctVsIncorrect: { correct: 0, incorrect: 0, blank: 0 }
    };

    result.rows.forEach((row) => {
      if (row.data_type === 'scoresByGroup') {
        dashboardData.scoresByGroup = row.json_data;
      } else if (row.data_type === 'correctVsIncorrect') {
        dashboardData.correctVsIncorrect = row.json_data;
      }
    });

    return dashboardData;
  } catch (error) {
    console.error('Error fetching level dashboard data:', error);
    return null;
  }
}

// Opción 2: Reescribir con Kysely (más type-safe)
export async function getLevelDashboardDataKysely(
  levelCode: string,
  database: DB = db
): Promise<LevelDashboardData | null> {
  try {
    // Obtener datos de correct vs incorrect
    const correctVsIncorrectResult = await database
      .selectFrom('evalResults as er')
      .innerJoin('registers as r', 'er.registerCode', 'r.code')
      .select([
        sql<number>`COALESCE(SUM(er.correct_count), 0)`.as('correct'),
        sql<number>`COALESCE(SUM(er.incorrect_count), 0)`.as('incorrect'),
        sql<number>`COALESCE(SUM(er.blank_count), 0)`.as('blank')
      ])
      .where('r.levelCode', '=', levelCode)
      .where('er.sectionCode', 'is', null)
      .executeTakeFirst();

    // Obtener scores por grupo
    const scoresByGroupResult = await database
      .selectFrom('evalResults as er')
      .innerJoin('registers as r', 'er.registerCode', 'r.code')
      .select([
        'r.groupName as group',
        sql<number>`ROUND(AVG(er.score)::numeric, 2)`.as('averageScore')
      ])
      .where('r.levelCode', '=', levelCode)
      .where('er.sectionCode', 'is', null)
      .groupBy('r.groupName')
      .orderBy('r.groupName')
      .execute();

    return {
      correctVsIncorrect: correctVsIncorrectResult || { correct: 0, incorrect: 0, blank: 0 },
      scoresByGroup: scoresByGroupResult.map(row => ({
        group: row.group,
        averageScore: row.averageScore
      }))
    };
  } catch (error) {
    console.error('Error fetching level dashboard data with Kysely:', error);
    return null;
  }
}
```

### 6.3 Migración de studentDashboard.ts
**Archivo: `src/lib/data/studentDashboard.ts`**
```typescript
import { db, type DB, sql } from '$lib/database';
import type {
  StudentScoreEvolution,
  StudentCourseScore,
  StudentCourseEvolution
} from '$lib/types';

export async function getStudentScoreEvolution(
  studentCode: string,
  database: DB = db
): Promise<StudentScoreEvolution[] | null> {
  try {
    // Usar función PostgreSQL existente
    const result = await sql<StudentScoreEvolution>`
      SELECT * FROM get_student_score_evolution(${studentCode})
    `.execute(database);

    return result.rows;
  } catch (error) {
    console.error('Error fetching student score evolution:', error);
    return null;
  }
}

export async function getStudentCourseScores(
  studentCode: string,
  database: DB = db
): Promise<StudentCourseScore[] | null> {
  try {
    const result = await sql<StudentCourseScore>`
      SELECT * FROM get_student_course_scores(${studentCode})
    `.execute(database);

    return result.rows;
  } catch (error) {
    console.error('Error fetching student course scores:', error);
    return null;
  }
}

export async function getStudentCourseEvolution(
  studentCode: string,
  database: DB = db
): Promise<StudentCourseEvolution[] | null> {
  try {
    const result = await sql<StudentCourseEvolution>`
      SELECT * FROM get_student_course_evolution(${studentCode})
    `.execute(database);

    return result.rows;
  } catch (error) {
    console.error('Error fetching student course evolution:', error);
    return null;
  }
}
```

### 6.4 Migración de register.ts
**Archivo: `src/lib/data/register.ts`**
```typescript
import { db, type DB } from '$lib/database';
import type { StudentRegisterInfo } from '$lib/types';

export async function fetchRegisterByRollCode(
  rollCode: string,
  groupName: string,
  evalLevelCode: string,
  database: DB = db
): Promise<StudentRegisterInfo | null> {
  // Validar formato del roll code
  if (!rollCode || !/^\d{4}$/.test(rollCode)) {
    return null;
  }

  try {
    const result = await database
      .selectFrom('registers as r')
      .innerJoin('students as s', 'r.studentCode', 's.code')
      .select([
        'r.code',
        'r.rollCode',
        'r.groupName',
        'r.studentCode',
        's.name',
        's.lastName'
      ])
      .where('r.rollCode', '=', rollCode)
      .where('r.groupName', '=', groupName)
      .where('r.levelCode', '=', evalLevelCode)
      .executeTakeFirst();

    if (!result) return null;

    return {
      code: result.code,
      rollCode: result.rollCode,
      groupName: result.groupName,
      studentCode: result.studentCode,
      students: {
        name: result.name,
        lastName: result.lastName
      }
    };
  } catch (error) {
    console.error('Error fetching register by roll code:', error);
    return null;
  }
}

export async function getRegistersByLevel(
  levelCode: string,
  groupName?: string,
  database: DB = db
): Promise<StudentRegisterInfo[]> {
  try {
    let query = database
      .selectFrom('registers as r')
      .innerJoin('students as s', 'r.studentCode', 's.code')
      .select([
        'r.code',
        'r.rollCode',
        'r.groupName',
        'r.studentCode',
        's.name',
        's.lastName'
      ])
      .where('r.levelCode', '=', levelCode);

    if (groupName) {
      query = query.where('r.groupName', '=', groupName);
    }

    const results = await query
      .orderBy('r.rollCode', 'asc')
      .execute();

    return results.map(result => ({
      code: result.code,
      rollCode: result.rollCode,
      groupName: result.groupName,
      studentCode: result.studentCode,
      students: {
        name: result.name,
        lastName: result.lastName
      }
    }));
  } catch (error) {
    console.error('Error fetching registers by level:', error);
    return [];
  }
}
```

## FASE 7: MIGRACIÓN DE ENDPOINTS API (Días 23-26)

### 7.1 Patrón de Migración de APIs
**Antes (Supabase):**
```typescript
export const GET: RequestHandler = async ({ locals, url }) => {
  const { data: students, error } = await locals.supabase
    .from('students')
    .select('*')
    .or(`name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`);

  return new Response(JSON.stringify(students || []));
};
```

**Después (Kysely):**
```typescript
export const GET: RequestHandler = async ({ locals, url }) => {
  try {
    const searchQuery = url.searchParams.get('search');
    if (!searchQuery) {
      return json([]);
    }

    const students = await locals.db
      .selectFrom('students')
      .selectAll()
      .where((eb) => eb.or([
        eb('name', 'ilike', `%${searchQuery}%`),
        eb('lastName', 'ilike', `%${searchQuery}%`)
      ]))
      .execute();

    return json(students);
  } catch (error) {
    console.error('Error searching students:', error);
    return json([], { status: 500 });
  }
};
```

### 7.2 Migración de auth/+page.server.ts
**Archivo: `src/routes/auth/+page.server.ts`**
```typescript
import { fail, redirect } from '@sveltejs/kit';
import { compare } from 'bcryptjs';
import { createSession } from '$lib/auth/session';
import type { Actions } from './$types';

export const actions: Actions = {
  login: async ({ request, locals, cookies }) => {
    try {
      const formData = await request.formData();
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      // Validar inputs
      if (!email || !password) {
        return fail(400, {
          error: 'Email y contraseña son requeridos.'
        });
      }

      // Buscar usuario por email
      const user = await locals.db
        .selectFrom('users')
        .select(['id', 'email', 'passwordHash', 'isActive'])
        .where('email', '=', email.toLowerCase())
        .where('isActive', '=', true)
        .executeTakeFirst();

      if (!user) {
        return fail(400, {
          error: 'El correo o la contraseña son incorrectos.'
        });
      }

      // Verificar contraseña
      const isValidPassword = await compare(password, user.passwordHash);
      if (!isValidPassword) {
        return fail(400, {
          error: 'El correo o la contraseña son incorrectos.'
        });
      }

      // Crear sesión
      const session = await createSession(user.id, cookies);
      if (!session) {
        return fail(500, {
          error: 'Error al crear la sesión.'
        });
      }

      throw redirect(303, '/');
    } catch (error) {
      if (error instanceof Response) throw error; // Re-throw redirects

      console.error('Login error:', error);
      return fail(500, {
        error: 'Ocurrió un error inesperado.'
      });
    }
  }
};
```

### 7.3 Migración de api/logout/+server.ts
**Archivo: `src/routes/api/logout/+server.ts`**
```typescript
import { redirect } from '@sveltejs/kit';
import { destroySession } from '$lib/auth/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
  try {
    destroySession(cookies);
    throw redirect(303, '/auth');
  } catch (error) {
    if (error instanceof Response) throw error; // Re-throw redirects

    console.error('Logout error:', error);
    return new Response(
      JSON.stringify({ error: 'Error al cerrar sesión' }),
      { status: 500 }
    );
  }
};
```

### 7.4 Migración de api/student/+server.ts
**Archivo: `src/routes/api/student/+server.ts`**
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
  try {
    const searchQuery = url.searchParams.get('search');

    if (!searchQuery) {
      return json([]);
    }

    const students = await locals.db
      .selectFrom('students')
      .selectAll()
      .where((eb) => eb.or([
        eb('name', 'ilike', `%${searchQuery}%`),
        eb('lastName', 'ilike', `%${searchQuery}%`)
      ]))
      .limit(50) // Limitar resultados para performance
      .execute();

    return json(students);
  } catch (error) {
    console.error('Error searching students:', error);
    return json([], { status: 500 });
  }
};
```

### 7.5 Migración de api/student/[level]/[group]/+server.ts
**Archivo: `src/routes/api/student/[level]/[group]/+server.ts`**
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
  try {
    const { level, group } = params;

    if (!level || !group) {
      return json([]);
    }

    // Usar la vista student_registers o hacer join manual
    const students = await locals.db
      .selectFrom('registers as r')
      .innerJoin('students as s', 'r.studentCode', 's.code')
      .innerJoin('levels as l', 'r.levelCode', 'l.code')
      .select([
        's.code as studentCode',
        'r.code as registerCode',
        's.name',
        's.lastName',
        's.email',
        's.phone',
        'r.rollCode',
        'r.groupName',
        'r.levelCode',
        'l.name as level',
        's.createdAt'
      ])
      .where('r.levelCode', '=', level)
      .where('r.groupName', '=', group)
      .orderBy('r.rollCode', 'asc')
      .execute();

    return json(students);
  } catch (error) {
    console.error('Error fetching students by level and group:', error);
    return json([], { status: 500 });
  }
};
```

### 7.6 Migración de api/dashboard/counts/+server.ts
**Archivo: `src/routes/api/dashboard/counts/+server.ts`**
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  try {
    // Ejecutar queries en paralelo para mejor performance
    const [studentsCount, evalsCount, levelsCount, coursesCount] = await Promise.all([
      locals.db
        .selectFrom('students')
        .select((eb) => eb.fn.count('code').as('count'))
        .executeTakeFirst(),

      locals.db
        .selectFrom('evals')
        .select((eb) => eb.fn.count('code').as('count'))
        .executeTakeFirst(),

      locals.db
        .selectFrom('levels')
        .select((eb) => eb.fn.count('code').as('count'))
        .executeTakeFirst(),

      locals.db
        .selectFrom('courses')
        .select((eb) => eb.fn.count('code').as('count'))
        .executeTakeFirst()
    ]);

    return json({
      students: Number(studentsCount?.count || 0),
      evaluations: Number(evalsCount?.count || 0),
      levels: Number(levelsCount?.count || 0),
      courses: Number(coursesCount?.count || 0)
    });
  } catch (error) {
    console.error('Error fetching dashboard counts:', error);
    return json(
      { error: 'Error al obtener contadores del dashboard' },
      { status: 500 }
    );
  }
};
```

## FASE 8: MIGRACIÓN DE PÁGINAS SERVER (Días 27-29)

### 8.1 Migración de levels/+page.server.ts
**Archivo: `src/routes/(home)/levels/+page.server.ts`**
```typescript
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { getLevels } from '$lib/data/levels';

export const load: PageServerLoad = async ({ locals, depends }) => {
  depends('levels:load');

  try {
    const levels = await getLevels(locals.user?.id || '', false, locals.db);
    return {
      levels,
      title: 'Niveles'
    };
  } catch (error) {
    console.error('Error loading levels:', error);
    return {
      levels: [],
      title: 'Niveles'
    };
  }
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    try {
      // Verificar permisos
      const canCreate = await locals.can.canCreate('levels');
      if (!canCreate) {
        return fail(403, { error: 'No tienes permisos para crear niveles' });
      }

      const formData = await request.formData();
      const name = formData.get('name') as string;
      const abr = formData.get('abr') as string;

      if (!name || !abr) {
        return fail(400, { error: 'Nombre y abreviación son requeridos' });
      }

      const newLevel = await locals.db
        .insertInto('levels')
        .values({
          name,
          abr,
          users: [locals.user!.id]
        })
        .returningAll()
        .executeTakeFirst();

      if (!newLevel) {
        return fail(500, { error: 'Error al crear el nivel' });
      }

      return { success: true, level: newLevel };
    } catch (error) {
      console.error('Error creating level:', error);
      return fail(500, { error: 'Error interno del servidor' });
    }
  }
};
```

### 8.2 Migración de dashboard/+page.server.ts
**Archivo: `src/routes/(home)/dashboard/+page.server.ts`**
```typescript
import { getLevels } from '$lib/data/levels';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  try {
    const userId = locals.user?.id;
    let levels = [];

    if (userId) {
      levels = await getLevels(userId, false, locals.db);
    }

    return {
      levels,
      title: 'Dashboard'
    };
  } catch (error) {
    console.error('Error loading dashboard:', error);
    return {
      levels: [],
      title: 'Dashboard'
    };
  }
};
```

### 8.3 Actualización de Stores
**Archivo: `src/lib/stores/permissions.ts`**
```typescript
import { writable, derived, type Readable, get } from 'svelte/store';
import type { DB } from '$lib/database';
import { browser } from '$app/environment';

type Permission = {
  code: string;
  userCode: string;
  entity: string;
  userAction: string;
};

type PermissionCheck = {
  entity: string;
  action: 'read' | 'create' | 'update' | 'delete';
};

// Cache key para localStorage
const PERMISSIONS_CACHE_KEY = 'nextya_permissions_cache';
const PERMISSIONS_CACHE_EXPIRY_KEY = 'nextya_permissions_cache_expiry';
const CACHE_TTL = 1000 * 60 * 30; // 30 minutos

function createPermissionsStore() {
  const { subscribe, set, update } = writable<Permission[]>([]);

  return {
    subscribe,

    async fetchPermissions(db: DB, userId: string) {
      if (!browser) return;

      try {
        // Verificar caché
        const cached = localStorage.getItem(PERMISSIONS_CACHE_KEY);
        const cacheExpiry = localStorage.getItem(PERMISSIONS_CACHE_EXPIRY_KEY);

        if (cached && cacheExpiry && Date.now() < parseInt(cacheExpiry)) {
          set(JSON.parse(cached));
          return;
        }

        // Obtener permisos frescos
        const permissions = await db
          .selectFrom('permissions')
          .selectAll()
          .where('userCode', '=', userId)
          .execute();

        set(permissions);

        // Actualizar caché
        localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(permissions));
        localStorage.setItem(PERMISSIONS_CACHE_EXPIRY_KEY, (Date.now() + CACHE_TTL).toString());
      } catch (error) {
        console.error('Error fetching permissions:', error);
        set([]);
      }
    },

    clearPermissions() {
      if (!browser) return;

      set([]);
      localStorage.removeItem(PERMISSIONS_CACHE_KEY);
      localStorage.removeItem(PERMISSIONS_CACHE_EXPIRY_KEY);
    },

    hasPermission(entity: string, action: string): boolean {
      const permissions = get({ subscribe });
      return permissions.some(p => p.entity === entity && p.userAction === action);
    }
  };
}

export const permissionsStore = createPermissionsStore();

// Derived stores para verificaciones comunes
export const canRead = derived(
  permissionsStore,
  ($permissions) => (entity: string) =>
    $permissions.some(p => p.entity === entity && p.userAction === 'read')
);

export const canCreate = derived(
  permissionsStore,
  ($permissions) => (entity: string) =>
    $permissions.some(p => p.entity === entity && p.userAction === 'create')
);

export const canUpdate = derived(
  permissionsStore,
  ($permissions) => (entity: string) =>
    $permissions.some(p => p.entity === entity && p.userAction === 'update')
);

export const canDelete = derived(
  permissionsStore,
  ($permissions) => (entity: string) =>
    $permissions.some(p => p.entity === entity && p.userAction === 'delete')
);
```

## FASE 9: TESTING Y VALIDACIÓN (Días 30-33)

### 9.1 Configuración de Testing
```bash
# Instalar dependencias de testing
npm install -D vitest @testing-library/svelte @testing-library/jest-dom
npm install -D @vitest/ui jsdom
```

**Archivo: `vitest.config.ts`**
```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts']
  }
});
```

### 9.2 Tests de Autenticación
**Archivo: `src/lib/auth/auth.test.ts`**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { generateToken, verifyToken, refreshToken } from './jwt';

describe('JWT Authentication', () => {
  const userId = 'test-user-id';
  const email = 'test@example.com';

  it('should generate valid token', () => {
    const token = generateToken(userId, email);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('should verify valid token', () => {
    const token = generateToken(userId, email);
    const payload = verifyToken(token);

    expect(payload).toBeDefined();
    expect(payload?.userId).toBe(userId);
    expect(payload?.email).toBe(email);
  });

  it('should reject invalid token', () => {
    const payload = verifyToken('invalid-token');
    expect(payload).toBeNull();
  });

  it('should refresh token when needed', () => {
    const token = generateToken(userId, email);
    const refreshed = refreshToken(token);

    // Token recién generado no debería necesitar refresh
    expect(refreshed).toBe(token);
  });
});
```

### 9.3 Tests de Base de Datos
**Archivo: `src/lib/data/courses.test.ts`**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCourses, createCourse, updateCourseOrder } from './courses';
import { db } from '$lib/database';
import type { NewCourse } from '$lib/database/types';

describe('Courses Data Module', () => {
  beforeEach(async () => {
    // Setup test data
    await db.deleteFrom('courses').execute();
  });

  afterEach(async () => {
    // Cleanup
    await db.deleteFrom('courses').execute();
  });

  it('should fetch courses ordered by order field', async () => {
    // Insert test courses
    await db.insertInto('courses').values([
      { name: 'Course B', order: 2, userCode: 'test-user' },
      { name: 'Course A', order: 1, userCode: 'test-user' }
    ]).execute();

    const courses = await getCourses(db);

    expect(courses).toHaveLength(2);
    expect(courses[0].name).toBe('Course A');
    expect(courses[1].name).toBe('Course B');
  });

  it('should create new course', async () => {
    const newCourse: NewCourse = {
      name: 'Test Course',
      order: 1,
      userCode: 'test-user'
    };

    const created = await createCourse(newCourse, db);

    expect(created).toBeDefined();
    expect(created?.name).toBe('Test Course');
  });

  it('should update course order', async () => {
    const course = await db.insertInto('courses')
      .values({ name: 'Test Course', order: 1, userCode: 'test-user' })
      .returningAll()
      .executeTakeFirst();

    const updated = await updateCourseOrder(course!.code, 5, db);

    expect(updated).toBe(true);

    const updatedCourse = await db
      .selectFrom('courses')
      .selectAll()
      .where('code', '=', course!.code)
      .executeTakeFirst();

    expect(updatedCourse?.order).toBe(5);
  });
});
```

### 9.4 Tests de Integración
**Archivo: `src/routes/api/student/student.test.ts`**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './+server';
import { db } from '$lib/database';

describe('/api/student endpoint', () => {
  beforeEach(async () => {
    // Setup test data
    await db.deleteFrom('students').execute();
    await db.insertInto('students').values([
      { name: 'John', lastName: 'Doe', email: 'john@example.com' },
      { name: 'Jane', lastName: 'Smith', email: 'jane@example.com' }
    ]).execute();
  });

  it('should return empty array when no search query', async () => {
    const request = new Request('http://localhost/api/student');
    const response = await GET({
      request,
      locals: { db },
      url: new URL('http://localhost/api/student')
    } as any);

    const data = await response.json();
    expect(data).toEqual([]);
  });

  it('should search students by name', async () => {
    const request = new Request('http://localhost/api/student?search=John');
    const response = await GET({
      request,
      locals: { db },
      url: new URL('http://localhost/api/student?search=John')
    } as any);

    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('John');
  });
});
```

### 9.5 Plan de Testing
1. **Tests Unitarios** (Días 30-31):
   - Módulos de autenticación
   - Módulos de datos
   - Utilidades y helpers

2. **Tests de Integración** (Día 32):
   - Endpoints API
   - Flujos de autenticación
   - Operaciones de base de datos

3. **Tests E2E** (Día 33):
   - Flujo completo de login
   - Navegación entre páginas
   - Operaciones CRUD principales

### 9.6 Validación de Performance
```typescript
// Archivo: src/test/performance.test.ts
import { describe, it, expect } from 'vitest';
import { db } from '$lib/database';
import { getLevelDashboardData } from '$lib/data/dashboard';

describe('Performance Tests', () => {
  it('should fetch dashboard data within acceptable time', async () => {
    const start = Date.now();

    await getLevelDashboardData('test-level-code', db);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // Menos de 1 segundo
  });

  it('should handle concurrent requests', async () => {
    const promises = Array(10).fill(null).map(() =>
      getLevelDashboardData('test-level-code', db)
    );

    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(3000); // Menos de 3 segundos para 10 requests
  });
});
```

## FASE 10: DEPLOYMENT Y MIGRACIÓN EN PRODUCCIÓN (Días 34-37)

### 10.1 Preparación del Servidor de Producción
```bash
# En servidor carrioneduca.edu.pe
sudo apt update && sudo apt upgrade -y

# Instalar PostgreSQL 15+
sudo apt install postgresql-15 postgresql-contrib-15

# Configurar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear base de datos de producción
sudo -u postgres createdb nextya_production
sudo -u postgres createuser nextya_user
sudo -u postgres psql -c "ALTER USER nextya_user WITH PASSWORD 'SECURE_PRODUCTION_PASSWORD';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE nextya_production TO nextya_user;"

# Configurar conexiones
sudo nano /etc/postgresql/15/main/postgresql.conf
# listen_addresses = 'localhost'
# max_connections = 100

sudo nano /etc/postgresql/15/main/pg_hba.conf
# local   nextya_production   nextya_user   md5
```

### 10.2 Variables de Entorno de Producción
**Archivo: `.env.production`**
```bash
# Base de datos
DATABASE_URL="postgresql://nextya_user:SECURE_PASSWORD@localhost:5432/nextya_production"
DATABASE_HOST="localhost"
DATABASE_PORT="5432"
DATABASE_NAME="nextya_production"
DATABASE_USER="nextya_user"
DATABASE_PASSWORD="SECURE_PRODUCTION_PASSWORD"

# JWT
JWT_SECRET="SUPER_SECURE_JWT_SECRET_256_BITS_MINIMUM"
JWT_EXPIRES_IN="8h"

# Aplicación
NODE_ENV="production"
ORIGIN="https://carrioneduca.edu.pe"

# Logging
LOG_LEVEL="info"
```

### 10.3 Script de Migración de Datos
**Archivo: `scripts/migrate-from-supabase.ts`**
```typescript
import { createClient } from '@supabase/supabase-js';
import { db } from '../src/lib/database';
import { hash } from 'bcryptjs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrateUsers() {
  console.log('Migrating users...');

  // Obtener usuarios de Supabase Auth
  const { data: authUsers } = await supabase.auth.admin.listUsers();

  for (const authUser of authUsers.users) {
    // Generar password temporal (usuarios deberán resetear)
    const tempPassword = Math.random().toString(36).slice(-12);
    const passwordHash = await hash(tempPassword, 12);

    await db.insertInto('users')
      .values({
        id: authUser.id,
        email: authUser.email!,
        passwordHash,
        name: authUser.user_metadata?.name || null,
        createdAt: new Date(authUser.created_at),
        isActive: true
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();

    console.log(`Migrated user: ${authUser.email}`);
  }
}

async function migrateTableData(tableName: string) {
  console.log(`Migrating ${tableName}...`);

  const { data, error } = await supabase
    .from(tableName)
    .select('*');

  if (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return;
  }

  if (!data || data.length === 0) {
    console.log(`No data found for ${tableName}`);
    return;
  }

  // Insertar datos en lotes de 100
  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    await db.insertInto(tableName as any)
      .values(batch)
      .onConflict((oc) => oc.column('code').doNothing())
      .execute();

    console.log(`Migrated ${batch.length} records from ${tableName}`);
  }
}

async function main() {
  try {
    console.log('Starting migration from Supabase...');

    // Migrar en orden de dependencias
    await migrateUsers();
    await migrateTableData('levels');
    await migrateTableData('courses');
    await migrateTableData('students');
    await migrateTableData('registers');
    await migrateTableData('evals');
    await migrateTableData('eval_sections');
    await migrateTableData('eval_questions');
    await migrateTableData('eval_answers');
    await migrateTableData('eval_results');
    await migrateTableData('permissions');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
```

### 10.4 Proceso de Deployment
```bash
# 1. Backup de base de datos actual
pg_dump nextya_production > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Ejecutar migraciones
npm run migrate:up

# 3. Migrar datos desde Supabase
npm run migrate:from-supabase

# 4. Build de la aplicación
npm run build

# 5. Restart del servicio
sudo systemctl restart nextya-app
```

### 10.5 Configuración de Nginx
**Archivo: `/etc/nginx/sites-available/nextya`**
```nginx
server {
    listen 80;
    server_name carrioneduca.edu.pe;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name carrioneduca.edu.pe;

    ssl_certificate /etc/letsencrypt/live/carrioneduca.edu.pe/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/carrioneduca.edu.pe/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 10.6 Servicio Systemd
**Archivo: `/etc/systemd/system/nextya-app.service`**
```ini
[Unit]
Description=NextYa SvelteKit Application
After=network.target postgresql.service

[Service]
Type=simple
User=nextya
WorkingDirectory=/var/www/nextya
ExecStart=/usr/bin/node build/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/var/www/nextya/.env.production

[Install]
WantedBy=multi-user.target
```

### 10.7 Monitoreo y Logs
```bash
# Configurar logrotate
sudo nano /etc/logrotate.d/nextya

/var/log/nextya/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 nextya nextya
    postrotate
        systemctl reload nextya-app
    endscript
}
```

## FASE 11: OPTIMIZACIÓN Y MONITOREO (Días 38-40)

### 11.1 Optimización de Queries
**Archivo: `src/lib/database/optimizations.ts`**
```typescript
import { db } from './index';

// Crear índices para mejorar performance
export async function createOptimizationIndexes() {
  await db.schema
    .createIndex('idx_registers_level_group')
    .on('registers')
    .columns(['levelCode', 'groupName'])
    .ifNotExists()
    .execute();

  await db.schema
    .createIndex('idx_eval_results_register')
    .on('evalResults')
    .columns(['registerCode', 'evalCode'])
    .ifNotExists()
    .execute();

  await db.schema
    .createIndex('idx_eval_questions_eval')
    .on('evalQuestions')
    .columns(['evalCode', 'orderInEval'])
    .ifNotExists()
    .execute();

  await db.schema
    .createIndex('idx_permissions_user_entity')
    .on('permissions')
    .columns(['userCode', 'entity', 'userAction'])
    .ifNotExists()
    .execute();

  await db.schema
    .createIndex('idx_students_name_search')
    .on('students')
    .expression('LOWER(name || \' \' || last_name)')
    .ifNotExists()
    .execute();
}
```

### 11.2 Connection Pooling Avanzado
**Archivo: `src/lib/database/connection.ts`**
```typescript
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from './types';

// Configuración optimizada del pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Máximo 20 conexiones
  min: 5,  // Mínimo 5 conexiones activas
  idleTimeoutMillis: 30000, // 30 segundos timeout
  connectionTimeoutMillis: 2000, // 2 segundos para conectar
  acquireTimeoutMillis: 60000, // 60 segundos para obtener conexión

  // Configuración de keep-alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,

  // Configuración SSL para producción
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// Eventos de monitoreo
pool.on('connect', (client) => {
  console.log('New client connected');
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

pool.on('remove', () => {
  console.log('Client removed from pool');
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
  log: process.env.NODE_ENV === 'development' ? (event) => {
    if (event.level === 'query') {
      console.log('Query:', event.query.sql);
      console.log('Duration:', event.queryDurationMillis, 'ms');
    }
  } : undefined,
});

// Función para verificar salud de la base de datos
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.selectFrom('users').select('id').limit(1).execute();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Función para obtener estadísticas del pool
export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}
```

### 11.3 Sistema de Logging
**Archivo: `src/lib/utils/logger.ts`**
```typescript
import { createWriteStream } from 'fs';
import { join } from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private logStream: NodeJS.WritableStream;
  private level: LogLevel;

  constructor() {
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info';

    if (process.env.NODE_ENV === 'production') {
      this.logStream = createWriteStream(
        join(process.cwd(), 'logs', 'app.log'),
        { flags: 'a' }
      );
    } else {
      this.logStream = process.stdout;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}\n`;
  }

  debug(message: string, meta?: any) {
    if (this.shouldLog('debug')) {
      this.logStream.write(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: any) {
    if (this.shouldLog('info')) {
      this.logStream.write(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: any) {
    if (this.shouldLog('warn')) {
      this.logStream.write(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, meta?: any) {
    if (this.shouldLog('error')) {
      this.logStream.write(this.formatMessage('error', message, meta));
    }
  }

  // Método especial para queries lentas
  slowQuery(query: string, duration: number, params?: any[]) {
    this.warn('Slow query detected', {
      query,
      duration,
      params,
      threshold: '1000ms'
    });
  }
}

export const logger = new Logger();
```

### 11.4 Middleware de Performance
**Archivo: `src/lib/middleware/performance.ts`**
```typescript
import type { Handle } from '@sveltejs/kit';
import { logger } from '$lib/utils/logger';
import { getPoolStats } from '$lib/database/connection';

export const performanceMiddleware: Handle = async ({ event, resolve }) => {
  const start = Date.now();
  const url = event.url.pathname;

  // Agregar headers de performance
  event.setHeaders({
    'X-Request-ID': crypto.randomUUID(),
    'X-Timestamp': new Date().toISOString()
  });

  try {
    const response = await resolve(event);
    const duration = Date.now() - start;

    // Log de requests lentos (>2 segundos)
    if (duration > 2000) {
      logger.warn('Slow request detected', {
        url,
        duration,
        method: event.request.method,
        userAgent: event.request.headers.get('user-agent')
      });
    }

    // Agregar headers de timing
    response.headers.set('X-Response-Time', `${duration}ms`);

    // Log de estadísticas del pool cada 100 requests
    if (Math.random() < 0.01) {
      logger.info('Database pool stats', getPoolStats());
    }

    return response;
  } catch (error) {
    const duration = Date.now() - start;

    logger.error('Request failed', {
      url,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    throw error;
  }
};
```

### 11.5 Health Check Endpoint
**Archivo: `src/routes/api/health/+server.ts`**
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkDatabaseHealth, getPoolStats } from '$lib/database/connection';

export const GET: RequestHandler = async () => {
  try {
    const dbHealthy = await checkDatabaseHealth();
    const poolStats = getPoolStats();

    const health = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbHealthy,
        pool: poolStats
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      uptime: Math.round(process.uptime())
    };

    return json(health, {
      status: dbHealthy ? 200 : 503
    });
  } catch (error) {
    return json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
```

### 11.6 Configuración de Monitoreo
```bash
# Instalar herramientas de monitoreo
sudo apt install htop iotop nethogs

# Configurar monitoreo de PostgreSQL
sudo nano /etc/postgresql/15/main/postgresql.conf

# Habilitar logging de queries lentas
log_min_duration_statement = 1000  # Log queries > 1 segundo
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on

# Configurar shared_preload_libraries para pg_stat_statements
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
```

## CRONOGRAMA DETALLADO Y ENTREGABLES

### Semana 1 (Días 1-7): Fundación
| Día | Actividad | Entregable |
|-----|-----------|------------|
| 1-2 | Análisis y configuración PostgreSQL | Base de datos configurada |
| 3-4 | Configuración Kysely y tipos | Sistema de tipos funcionando |
| 5-6 | Sistema de autenticación JWT | Auth system completo |
| 7   | Testing inicial | Tests básicos pasando |

### Semana 2 (Días 8-14): Core Migration
| Día | Actividad | Entregable |
|-----|-----------|------------|
| 8-9 | Refactorización hooks y layouts | Layouts funcionando |
| 10-11 | Migración módulos de datos básicos | courses.ts, levels.ts migrados |
| 12-13 | Migración módulos complejos | dashboard.ts, question.ts migrados |
| 14  | Testing de módulos | Tests de datos pasando |

### Semana 3 (Días 15-21): API Migration
| Día | Actividad | Entregable |
|-----|-----------|------------|
| 15-16 | Migración endpoints básicos | APIs de estudiantes funcionando |
| 17-18 | Migración endpoints complejos | APIs de dashboard funcionando |
| 19-20 | Migración funciones PostgreSQL | Funciones complejas migradas |
| 21  | Testing de APIs | Tests de integración pasando |

### Semana 4 (Días 22-28): Pages & Stores
| Día | Actividad | Entregable |
|-----|-----------|------------|
| 22-23 | Migración páginas server | Page loads funcionando |
| 24-25 | Actualización de stores | Stores refactorizados |
| 26-27 | Testing completo | Suite de tests completa |
| 28  | Preparación deployment | Scripts de deployment listos |

### Semana 5 (Días 29-35): Production
| Día | Actividad | Entregable |
|-----|-----------|------------|
| 29-30 | Configuración servidor producción | Servidor configurado |
| 31-32 | Migración de datos | Datos migrados exitosamente |
| 33-34 | Deployment y testing | Aplicación en producción |
| 35  | Optimización inicial | Performance optimizado |

### Semana 6 (Días 36-40): Optimization
| Día | Actividad | Entregable |
|-----|-----------|------------|
| 36-37 | Monitoreo y logging | Sistema de monitoreo activo |
| 38-39 | Optimización avanzada | Performance mejorado |
| 40  | Documentación final | Documentación completa |

## RIESGOS Y MITIGACIONES

### Riesgos Técnicos
1. **Pérdida de datos durante migración**
   - **Mitigación**: Backups completos antes de cada paso
   - **Plan B**: Rollback automático a Supabase

2. **Incompatibilidades de tipos**
   - **Mitigación**: Uso de kysely-codegen para tipos automáticos
   - **Plan B**: Definición manual de tipos críticos

3. **Performance degradada**
   - **Mitigación**: Benchmarking continuo y optimización de queries
   - **Plan B**: Mantener funciones PostgreSQL complejas

### Riesgos de Negocio
1. **Downtime prolongado**
   - **Mitigación**: Migración en horarios de baja actividad
   - **Plan B**: Blue-green deployment

2. **Pérdida de funcionalidad**
   - **Mitigación**: Testing exhaustivo en staging
   - **Plan B**: Feature flags para rollback selectivo

## CRITERIOS DE ÉXITO

### Técnicos
- ✅ 100% de funcionalidades migradas
- ✅ Performance igual o mejor que Supabase
- ✅ 0 pérdida de datos
- ✅ Tests con >90% cobertura
- ✅ Tiempo de respuesta <2s para 95% de requests

### Operacionales
- ✅ Deployment automatizado
- ✅ Monitoreo completo implementado
- ✅ Documentación actualizada
- ✅ Equipo entrenado en nueva arquitectura

### Seguridad
- ✅ Autenticación JWT segura
- ✅ Sesiones con expiración de 8 horas
- ✅ Permisos funcionando correctamente
- ✅ Logs de auditoría implementados

## COMANDOS DE EJECUCIÓN

### Desarrollo
```bash
# Instalar dependencias
npm install

# Generar tipos de base de datos
npm run db:generate-types

# Ejecutar migraciones
npm run db:migrate

# Iniciar desarrollo
npm run dev

# Ejecutar tests
npm run test
npm run test:coverage
```

### Producción
```bash
# Build para producción
npm run build

# Ejecutar migraciones en producción
npm run db:migrate:prod

# Migrar datos desde Supabase
npm run migrate:from-supabase

# Iniciar aplicación
npm start

# Health check
curl https://carrioneduca.edu.pe/api/health
```

## CONCLUSIÓN

Este roadmap proporciona una migración **100% estructurada** y **100% efectiva** de Supabase a PostgreSQL self-hosted con Kysely ORM. La implementación mantiene todas las funcionalidades existentes mientras mejora el control, performance y reduce costos operacionales.

**Beneficios clave:**
- 🔒 **Control total** sobre la base de datos
- 🚀 **Performance optimizada** con queries type-safe
- 💰 **Reducción de costos** eliminando dependencia de Supabase
- 🛡️ **Seguridad mejorada** con autenticación custom
- 📊 **Monitoreo completo** de la aplicación
- 🔧 **Mantenimiento simplificado** con herramientas modernas

La migración está diseñada para ser **incremental**, **reversible** y **sin pérdida de datos**, garantizando una transición exitosa a la nueva arquitectura.

### Día 1: Análisis Detallado y Decisiones Técnicas
**Duración**: 8 horas
**Responsable**: Desarrollador Principal

#### Tareas:
- [ ] **Análisis completo de dependencias Supabase** (2h)
  - Mapear todos los usos de `locals.supabase`
  - Identificar funciones específicas de Supabase
  - Documentar esquemas de base de datos

- [ ] **Selección de ORM** (3h)
  - **Recomendación**: Drizzle ORM
  - **Justificación**:
    - Lightweight y performante
    - Type-safe con TypeScript
    - SQL-like syntax (fácil migración)
    - Excelente para SvelteKit
    - Mejor rendimiento que Prisma
    - Menor overhead que Supabase client

- [ ] **Diseño de arquitectura de autenticación** (3h)
  - JWT con refresh tokens
  - Session management en cookies
  - Middleware personalizado para SvelteKit
  - Compatibilidad con estructura actual

#### Entregables:
- Documento de arquitectura técnica
- Lista completa de dependencias a migrar
- Esquema de base de datos PostgreSQL

### Día 2: Configuración del Entorno de Desarrollo
**Duración**: 6 horas

#### Tareas:
- [ ] **Setup PostgreSQL local** (2h)
  - Instalación PostgreSQL 15+
  - Configuración de usuario y base de datos
  - Configuración de conexiones

- [ ] **Instalación y configuración Drizzle** (2h)
  ```bash
  npm install drizzle-orm pg
  npm install -D drizzle-kit @types/pg
  ```

- [ ] **Configuración inicial del proyecto** (2h)
  - Estructura de carpetas para nuevo sistema
  - Variables de entorno
  - Scripts de desarrollo

#### Entregables:
- Entorno de desarrollo funcional
- Configuración base de Drizzle

### Día 3-4: Migración del Schema de Base de Datos
**Duración**: 12 horas (6h cada día)

#### Tareas:
- [ ] **Conversión de migraciones Supabase** (6h)
  - Convertir 25+ archivos de migración
  - Adaptar tipos y enums
  - Crear schema Drizzle equivalente

- [ ] **Configuración de Drizzle Schema** (4h)
  - Definir tablas en TypeScript
  - Configurar relaciones
  - Generar tipos automáticos

- [ ] **Testing del schema** (2h)
  - Verificar integridad referencial
  - Probar migraciones
  - Validar tipos generados

#### Entregables:
- Schema completo en Drizzle
- Migraciones funcionales
- Tipos TypeScript generados

### Día 5: Preparación del Servidor de Producción
**Duración**: 8 horas

#### Tareas:
- [ ] **Setup PostgreSQL en Debian** (4h)
  - Instalación PostgreSQL en servidor
  - Configuración de seguridad
  - Setup de backups automáticos
  - Configuración de conexiones remotas

- [ ] **Configuración de red y seguridad** (2h)
  - Firewall rules
  - SSL certificates
  - Configuración de puertos

- [ ] **Testing de conectividad** (2h)
  - Pruebas de conexión desde desarrollo
  - Verificación de rendimiento
  - Setup de monitoreo básico

#### Entregables:
- Servidor PostgreSQL funcional
- Documentación de configuración

## FASE 2: DESARROLLO DEL SISTEMA DE AUTENTICACIÓN (Días 6-12)

### Día 6-7: Implementación de Auth Core
**Duración**: 12 horas (6h cada día)

#### Tareas:
- [ ] **Desarrollo del sistema JWT** (6h)
  - Generación y validación de tokens
  - Refresh token mechanism
  - Configuración de expiración (8 horas)

- [ ] **Implementación de session management** (4h)
  - Cookie-based sessions
  - Secure cookie configuration
  - Session persistence

- [ ] **Middleware de autenticación** (2h)
  - Reemplazo de `hooks.server.ts`
  - Validación de sesiones
  - Redirecciones automáticas

#### Entregables:
- Sistema de autenticación funcional
- Middleware personalizado

### Día 8-9: Migración de Auth Endpoints
**Duración**: 12 horas (6h cada día)

#### Tareas:
- [ ] **Endpoints de autenticación** (8h)
  - `/api/auth/login`
  - `/api/auth/logout`
  - `/api/auth/refresh`
  - `/api/auth/register` (si aplica)

- [ ] **Integración con layouts** (4h)
  - Actualizar `+layout.server.ts`
  - Modificar `+layout.ts`
  - Mantener compatibilidad con `locals`

#### Entregables:
- API de autenticación completa
- Layouts actualizados

### Día 10-12: Sistema de Permisos
**Duración**: 18 horas (6h cada día)

#### Tareas:
- [ ] **Migración del sistema de permisos** (8h)
  - Recrear tabla `permissions`
  - Implementar `has_permission` function
  - Integrar con nuevo auth system

- [ ] **Store de permisos** (4h)
  - Actualizar `permissionsStore`
  - Mantener funcionalidad existente
  - Optimizar caching

- [ ] **Testing de permisos** (6h)
  - Verificar todos los casos de uso
  - Testing de seguridad
  - Validación de roles

#### Entregables:
- Sistema de permisos funcional
- Store actualizado

## FASE 3: MIGRACIÓN DE MÓDULOS DE DATOS (Días 13-20)

### Día 13-14: Migración de Módulos Core
**Duración**: 12 horas (6h cada día)

#### Tareas:
- [ ] **Migración de módulos básicos** (8h)
  - `levels.ts` → Drizzle queries
  - `courses.ts` → Drizzle queries
  - `students.ts` → Drizzle queries
  - Mantener caching existente

- [ ] **Actualización de tipos** (4h)
  - Adaptar interfaces existentes
  - Generar nuevos tipos desde Drizzle
  - Mantener compatibilidad

#### Entregables:
- 3 módulos migrados y funcionales

### Día 15-16: Migración de Módulos de Evaluación
**Duración**: 12 horas (6h cada día)

#### Tareas:
- [ ] **Módulos de evaluación** (10h)
  - `eval.ts` → Drizzle queries
  - `question.ts` → Drizzle queries
  - `register.ts` → Drizzle queries
  - Optimizar queries complejas

- [ ] **Testing de funcionalidad** (2h)
  - Verificar todas las operaciones
  - Comparar rendimiento
  - Validar resultados

#### Entregables:
- Módulos de evaluación migrados

### Día 17-18: Migración de Dashboard y Analytics
**Duración**: 12 horas (6h cada día)

#### Tareas:
- [ ] **Módulos de dashboard** (8h)
  - `dashboard.ts` → Drizzle queries
  - `courseDashboard.ts` → Drizzle queries
  - `studentDashboard.ts` → Drizzle queries
  - `evalDashboard.ts` → Drizzle queries

- [ ] **Optimización de queries** (4h)
  - Implementar joins eficientes
  - Optimizar agregaciones
  - Mantener rendimiento

#### Entregables:
- Dashboards funcionales con nuevo sistema

### Día 19-20: Finalización de Módulos
**Duración**: 12 horas (6h cada día)

#### Tareas:
- [ ] **Módulos restantes** (6h)
  - `modality.ts` → Drizzle queries
  - `entities.ts` → Actualizar tipos
  - Cualquier módulo pendiente

- [ ] **Optimización general** (4h)
  - Connection pooling
  - Query optimization
  - Caching improvements

- [ ] **Testing integral** (2h)
  - Pruebas end-to-end
  - Verificación de rendimiento
  - Validación de datos

#### Entregables:
- Todos los módulos migrados
- Sistema optimizado

## FASE 4: MIGRACIÓN DE APIs (Días 21-25)

### Día 21-22: APIs Core
**Duración**: 12 horas (6h cada día)

#### Tareas:
- [ ] **APIs básicas** (8h)
  - `/api/levels/+server.ts`
  - `/api/student/+server.ts`
  - `/api/users/+server.ts`
  - Actualizar a nuevo sistema

- [ ] **APIs de logout** (2h)
  - Actualizar `/api/logout/+server.ts`
  - Integrar con nuevo auth

- [ ] **Testing de APIs** (2h)
  - Verificar responses
  - Validar autenticación
  - Probar error handling

#### Entregables:
- APIs básicas funcionales

### Día 23-24: APIs de Evaluación
**Duración**: 12 horas (6h cada día)

#### Tareas:
- [ ] **APIs de evaluación** (10h)
  - `/api/eval/*` endpoints
  - `/api/eval/answers/*`
  - `/api/eval/results/*`
  - `/api/eval/questions/*`
  - Mantener funcionalidad OMR

- [ ] **Testing especializado** (2h)
  - Probar procesamiento OMR
  - Validar cálculos de resultados
  - Verificar integridad de datos

#### Entregables:
- APIs de evaluación funcionales

### Día 25: APIs de Dashboard y Utilidades
**Duración**: 6 horas

#### Tareas:
- [ ] **APIs de dashboard** (4h)
  - `/api/dashboard/*` endpoints
  - Optimizar queries de agregación
  - Mantener rendimiento

- [ ] **APIs de importación** (2h)
  - `/api/impcsv/*` endpoints
  - Verificar procesamiento CSV
  - Mantener funcionalidad existente

#### Entregables:
- Todas las APIs migradas

## FASE 5: MIGRACIÓN DE DATOS Y TESTING (Días 26-28)

### Día 26: Migración de Datos de Producción
**Duración**: 8 horas

#### Tareas:
- [ ] **Backup de Supabase** (2h)
  - Exportar todos los datos
  - Verificar integridad
  - Crear backup de seguridad

- [ ] **Migración de datos** (4h)
  - Importar a PostgreSQL
  - Verificar relaciones
  - Validar integridad referencial

- [ ] **Verificación de datos** (2h)
  - Comparar registros
  - Validar consistencia
  - Probar queries críticas

#### Entregables:
- Datos migrados completamente
- Verificación de integridad

### Día 27: Testing Integral
**Duración**: 8 horas

#### Tareas:
- [ ] **Testing funcional** (4h)
  - Probar todos los flujos
  - Verificar autenticación
  - Validar permisos

- [ ] **Testing de rendimiento** (2h)
  - Comparar con Supabase
  - Optimizar queries lentas
  - Verificar caching

- [ ] **Testing de seguridad** (2h)
  - Probar vulnerabilidades
  - Verificar autenticación
  - Validar permisos

#### Entregables:
- Sistema completamente testado
- Reporte de rendimiento

### Día 28: Preparación para Deployment
**Duración**: 6 horas

#### Tareas:
- [ ] **Configuración de producción** (3h)
  - Variables de entorno
  - Configuración de SSL
  - Setup de monitoreo

- [ ] **Scripts de deployment** (2h)
  - Automatizar deployment
  - Configurar rollback
  - Documentar proceso

- [ ] **Testing en staging** (1h)
  - Verificar en ambiente similar a producción
  - Probar conectividad
  - Validar rendimiento

#### Entregables:
- Sistema listo para producción

## FASE 6: DEPLOYMENT Y MONITOREO (Días 29-30)

### Día 29: Deployment a Producción
**Duración**: 8 horas

#### Tareas:
- [ ] **Deployment inicial** (4h)
  - Deploy a servidor de producción
  - Configurar base de datos
  - Migrar datos finales

- [ ] **Verificación post-deployment** (2h)
  - Probar todas las funcionalidades
  - Verificar rendimiento
  - Monitorear errores

- [ ] **Configuración de monitoreo** (2h)
  - Setup de logs
  - Configurar alertas
  - Documentar métricas

#### Entregables:
- Sistema en producción
- Monitoreo activo

### Día 30: Optimización y Documentación
**Duración**: 6 horas

#### Tareas:
- [ ] **Optimización final** (3h)
  - Ajustar configuraciones
  - Optimizar queries
  - Mejorar rendimiento

- [ ] **Documentación** (2h)
  - Documentar nueva arquitectura
  - Crear guías de mantenimiento
  - Documentar APIs

- [ ] **Cleanup** (1h)
  - Remover dependencias Supabase
  - Limpiar código obsoleto
  - Actualizar README

#### Entregables:
- Sistema optimizado
- Documentación completa

## CONSIDERACIONES TÉCNICAS

### ORM Seleccionado: Drizzle
**Justificación**:
- **Performance**: Más rápido que Prisma, comparable a queries nativas
- **Type Safety**: Excelente integración con TypeScript
- **Learning Curve**: Sintaxis similar a SQL, fácil migración desde Supabase
- **Bundle Size**: Lightweight, ideal para SvelteKit
- **Ecosystem**: Excelente soporte para PostgreSQL

### Arquitectura de Autenticación
**Componentes**:
- JWT tokens con 8 horas de expiración
- Refresh tokens para renovación automática
- Session storage en cookies seguras
- Middleware personalizado para SvelteKit
- Sistema de permisos granular

### Estructura de Base de Datos
**Migración**:
- Mantener esquema actual de Supabase
- Adaptar funciones PL/pgSQL
- Preservar RLS policies como middleware
- Optimizar índices para nuevo patrón de acceso

## RIESGOS Y MITIGACIONES

### Riesgos Técnicos
1. **Pérdida de datos durante migración**
   - **Mitigación**: Backups múltiples, migración incremental

2. **Degradación de rendimiento**
   - **Mitigación**: Testing exhaustivo, optimización de queries

3. **Problemas de autenticación**
   - **Mitigación**: Implementación gradual, rollback plan

### Riesgos de Proyecto
1. **Retrasos en timeline**
   - **Mitigación**: Buffer de 2 días, priorización de features críticas

2. **Complejidad subestimada**
   - **Mitigación**: Análisis detallado previo, consultoría externa si necesario

## RECURSOS NECESARIOS

### Humanos
- 1 Desarrollador Senior Full-Stack (30 días)
- 1 DBA/DevOps (5 días para setup servidor)
- 1 QA Tester (3 días para testing)

### Infraestructura
- Servidor Debian con PostgreSQL 15+
- Ambiente de staging
- Herramientas de monitoreo
- Backup storage

### Herramientas
- Drizzle ORM + Drizzle Kit
- PostgreSQL 15+
- Node.js 18+
- Docker (para desarrollo)
- Monitoring tools (Grafana/Prometheus)

## MÉTRICAS DE ÉXITO

### Rendimiento
- Tiempo de respuesta ≤ actual con Supabase
- Reducción de bundle size en 30%
- Mejora en tiempo de build

### Funcionalidad
- 100% de features migradas
- 0 pérdida de datos
- Compatibilidad completa con UI existente

### Mantenibilidad
- Código más limpio y modular
- Mejor type safety
- Documentación completa

## CRONOGRAMA RESUMIDO

| Fase | Días | Descripción | Entregables Clave |
|------|------|-------------|-------------------|
| 1 | 1-5 | Preparación y Análisis | Arquitectura, Schema, Servidor |
| 2 | 6-12 | Sistema de Autenticación | Auth completo, Permisos |
| 3 | 13-20 | Migración de Módulos | Todos los módulos migrados |
| 4 | 21-25 | Migración de APIs | APIs funcionales |
| 5 | 26-28 | Migración de Datos | Datos migrados, Testing |
| 6 | 29-30 | Deployment | Sistema en producción |

**Total: 30 días de desarrollo intensivo**

## CONCLUSIÓN

Esta migración representa una mejora significativa en:
- **Performance**: Mejor rendimiento con Drizzle
- **Mantenibilidad**: Código más limpio y type-safe
- **Control**: Infraestructura propia
- **Costos**: Reducción de dependencias externas
- **Escalabilidad**: Mayor flexibilidad para futuras mejoras

El timeline de 30 días es agresivo pero factible con dedicación completa y seguimiento estricto del cronograma.
¡Por supuesto! He analizado tu documento y la solicitud de corrección. A continuación, te presento la guía de ruta definitiva, depurada y alineada estrictamente con tus requisitos: uso exclusivo de Kysely, fidelidad a tu esquema de `code` como clave primaria, y un enfoque en patrones de código simples, eficientes y correctos para Svelte 5 y TypeScript.

Este documento es una versión corregida y perfeccionada, eliminando redundancias e inconsistencias para servir como un manual técnico preciso.

---

# Roadmap Definitivo: Migración de Supabase a PostgreSQL Self-Hosted con Kysely

Esta guía técnica estructura la migración de una aplicación SvelteKit desde Supabase hacia una arquitectura autoalojada con PostgreSQL, empleando Kysely como constructor de consultas SQL con seguridad de tipos. El objetivo es obtener control total sobre la infraestructura, optimizar el rendimiento y escalar de manera más flexible.

## 1. Arquitectura del Proyecto

### **Arquitectura Actual**
- **Frontend**: SvelteKit 2 con Svelte 5.
- **Backend**: Supabase (PostgreSQL + Auth + SSR).
- **Acceso a Datos**: Cliente de Supabase (`@supabase/supabase-js`).
- **Autenticación**: Supabase Auth con Helpers de SSR (`@supabase/ssr`).

### **Arquitectura Objetivo**
- **Frontend**: SvelteKit 2 con Svelte 5 (sin cambios).
- **Backend**: PostgreSQL 15+ autoalojado en Debian.
- **Acceso a Datos**: Kysely (constructor de consultas SQL type-safe).
- **Autenticación**: Sistema personalizado JWT con cookies seguras.
- **Migraciones de Schema**: `kysely-ctl`.
- **Generación de Tipos**: `kysely-codegen`.

---

## **FASE 1: Cimientos y Configuración**

Esta fase establece las bases técnicas del proyecto, desde la configuración de la base de datos hasta la integración inicial de Kysely.

### **Entregable 1.1: Entorno de Desarrollo Configurado**

**Dependencias del Proyecto:**
```bash
# Dependencias de producción
npm install kysely pg jsonwebtoken bcryptjs cookie

# Dependencias de desarrollo
npm install -D @types/pg kysely-codegen kysely-ctl @types/jsonwebtoken @types/bcryptjs @types/cookie
```

**Base de Datos PostgreSQL Local (Ejemplo en Debian):**
```bash
# Instalar PostgreSQL
sudo apt update && sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear base de datos y usuario para desarrollo
sudo -u postgres createdb nextya_dev
sudo -u postgres createuser nextya_dev_user
sudo -u postgres psql -c "ALTER USER nextya_dev_user WITH PASSWORD 'tu_password_seguro';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE nextya_dev TO nextya_dev_user;"
```

### **Entregable 1.2: Integración de Kysely**

**Configuración de la Conexión (`src/lib/database/index.ts`):**
```typescript
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './types';
import { DATABASE_URL } from '$env/static/private';
import { dev } from '$app/environment';

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: DATABASE_URL,
    max: dev ? 10 : 20,
  })
});

export const db = new Kysely<Database>({
  dialect,
  log: (event) => {
    if (event.level === 'query') {
      console.log(event.query.sql);
    }
  },
});

export type DB = typeof db;
```

### **Entregable 1.3: Sistema de Tipos y Migraciones**

**Generación de Tipos (`kysely.config.ts`):**
Configura `kysely-codegen` para generar automáticamente los tipos de TypeScript a partir del schema de la base de datos.
```typescript
import { defineConfig } from 'kysely-codegen';
import { config } from 'dotenv';

config(); // Cargar variables de .env

export default defineConfig({
  dialect: 'postgres',
  connectionString: process.env.DATABASE_URL,
  out: 'src/lib/database/types.ts',
  camelCase: true,
  // Excluir schemas internos que no se migrarán
  excludePattern: '^(auth\\..*|storage\\..*|realtime\\..*|pg_.*)$',
});
```

**Script para Generar Tipos (`package.json`):**
```json
"scripts": {
  "db:generate-types": "kysely-codegen --config kysely.config.ts"
}
```

**Migración Inicial del Schema (`src/lib/database/migrations/001_initial_schema.ts`):**
Esta migración define la estructura base, utilizando `code` como clave primaria en todas las tablas.
```typescript
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('code', 'uuid', (col) => 
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('name', 'varchar(100)')
    .addColumn('last_login', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => 
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();

  await db.schema
    .createTable('levels')
    .addColumn('code', 'uuid', (col) => 
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .addColumn('abr', 'text', (col) => col.notNull())
    .addColumn('users', sql`uuid[]`) // Array de 'codes' de usuarios con acceso
    .addColumn('created_at', 'timestamptz', (col) => 
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();

  // ... (definir resto de tablas: courses, students, registers, etc., siempre con 'code' como PK)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('levels').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();
}
```

---

## **FASE 2: Autenticación y Acceso**

Esta fase reemplaza `Supabase Auth` con una solución personalizada, robusta y segura, integrada perfectamente con SvelteKit.

### **Entregable 2.1: Lógica de Autenticación (JWT y Sesiones)**

**Manejo de JWT (`src/lib/auth/jwt.ts`):**
```typescript
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '$env/static/private';

export interface JWTPayload {
  userCode: string; // Fiel al schema, usamos userCode
  email: string;
  exp: number;
}

export function generateToken(payload: { userCode: string; email: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN || '8h' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}
```

**Gestión de Sesiones (`src/lib/auth/session.ts`):**
```typescript
import type { Cookies } from '@sveltejs/kit';
import { generateToken, verifyToken } from './jwt';
import { db } from '$lib/database';
import type { User } from '$lib/database/types';

export interface Session {
  user: { code: string; email: string; name: string | null };
  token: string;
  expiresAt: number;
}

const SESSION_COOKIE_NAME = 'nextya_session';

export async function createSession(userCode: string, cookies: Cookies): Promise<Session | null> {
  const user = await db
    .selectFrom('users')
    .select(['code', 'email', 'name'])
    .where('code', '=', userCode)
    .executeTakeFirst();

  if (!user) return null;

  const token = generateToken({ userCode: user.code, email: user.email });
  const payload = verifyToken(token);
  if (!payload) return null;

  cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 8, // 8 horas
    path: '/',
  });

  await db.updateTable('users').set({ lastLogin: new Date() }).where('code', '=', userCode).execute();

  return { user, token, expiresAt: payload.exp * 1000 };
}

export async function getSession(cookies: Cookies): Promise<Session | null> {
  const token = cookies.get(SESSION_COOKIE_NAME);
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) {
    destroySession(cookies);
    return null;
  }

  const user = await db
    .selectFrom('users')
    .select(['code', 'email', 'name'])
    .where('code', '=', payload.userCode)
    .executeTakeFirst();

  if (!user) {
    destroySession(cookies);
    return null;
  }

  return { user, token, expiresAt: payload.exp * 1000 };
}

export function destroySession(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}
```

### **Entregable 2.2: Integración con SvelteKit (Hooks y Tipos)**

**Hook Central del Servidor (`src/hooks.server.ts`):**
```typescript
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { db } from '$lib/database';
import { getSession } from '$lib/auth/session';
import { redirect } from '@sveltejs/kit';

const databaseHandle: Handle = async ({ event, resolve }) => {
  event.locals.db = db;
  return resolve(event);
};

const authHandle: Handle = async ({ event, resolve }) => {
  event.locals.session = await getSession(event.cookies);
  event.locals.user = event.locals.session?.user ?? null;
  return resolve(event);
};

const authGuard: Handle = async ({ event, resolve }) => {
  const isAuthPage = event.url.pathname.startsWith('/auth');
  
  if (!event.locals.user && !isAuthPage) {
    throw redirect(303, '/auth');
  }

  if (event.locals.user && isAuthPage) {
    throw redirect(303, '/dashboard');
  }

  return resolve(event);
};

export const handle = sequence(databaseHandle, authHandle, authGuard);
```

**Tipos Globales de la App (`src/app.d.ts`):**
```typescript
import type { DB } from '$lib/database';
import type { Session } from '$lib/auth/session';

declare global {
  namespace App {
    interface Locals {
      db: DB;
      user: Session['user'] | null;
      session: Session | null;
    }
    interface PageData {
      user: Session['user'] | null;
    }
  }
}

export {};
```

**Layout Raíz del Servidor (`src/routes/+layout.server.ts`):**
```typescript
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
  return {
    user: locals.user,
  };
};
```

---

## **FASE 3: Migración de la Lógica de Negocio**

Esta fase se enfoca en refactorizar el código de acceso a datos para que utilice Kysely.

### **Entregable 3.1: Patrón de Refactorización de Módulos de Datos**

El patrón es consistente a través de todos los módulos.

**Antes (Supabase):**
```typescript
// en src/lib/data/courses.ts
export async function getCourses(supabase) {
  const { data } = await supabase.from('courses').select('*');
  return data;
}
```

**Después (Kysely - Patrón Correcto):**
```typescript
// en src/lib/data/courses.ts
import { db } from '$lib/database';
import type { Course } from '$lib/database/types';

export async function getCourses(): Promise<Course[]> {
  try {
    return await db.selectFrom('courses').selectAll().orderBy('name', 'asc').execute();
  } catch (error) {
    console.error('Error fetching courses:', error);
    return []; // Devolver un array vacío en caso de error para evitar fallos en el frontend.
  }
}
```

### **Entregable 3.2: Migración de Endpoints de API (Ej. `login`)**

La lógica de los `actions` de SvelteKit se adapta para usar el nuevo sistema de autenticación.

**Endpoint de Login (`src/routes/auth/+page.server.ts`):**
```typescript
import { fail, redirect } from '@sveltejs/kit';
import { compare } from 'bcryptjs';
import { createSession } from '$lib/auth/session';
import type { Actions } from './$types';

export const actions: Actions = {
  login: async ({ request, locals, cookies }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      return fail(400, { error: 'Email y contraseña son requeridos.' });
    }

    const user = await locals.db
      .selectFrom('users')
      .select(['code', 'passwordHash'])
      .where('email', '=', email.toLowerCase())
      .executeTakeFirst();

    if (!user) {
      return fail(400, { error: 'Credenciales incorrectas.' });
    }

    const isValidPassword = await compare(password, user.passwordHash);
    if (!isValidPassword) {
      return fail(400, { error: 'Credenciales incorrectas.' });
    }

    // Usamos el 'code' del usuario para crear la sesión
    await createSession(user.code, cookies);

    throw redirect(303, '/dashboard');
  }
};
```
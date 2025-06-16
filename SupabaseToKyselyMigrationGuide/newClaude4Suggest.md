Te presento un sistema de autenticación minimalista y eficiente para SvelteKit con Svelte 5:

## Arquitectura del Sistema

### 1. Estructura de Base de Datos (PostgreSQL)

```sql
-- migrations/001_users.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

### 2. Configuración de Tipos

```typescript
// src/app.d.ts
declare global {
    namespace App {
        interface Locals {
            user: import('$lib/types/auth').User | null;
            session: import('$lib/types/auth').Session | null;
        }
        interface PageData {
            user: import('$lib/types/auth').User | null;
        }
    }
}

export {};
```

```typescript
// src/lib/types/auth.ts
export interface User {
    id: number;
    email: string;
}

export interface Session {
    id: string;
    userId: number;
    expiresAt: Date;
}
```

### 3. Configuración de Base de Datos con Kysely

```typescript
// src/lib/database/schema.ts
import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface Database {
    users: UsersTable;
    sessions: SessionsTable;
}

export interface UsersTable {
    id: Generated<number>;
    email: string;
    password_hash: string;
    created_at: Generated<Date>;
}

export interface SessionsTable {
    id: string;
    user_id: number;
    expires_at: Date;
    created_at: Generated<Date>;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type Session = Selectable<SessionsTable>;
export type NewSession = Insertable<SessionsTable>;
```

```typescript
// src/lib/database/client.ts
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './schema';
import { DATABASE_URL } from '$env/static/private';

export const db = new Kysely<Database>({
    dialect: new PostgresDialect({
        pool: new Pool({
            connectionString: DATABASE_URL,
            max: 10
        })
    })
});
```

### 4. Servicio de Autenticación

```typescript
// src/lib/auth/service.ts
import { db } from '$lib/database/client';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 días

export async function createUser(email: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    
    return db
        .insertInto('users')
        .values({ email, password_hash: passwordHash })
        .returningAll()
        .executeTakeFirst();
}

export async function verifyUser(email: string, password: string) {
    const user = await db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', email)
        .executeTakeFirst();
    
    if (!user) return null;
    
    const valid = await bcrypt.compare(password, user.password_hash);
    return valid ? user : null;
}

export async function createSession(userId: number) {
    const sessionId = nanoid(32);
    const expiresAt = new Date(Date.now() + SESSION_DURATION);
    
    await db
        .insertInto('sessions')
        .values({
            id: sessionId,
            user_id: userId,
            expires_at: expiresAt
        })
        .execute();
    
    return { sessionId, expiresAt };
}

export async function validateSession(sessionId: string) {
    const result = await db
        .selectFrom('sessions')
        .innerJoin('users', 'users.id', 'sessions.user_id')
        .select([
            'sessions.id',
            'sessions.user_id',
            'sessions.expires_at',
            'users.email'
        ])
        .where('sessions.id', '=', sessionId)
        .where('sessions.expires_at', '>', new Date())
        .executeTakeFirst();
    
    if (!result) return null;
    
    return {
        session: {
            id: result.id,
            userId: result.user_id,
            expiresAt: result.expires_at
        },
        user: {
            id: result.user_id,
            email: result.email
        }
    };
}

export async function deleteSession(sessionId: string) {
    await db
        .deleteFrom('sessions')
        .where('id', '=', sessionId)
        .execute();
}

export async function deleteExpiredSessions() {
    await db
        .deleteFrom('sessions')
        .where('expires_at', '<', new Date())
        .execute();
}
```

### 5. Middleware de Autenticación

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { validateSession, deleteExpiredSessions } from '$lib/auth/service';

// Limpia sesiones expiradas cada hora
setInterval(() => deleteExpiredSessions(), 60 * 60 * 1000);

export const handle: Handle = async ({ event, resolve }) => {
    const sessionId = event.cookies.get('session');
    
    if (sessionId) {
        const result = await validateSession(sessionId);
        
        if (result) {
            event.locals.session = result.session;
            event.locals.user = result.user;
        } else {
            event.cookies.delete('session', { path: '/' });
            event.locals.session = null;
            event.locals.user = null;
        }
    } else {
        event.locals.session = null;
        event.locals.user = null;
    }
    
    return resolve(event);
};
```

### 6. Layout y Rutas

```typescript
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    return {
        user: locals.user
    };
};
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
    import type { LayoutData } from './$types';
    
    export let data: LayoutData;
</script>

<nav>
    {#if data.user}
        <span>{data.user.email}</span>
        <form method="POST" action="/logout">
            <button>Logout</button>
        </form>
    {:else}
        <a href="/login">Login</a>
        <a href="/register">Register</a>
    {/if}
</nav>

<slot />
```

### 7. Endpoints de Autenticación

```typescript
// src/routes/login/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { verifyUser, createSession } from '$lib/auth/service';

export const load: PageServerLoad = async ({ locals }) => {
    if (locals.user) redirect(302, '/');
};

export const actions = {
    default: async ({ request, cookies }) => {
        const data = await request.formData();
        const email = data.get('email')?.toString();
        const password = data.get('password')?.toString();
        
        if (!email || !password) {
            return fail(400, { error: 'Missing credentials' });
        }
        
        const user = await verifyUser(email, password);
        
        if (!user) {
            return fail(401, { error: 'Invalid credentials' });
        }
        
        const { sessionId, expiresAt } = await createSession(user.id);
        
        cookies.set('session', sessionId, {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            expires: expiresAt
        });
        
        redirect(303, '/');
    }
} satisfies Actions;
```

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
    import type { ActionData } from './$types';
    
    export let form: ActionData;
</script>

<form method="POST">
    {#if form?.error}
        <p class="error">{form.error}</p>
    {/if}
    
    <input
        type="email"
        name="email"
        placeholder="Email"
        required
    />
    
    <input
        type="password"
        name="password"
        placeholder="Password"
        required
    />
    
    <button type="submit">Login</button>
</form>
```

```typescript
// src/routes/register/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { createUser, createSession } from '$lib/auth/service';

export const load: PageServerLoad = async ({ locals }) => {
    if (locals.user) redirect(302, '/');
};

export const actions = {
    default: async ({ request, cookies }) => {
        const data = await request.formData();
        const email = data.get('email')?.toString();
        const password = data.get('password')?.toString();
        
        if (!email || !password) {
            return fail(400, { error: 'Missing fields' });
        }
        
        if (password.length < 8) {
            return fail(400, { error: 'Password too short' });
        }
        
        try {
            const user = await createUser(email, password);
            
            if (user) {
                const { sessionId, expiresAt } = await createSession(user.id);
                
                cookies.set('session', sessionId, {
                    path: '/',
                    httpOnly: true,
                    secure: true,
                    sameSite: 'strict',
                    expires: expiresAt
                });
                
                redirect(303, '/');
            }
        } catch (error) {
            return fail(400, { error: 'Email already exists' });
        }
    }
} satisfies Actions;
```

```typescript
// src/routes/logout/+page.server.ts
import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/auth/service';

export const actions = {
    default: async ({ cookies, locals }) => {
        const sessionId = cookies.get('session');
        
        if (sessionId) {
            await deleteSession(sessionId);
            cookies.delete('session', { path: '/' });
        }
        
        redirect(303, '/login');
    }
} satisfies Actions;
```

### 8. Rutas Protegidas

```typescript
// src/routes/(protected)/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    if (!locals.user) {
        redirect(302, '/login');
    }
};
```

### 9. Docker Configuration

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .

EXPOSE 3000
CMD ["node", "build"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://user:password@db:5432/myapp
      NODE_ENV: production
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 10. Variables de Entorno

```bash
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
```

Este sistema proporciona:
- Autenticación segura con bcrypt
- Sesiones basadas en cookies HTTP-only
- Limpieza automática de sesiones expiradas
- Middleware global para validación
- Rutas protegidas
- Código minimalista y performante
- TypeScript completo con Kysely para type-safety
- Docker para deployment

El sistema es extensible y mantiene la filosofía de código limpio y minimalista que solicitaste.
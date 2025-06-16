Plan detallado para autenticación en SvelteKit con Svelte 5, Kysely, JWT y Postgres
Este plan describe cómo implementar un sistema de autenticación basado en email y contraseña en una aplicación SvelteKit moderna, utilizando Svelte 5, Kysely, JWT, cookies, Postgres, TypeScript y Docker. Se enfoca en código limpio, minimalista y de alto rendimiento, cumpliendo con los requisitos especificados.
1. Introducción a las tecnologías
Svelte 5
Svelte 5, lanzado el 19 de octubre de 2024, es una reescritura del framework que introduce runas para una reactividad más precisa y eficiente (Svelte 5). Las runas son macros que declaran estados reactivos, mejorando el rendimiento y la simplicidad del código.
SvelteKit
SvelteKit es el framework oficial para construir aplicaciones web con Svelte, ofreciendo enrutamiento basado en archivos, renderizado del lado del servidor (SSR) y optimizaciones de compilación (SvelteKit Docs). Los archivos clave incluyen:

+layout.svelte: Define la estructura UI común para las páginas en un directorio.
+layout.server.ts: Carga datos del servidor para el layout, accesibles en $page.data.
+page.svelte: Componente de una página específica.
+page.server.ts: Lógica del servidor para una página, como verificar autenticación.
+server.ts: Define rutas API (por ejemplo, /api/login).
hooks.server.ts: Middleware que intercepta todas las solicitudes del servidor, ideal para autenticación.

Kysely
Kysely es un constructor de consultas SQL tipo-seguro para TypeScript, compatible con Postgres (Kysely). Permite escribir consultas SQL con autocompletado y tipos inferidos, evitando inyecciones SQL.
JWT y Cookies
JSON Web Tokens (JWT) son tokens firmados que contienen información del usuario, verificables sin consultar la base de datos (JWT). Las cookies HTTP-only almacenan el JWT de forma segura, protegiendo contra ataques XSS.
Bcrypt
Bcrypt es una librería para hashear contraseñas de manera segura, con un factor de trabajo ajustable para resistir ataques de fuerza bruta (Bcrypt).
Postgres y Docker
Postgres es una base de datos relacional robusta (Postgres Docs). Docker permite ejecutar Postgres en un contenedor, facilitando la configuración y portabilidad.
2. Estructura de archivos
La estructura de archivos propuesta es:



Archivo/Carpeta
Propósito



src/lib/database.ts
Configuración de Kysely y funciones de base de datos.


src/lib/types/user.ts
Interfaz TypeScript para el modelo de usuario.


src/hooks.server.ts
Middleware para verificar JWT en cada solicitud.


src/app.d.ts
Definición de tipos para event.locals.


src/routes/+layout.svelte
Layout principal con navegación y estado del usuario.


src/routes/+layout.server.ts
Carga datos del usuario para el layout.


src/routes/login/+page.svelte
Página de login con formulario.


src/routes/api/login/+server.ts
Endpoint para autenticar usuarios y generar JWT.


src/routes/logout/+server.ts
Endpoint para cerrar sesión y eliminar la cookie.


src/routes/protected/+page.server.ts
Verifica autenticación para rutas protegidas.


3. Plan paso a paso
Paso 1: Configuración del proyecto

Inicializa un proyecto SvelteKit con TypeScript:npx sv create mi-app
cd mi-app
npm install


Instala dependencias:npm install kysely pg bcrypt jsonwebtoken @types/jsonwebtoken



Paso 2: Configuración de la base de datos

Crea un contenedor Postgres con Docker:version: '3.8'
services:
  postgres:
    image: postgres:latest
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: app
    ports:
      - '5432:5432'


Ejecuta: docker-compose up.
Crea la tabla users:CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL
);



Paso 3: Conexión a la base de datos

Configura Kysely en src/lib/database.ts:import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

interface Database {
  users: {
    id: number;
    email: string;
    password_hash: string;
  };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});



Paso 4: Modelo de usuario

Define la interfaz en src/lib/types/user.ts:export interface User {
  id: number;
  email: string;
}


Implementa funciones en src/lib/database.ts:import bcrypt from 'bcrypt';
import { User } from './types/user';

export async function createUser(email: string, password: string): Promise<User> {
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insertInto('users')
    .values({ email, password_hash: passwordHash })
    .returning(['id', 'email'])
    .execute();
  return user;
}

export async function findUserByEmail(email: string): Promise<User & { password_hash: string } | undefined> {
  return await db
    .selectFrom('users')
    .select(['id', 'email', 'password_hash'])
    .where('email', '=', email)
    .executeTakeFirst();
}



Paso 5: Endpoint de autenticación

Crea src/routes/api/login/+server.ts:import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findUserByEmail } from '$lib/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { email, password } = await request.json();
  const user = await findUserByEmail(email);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
  cookies.set('token', token, { path: '/', httpOnly: true, sameSite: 'strict', maxAge: 3600 });
  return json({ message: 'Inicio de sesión exitoso' });
};



Paso 6: Middleware de autenticación

Configura src/hooks.server.ts:import type { Handle } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get('token');
  if (token) {
    try {
      const { userId, email } = jwt.verify(token, process.env.JWT_SECRET) as { userId: number; email: string };
      event.locals.user = { id: userId, email };
    } catch (err) {
      // Token inválido
    }
  }
  return resolve(event);
};


Define tipos en src/app.d.ts:declare namespace App {
  interface Locals {
    user?: { id: number; email: string };
  }
}



Paso 7: Configuración del layout

Crea src/routes/+layout.server.ts:import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return { user: locals.user };
};


Diseña src/routes/+layout.svelte:<script>
  import { page } from '$app/stores';
  $: user = $page.data.user;
</script>

<header>
  {#if user}
    <p>Bienvenido, {user.email}</p>
    <a href="/logout">Cerrar sesión</a>
  {:else}
    <a href="/login">Iniciar sesión</a>
  {/if}
</header>
<slot></slot>



Paso 8: Página de login

Crea src/routes/login/+page.svelte:<script>
  import { goto } from '$app/navigation';
  let email = '';
  let password = '';

  async function login() {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      goto('/');
    } else {
      // Manejar error
    }
  }
</script>

<form on:submit|preventDefault={login}>
  <input type="email" bind:value={email} placeholder="Email" />
  <input type="password" bind:value={password} placeholder="Contraseña" />
  <button type="submit">Iniciar sesión</button>
</form>



Paso 9: Rutas protegidas

Ejemplo en src/routes/protected/+page.server.ts:import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }
  return {};
};



Paso 10: Cierre de sesión

Crea src/routes/logout/+server.ts:import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
  cookies.delete('token', { path: '/' });
  throw redirect(302, '/login');
};



Paso 11: Variables de entorno

Crea .env:DATABASE_URL=postgres://user:password@localhost:5432/app
JWT_SECRET=tu_secreto_aqui



Paso 12: Docker Compose (opcional)

Configura docker-compose.yml para la app y Postgres:version: '3.8'
services:
  app:
    build: .
    ports:
      - '5173:5173'
    environment:
      - DATABASE_URL=postgres://user:password@postgres:5432/app
      - JWT_SECRET=tu_secreto_aqui
    depends_on:
      - postgres
  postgres:
    image: postgres:latest
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: app
    ports:
      - '5432:5432'



4. Consideraciones de código limpio y rendimiento

TypeScript: Tipos estrictos en app.d.ts, user.ts y Kysely aseguran código robusto.
Seguridad: Cookies HTTP-only evitan XSS; Kysely previene inyecciones SQL; bcrypt protege contraseñas.
Minimalismo: Estructura clara con pocas dependencias y lógica centralizada en hooks.server.ts.
Rendimiento: JWT reduce consultas a la base de datos; SvelteKit optimiza SSR y CSR.

5. Gestión de expiración de sesiones

Los JWT expiran en 1 hora (expiresIn: '1h'), manejando automáticamente la expiración.
Al expirar, hooks.server.ts no establece event.locals.user, redirigiendo a login si es necesario.
Para sesiones más largas, se puede implementar tokens de refresco (no incluido en este plan básico).

6. Frontend

El layout muestra el estado del usuario dinámicamente con $page.data.user.
La página de login es simple y reactiva, usando formularios Svelte.
Las rutas protegidas son seguras gracias a verificaciones en +page.server.ts.

7. Conclusión
Este plan implementa un sistema de autenticación seguro, eficiente y minimalista, alineado con las mejores prácticas de SvelteKit, TypeScript y Postgres. La estructura modular y el uso de Kysely, JWT y bcrypt garantizan un código limpio y un rendimiento óptimo.

Perfecto. Investigaré a fondo cómo implementar autenticación con email y contraseña en un proyecto moderno de SvelteKit 5, utilizando PostgreSQL, Kysely, JWT con cookies HTTPOnly, bcrypt para hashing y manejo de sesiones con expiración. También exploraré el uso de `hooks.server.ts` y archivos `layout` en la estructura sugerida para mantener un código limpio, minimalista y de alto rendimiento.

Te entregaré un plan paso a paso de autenticación con frontend incluido, usando TypeScript y Docker, estructurado según las rutas y carpetas que mencionaste.


# Autenticación minimalista con SvelteKit 5, JWT y PostgreSQL

Para implementar un sistema de login/registro seguro con SvelteKit 5 usaremos correo y contraseña, JWT en cookies *HttpOnly*, bcrypt para el hash y PostgreSQL con Kysely. Mantendremos una arquitectura limpia: código TypeScript, contenedores Docker y estructura modular (`src/lib/` para utilidades y DB). La carpeta `src/lib` suele contener código reusable (por ejemplo `src/lib/database.ts` para la conexión) mientras que `src/lib/server` es solo para código del servidor.

## 1. Estructura del proyecto y configuración inicial

* **Dependencias**: Inicia un proyecto SvelteKit con TypeScript y agrega paquetes: `bcrypt` (o `bcryptjs`) para hash de contraseñas, `jsonwebtoken` para JWT, `pg` o `postgres` y `kysely` para consultas tipadas. Ej: `npm install bcrypt jsonwebtoken kysely pg`. Activa `"strict": true` en `tsconfig.json` para mayor seguridad.
* **Archivos clave**:

  * `src/app.d.ts`: define tipos globales (amplía el namespace `App` para tipar `event.locals`).
  * `src/hooks.server.ts`: middleware global (hook `handle`) que se ejecuta en cada request.
  * `src/lib/database.ts`: instancia de Kysely (con dialecto PostgreSQL) para la BD.
  * `src/lib/types.ts`: interfaces TypeScript para tablas (por ejemplo, la interfaz de un usuario).
  * `src/routes/+layout.server.ts` y `+layout.ts`: funciones `load` para cargar datos compartidos (por ejemplo, usuario) en el layout.
  * `src/routes/+layout.svelte`: componente de interfaz que recibe los datos (p. ej. usuario autenticado) para el layout de la aplicación.

La estructura típica (según la [documentación oficial](https://kit.svelte.dev/docs/project-structure)) es:

```
src/
├── lib/               # código compartido
│   ├── server/        # código solo servidor
│   └── ...           
├── routes/            # rutas de la app
│   ├── +layout.svelte
│   ├── +layout.server.ts
│   ├── login/ 
│   │   ├── +page.svelte
│   │   └── +page.server.ts
│   └── ...           
├── hooks.server.ts
└── app.d.ts
```

En `src/lib/database.ts` inicializamos Kysely con PostgreSQL. Por ejemplo, usando el dialecto oficial:

```ts
// src/lib/database.ts
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from '$lib/types';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool })
});
```

Definimos la interfaz `Database` en `src/lib/types.ts` con las tablas. Kysely exige un tipo para cada tabla, p. ej.:

```ts
// src/lib/types.ts
import { Generated } from 'kysely';

export interface Database {
  users: UserTable;
}

export interface UserTable {
  id: Generated<number>;
  email: string;
  password: string;
  created_at: Date;
}

export type User = Selectable<UserTable>;
```

Aquí `Generated<number>` indica que `id` lo genera la BD (p. ej. `SERIAL`), y `Selectable<UserTable>` crea un tipo de resultado de consulta. Esta tipificación permite autocompletar y verificar consultas en tiempo de compilación.

## 2. Registro de usuarios

Para registrar usuarios creamos una página (`/register`) con un formulario. El formulario puede usar acciones de servidor de SvelteKit (file `+page.server.ts`). Al enviar, obtenemos el email y contraseña, los validamos y **hasheamos la contraseña con bcrypt** antes de guardar. Por ejemplo:

```ts
// src/routes/register/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import bcrypt from 'bcrypt';
import { db } from '$lib/database';

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return fail(400, { invalid: true });
    }
    // Valida email, longitud mínima, etc.
    // Verifica usuario existente
    const exists = await db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst();
    if (exists) return fail(400, { exists: true });

    // Hashea la contraseña y crea usuario
    const hashed = await bcrypt.hash(password, 10);  // bcrypt para hash seguro:contentReference[oaicite:3]{index=3}
    await db.insertInto('users').values({
      email,
      password: hashed,
      created_at: new Date()
    }).execute();

    // Registro exitoso, redirige a login
    throw redirect(303, '/login');
  }
};
```

**Conceptos clave**: usamos `bcrypt.hash()` con un salt (p. ej. factor 10) para almacenar la contraseña de forma segura. No guardamos contraseñas en texto plano. Al final redirigimos al usuario a la página de login tras registrarse.

## 3. Login y generación de JWT

La página de login (`/login`) tendrá un formulario similar. Su acción (en `+page.server.ts`) buscará el usuario por email, comparará la contraseña enviada con la almacenada usando `bcrypt.compare()`, y si coincide generará un **token JWT** firmado y lo almacenará en una cookie HttpOnly. Ejemplo:

```ts
// src/routes/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '$lib/database';

const JWT_SECRET = process.env.JWT_SECRET; // debe definirse en env

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return fail(400, { invalid: true });
    }

    // Busca usuario
    const user = await db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();
    if (!user) return fail(401, { credentials: true });

    // Compara contraseña
    const match = await bcrypt.compare(password, user.password);
    if (!match) return fail(401, { credentials: true });

    // Genera JWT con payload mínimo (p. ej. id de usuario) y expiración
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    // Almacena el JWT en cookie segura HttpOnly
    cookies.set('token', token, {
      httpOnly: true,       // no accesible desde JavaScript:contentReference[oaicite:5]{index=5}
      secure: true,         // solo HTTPS en producción:contentReference[oaicite:6]{index=6}
      sameSite: 'strict',   // protege contra CSRF:contentReference[oaicite:7]{index=7}
      path: '/',
      maxAge: 3600          // 1 hora (en segundos)
    });

    // Login exitoso, redirige a área protegida
    throw redirect(303, '/');
  }
};
```

En este código usamos `jsonwebtoken` para firmar el token. Al iniciar sesión correctamente, el servidor crea un JWT con información del usuario (por ejemplo, su `id`) y lo envía en una cookie **HttpOnly**. Las opciones de cookie incluyen `httpOnly: true`, `secure: true` (solo HTTPS) y `sameSite: 'strict'`, siguiendo las mejores prácticas de seguridad. Esto evita el acceso vía JavaScript (protección XSS) y que la cookie se envíe en peticiones externas (protección CSRF).

## 4. Hooks como middleware (src/hooks.server.ts)

Para **proteger rutas** y validar el JWT en cada petición, usamos el hook global `handle` en `src/hooks.server.ts`. Este hook corre en cada request del servidor, verifica la cookie y carga el usuario en `event.locals`. Ejemplo:

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { db } from '$lib/database';

export const handle: Handle = async ({ event, resolve }) => {
  // Extrae el token de la cookie
  const token = event.cookies.get('token');
  if (token) {
    try {
      // Verifica JWT y obtiene payload
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { id: number };
      // Carga el usuario de la BD
      const user = await db.selectFrom('users').selectAll().where('id', '=', payload.id).executeTakeFirst();
      event.locals.user = user ?? null;
    } catch {
      event.locals.user = null;
    }
  }
  // Continúa con la petición normal
  return await resolve(event);
};
```

Este hook revisa si existe la cookie `token`, la verifica con la clave secreta y, de ser válida, busca al usuario en la BD. Luego asigna el resultado a `event.locals.user`. De esta forma, en cualquier parte del servidor (rutas o cargas) disponemos del usuario autenticado en `locals`. El hook `handle` actúa como middleware global, ejecutándose antes de resolver la ruta. Así, en cada petición hemos validado el JWT y almacenado el usuario en `locals`.

## 5. Tipos globales (`src/app.d.ts`)

Para aprovechar TypeScript, extendemos la interfaz `App.Locals` en `src/app.d.ts`, de modo que `event.locals.user` tenga tipos conocidos. Por ejemplo:

```ts
// src/app.d.ts
declare namespace App {
  interface Locals {
    user: {
      id: number;
      email: string;
      // otros campos si es necesario
    } | null;
  }
}
```

El archivo `app.d.ts` es donde se definen tipos globales de la aplicación. Ahí el namespace `App` contiene la interfaz `Locals`, que especifica la forma de `event.locals`. Al declarar `Locals.user` así, TypeScript permitirá acceder a `locals.user.id` y demás de forma tipada en cargas servidor. Esto evita tener que importar tipos cada vez.

## 6. Layout y flujo de datos del usuario

En el componente de layout global (`src/routes/+layout.svelte`) queremos mostrar el estado de autenticación (por ej. “Hola, usuario”). Para pasar el usuario autenticado al layout usamos `+layout.server.ts`:

```ts
// src/routes/+layout.server.ts
export const load = async ({ locals }) => {
  // Pasamos el objeto de usuario (o null) a la UI
  return { user: locals.user };
};
```

Este `load` de layout se ejecuta en el servidor y devuelve los datos que luego recibe el layout en `data`. Por ejemplo, en `+layout.svelte` podemos hacer: `<p>{data.user ? `Hola \${data.user.email}` : 'No autenticado'}</p>`. En el archivo `+layout.ts` (cliente) típicamente no es necesario si toda la carga la hacemos en servidor. Sin embargo, se puede usar `+layout.ts` para cargar datos que deban ser recargados en el cliente. El mecanismo es análogo al ejemplo genérico de cargar `locals` en un load de layout.

## 7. Protección de rutas específicas

Para proteger rutas concretas (por ejemplo `/dashboard`), usamos la función `load` de la página respectiva. Como se corrigió en el hook, `locals.user` indica si hay sesión activa. Un ejemplo en `+page.server.ts` de una ruta protegida:

```ts
// src/routes/dashboard/+page.server.ts
import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
  if (!locals.user) {
    // Si no hay usuario, redirige al login
    throw redirect(302, '/login');
  }
  // Opcional: devolver datos adicionales al frontend
  return { user: locals.user };
};
```

De esta forma, antes de renderizar la página verificamos si el usuario existe. Si no, lanzamos una redirección (o error 401). Esto cumple la función de middleware a nivel de ruta. Tal como explica Okupter, en los `load` de las rutas protegidas obtenemos el usuario de `locals` y decidimos mostrar o redirigir. Así evitamos que usuarios sin sesión accedan a esas páginas.

## 8. Sesiones y expiración

El JWT incluye un campo de expiración (`exp`) gracias a la opción `{ expiresIn: '1h' }` usada al firmar. Además la cookie define `maxAge`. Esto asegura que tras un tiempo el token ya no sea válido y el usuario deba autenticarse de nuevo. No implementamos aquí *refresh tokens* avanzados (aunque son recomendables para sesiones largas); en un sistema básico, simplemente expiración de token => logout implícito. (Okupter menciona que aspectos como refresh y logout no se cubren en este tutorial.)

Para **cerrar sesión**, se puede crear una ruta que borre la cookie, por ejemplo:

```ts
// src/routes/logout/+page.server.ts
import { redirect } from '@sveltejs/kit';

export const POST = async ({ cookies }) => {
  cookies.delete('token', { path: '/' });
  throw redirect(303, '/login');
};
```

Esto “come” la cookie (equivale a vaciarla) y redirige al login. Al no existir el JWT en cookies, el hook `handle` no cargará usuario en `locals` y quedaremos logueados fuera.

## 9. Dockerización del proyecto

Finalmente, agrupamos la aplicación con Docker para desarrollo/producción limpia. Usamos **multi-stage builds** en un `Dockerfile` con `adapter-node`. Por ejemplo:

```dockerfile
# Etapa de construcción
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

# Imagen de producción
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "build"]
```

Este Dockerfile instala dependencias, construye la app SvelteKit y luego copia solo lo necesario (carpeta `build` y `node_modules` de producción) a la imagen final. También creamos un `.dockerignore` que excluya archivos inútiles (e.g. `node_modules`, `build`, archivos de configuración local).

Podemos definir un `docker-compose.yml` que levante además una instancia de PostgreSQL:

```yaml
# Ejemplo simple docker-compose.yml
version: '3'
services:
  app:
    build: .
    ports:
      - '3000:3000'
    env_file: .env      # Contendrá JWT_SECRET, DATABASE_URL, etc.
    depends_on:
      - db
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: myapp
    volumes:
      - db-data:/var/lib/postgresql/data
volumes:
  db-data:
```

En `.env` definimos variables sensibles (por ejemplo `DATABASE_URL` con credenciales y `JWT_SECRET`). El artículo de Khromov recomienda cómo manejar variables en Docker. En producción se asignarán estas vars seguras al contenedor.

## 10. Flujo completo de autenticación

En resumen, el flujo es: el usuario se registra, el servidor guarda su email y password hasheada con bcrypt. Al hacer login, el servidor crea un JWT firmado y lo envía en una cookie segura. En cada petición siguiente, `hooks.server.ts` lee la cookie, verifica el token y carga el usuario en `event.locals`. Las páginas protegidas (`load` en rutas o layout) revisan `locals.user` y redirigen o muestran contenido apropiado. Este proceso combina buenas prácticas de seguridad (hash de contraseñas, cookies `HttpOnly`, validación continua) y mantiene el frontend y backend en un solo proyecto SvelteKit. La estructura modular (`src/lib/` para lógica reutilizable y `app.d.ts` para tipos) facilita la mantenibilidad. Finalmente, Docker encapsula todo (app y BD) para un despliegue ordenado.

**Referencias:** La documentación oficial de SvelteKit sobre hooks y tipos, junto con tutoriales recientes, explican este flujo. Kysely proporciona consultas SQL tipo-seguro en TypeScript. Las citas anteriores muestran ejemplos de manejo de JWT en cookies y protección de rutas en SvelteKit. Cada bloque de código esencial arriba ilustra cómo encajan las piezas en el flujo de autenticación.

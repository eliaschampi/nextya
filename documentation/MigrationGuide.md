# 🚀 NEXTYA - SUPABASE TO KYSELY MIGRATION GUIDE
**Complete Technical Roadmap & Implementation Guide**

---

## 📋 **PROJECT OVERVIEW**

**Project**: NextYa - Educational Management System  
**Stack**: SvelteKit 5 + TypeScript + Kysely + PostgreSQL + Docker  
**Migration**: Supabase → Self-hosted PostgreSQL with Kysely ORM  
**Status**: 🟡 **85% Complete** - Final cleanup required  
**Generated**: 2025-06-17

### **System Architecture**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   SvelteKit 5   │    │   Kysely ORM     │    │  PostgreSQL 14  │
│   Frontend      │◄──►│   Type-Safe      │◄──►│   Database      │
│   + TypeScript  │    │   Query Builder  │    │   + Docker      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   JWT Auth      │    │   Permission     │    │   Migrations    │
│   + Sessions    │    │   System         │    │   + Functions   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 🎯 **CURRENT MIGRATION STATUS**

### ✅ **COMPLETED COMPONENTS**

#### **1. Core Infrastructure (100%)**
- ✅ **Database Setup**: PostgreSQL 14 with Docker
- ✅ **Kysely Configuration**: Type-safe query builder
- ✅ **Authentication System**: JWT-based with secure cookies
- ✅ **Session Management**: Custom session handling
- ✅ **Permission System**: Role-based access control
- ✅ **Type Generation**: Automated with kysely-codegen

#### **2. Database Layer (100%)**
- ✅ **Schema Migration**: All tables migrated from Supabase
- ✅ **Data Modules**: Core CRUD operations
  - `src/lib/data/courses.ts`
  - `src/lib/data/levels.ts`
  - `src/lib/data/dashboard.ts`
  - `src/lib/data/eval.ts`
  - `src/lib/data/register.ts`
  - `src/lib/data/question.ts`
  - `src/lib/data/courseDashboard.ts`
  - `src/lib/data/evalDashboard.ts`
  - `src/lib/data/studentDashboard.ts`

#### **3. Authentication & Security (100%)**
- ✅ **JWT Implementation**: Token generation and validation
- ✅ **Password Hashing**: bcryptjs integration
- ✅ **Session Cookies**: Secure HTTP-only cookies
- ✅ **Permission Checks**: Entity-action based permissions
- ✅ **Middleware**: Request authentication and authorization

### ⚠️ **REMAINING ISSUES (144 errors)**

#### **1. Critical Issues (12 errors)**
- 🔴 **Supabase References**: 5 files still contain Supabase imports
- 🔴 **Function Signatures**: Incorrect parameter passing
- 🔴 **Query Patterns**: Old Supabase syntax in API routes

#### **2. Non-Critical Issues (132 errors)**
- 🟡 **OpenCV Dependencies**: Expected - OMR processing module
- 🟡 **Type Mismatches**: Minor type inference issues
- 🟡 **Implicit Types**: Some variables need explicit typing

---

## 🏗️ **DATABASE ARCHITECTURE**

### **Core Tables Structure**

```sql
-- Users & Authentication
users (code, email, passwordHash, name, lastName, isEmailVerified, isSuperAdmin)
permissions (code, userCode, entity, action, createdAt)

-- Educational Structure  
levels (code, name, abr, users[], createdAt)
courses (code, name, abr, userCode, order, createdAt)
students (code, name, lastName, email, phone, userCode, createdAt)
registers (code, studentCode, levelCode, groupName, rollCode, userCode)

-- Evaluation System
evals (code, name, levelCode, groupName, evalDate, userCode)
evalSections (code, evalCode, courseCode, orderInEval, questionCount)
evalQuestions (code, evalCode, sectionCode, orderInEval, correctKey, omitable, scorePercent)
evalAnswers (code, registerCode, questionCode, studentAnswer)
evalResults (code, registerCode, evalCode, sectionCode, correctCount, blankCount, incorrectCount, score)
```

### **Key Relationships**
```
users ──┬── courses (userCode)
        ├── students (userCode)  
        ├── registers (userCode)
        └── evals (userCode)

levels ──┬── registers (levelCode)
         └── evals (levelCode)

students ── registers (studentCode)

evals ──┬── evalSections (evalCode)
        ├── evalQuestions (evalCode)
        └── evalResults (evalCode)

courses ── evalSections (courseCode)
```

---

## 🔧 **KYSELY IMPLEMENTATION PATTERNS**

### **1. Database Connection**
```typescript
// src/lib/database/index.ts
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { DB } from './types';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres', 
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'nextya',
  port: parseInt(process.env.DB_PORT || '5432'),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool }),
  log: (event) => {
    if (dev && event.level === 'query') {
      console.log('SQL:', event.query.sql);
      console.log('Parameters:', event.query.parameters);
    }
  }
});
```

### **2. Query Patterns**

#### **SELECT Operations**
```typescript
// Basic select
const courses = await db
  .selectFrom('courses')
  .selectAll()
  .where('userCode', '=', userCode)
  .orderBy('order', 'asc')
  .execute();

// Join operations
const studentsWithLevels = await db
  .selectFrom('students')
  .innerJoin('registers', 'registers.studentCode', 'students.code')
  .innerJoin('levels', 'levels.code', 'registers.levelCode')
  .select([
    'students.code',
    'students.name',
    'students.lastName',
    'levels.name as levelName',
    'registers.groupName'
  ])
  .where('students.userCode', '=', userCode)
  .execute();

// Aggregations
const courseCounts = await db
  .selectFrom('courses')
  .select([
    'userCode',
    db.fn.count('code').as('totalCourses')
  ])
  .groupBy('userCode')
  .execute();
```

#### **INSERT Operations**
```typescript
// Single insert
const newCourse = await db
  .insertInto('courses')
  .values({
    name: 'Mathematics',
    abr: 'MATH',
    userCode: userCode,
    order: 1
  })
  .returning(['code', 'name'])
  .executeTakeFirstOrThrow();

// Batch insert
const newStudents = await db
  .insertInto('students')
  .values([
    { name: 'John', lastName: 'Doe', email: 'john@example.com', userCode },
    { name: 'Jane', lastName: 'Smith', email: 'jane@example.com', userCode }
  ])
  .returning(['code', 'name'])
  .execute();

// Upsert (conflict resolution)
await db
  .insertInto('permissions')
  .values({
    userCode: userCode,
    entity: 'courses',
    action: 'read'
  })
  .onConflict((oc) => oc.columns(['userCode', 'entity', 'action']).doNothing())
  .execute();
```

#### **UPDATE Operations**
```typescript
// Simple update
await db
  .updateTable('courses')
  .set({
    name: 'Advanced Mathematics',
    order: 2
  })
  .where('code', '=', courseCode)
  .where('userCode', '=', userCode)
  .execute();

// Conditional update
await db
  .updateTable('students')
  .set({
    email: newEmail,
    updatedAt: new Date()
  })
  .where('code', '=', studentCode)
  .where('userCode', '=', userCode)
  .execute();
```

#### **DELETE Operations**
```typescript
// Simple delete
await db
  .deleteFrom('courses')
  .where('code', '=', courseCode)
  .where('userCode', '=', userCode)
  .execute();

// Cascading delete (manual)
await db.transaction().execute(async (trx) => {
  // Delete dependent records first
  await trx
    .deleteFrom('evalAnswers')
    .where('registerCode', '=', registerCode)
    .execute();
    
  await trx
    .deleteFrom('evalResults')
    .where('registerCode', '=', registerCode)
    .execute();
    
  // Delete main record
  await trx
    .deleteFrom('registers')
    .where('code', '=', registerCode)
    .execute();
});
```

### **3. Advanced Patterns**

#### **Transactions**
```typescript
export async function createStudentWithRegister(
  studentData: NewStudent,
  registerData: NewRegister
) {
  return await db.transaction().execute(async (trx) => {
    // Create student
    const student = await trx
      .insertInto('students')
      .values(studentData)
      .returning(['code'])
      .executeTakeFirstOrThrow();

    // Create register
    const register = await trx
      .insertInto('registers')
      .values({
        ...registerData,
        studentCode: student.code
      })
      .returning(['code'])
      .executeTakeFirstOrThrow();

    return { student, register };
  });
}
```

#### **SQL Functions**
```typescript
// Call PostgreSQL functions
const results = await db
  .selectFrom(
    sql`get_student_eval_report(${studentCode})`.as('report')
  )
  .selectAll()
  .execute();

// Raw SQL when needed
const complexQuery = await sql`
  SELECT 
    s.name,
    s.last_name,
    AVG(er.score) as average_score
  FROM students s
  JOIN registers r ON r.student_code = s.code
  JOIN eval_results er ON er.register_code = r.code
  WHERE s.user_code = ${userCode}
  GROUP BY s.code, s.name, s.last_name
  ORDER BY average_score DESC
`.execute(db);
```

#### **Dynamic Queries**
```typescript
export async function getStudentsWithFilters(
  userCode: string,
  filters: {
    levelCode?: string;
    groupName?: string;
    searchTerm?: string;
  }
) {
  let query = db
    .selectFrom('students')
    .innerJoin('registers', 'registers.studentCode', 'students.code')
    .innerJoin('levels', 'levels.code', 'registers.levelCode')
    .select([
      'students.code',
      'students.name',
      'students.lastName',
      'students.email',
      'levels.name as levelName',
      'registers.groupName',
      'registers.rollCode'
    ])
    .where('students.userCode', '=', userCode);

  if (filters.levelCode) {
    query = query.where('registers.levelCode', '=', filters.levelCode);
  }

  if (filters.groupName) {
    query = query.where('registers.groupName', '=', filters.groupName);
  }

  if (filters.searchTerm) {
    query = query.where((eb) =>
      eb.or([
        eb('students.name', 'ilike', `%${filters.searchTerm}%`),
        eb('students.lastName', 'ilike', `%${filters.searchTerm}%`),
        eb('students.email', 'ilike', `%${filters.searchTerm}%`)
      ])
    );
  }

  return query.execute();
}
```

---

## 🔐 **AUTHENTICATION SYSTEM**

### **JWT Implementation**
```typescript
// src/lib/auth/jwt.ts
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  code: string;
  email: string;
  name?: string;
  iat: number;
  exp: number;
}

export function generateToken(userCode: string, email: string, name?: string): string {
  return jwt.sign(
    { code: userCode, email, name },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}
```

### **Session Management**
```typescript
// src/lib/auth/session.ts
import { db } from '$lib/database';
import { generateToken, verifyToken } from './jwt';
import type { Cookies } from '@sveltejs/kit';

export interface SessionUser {
  code: string;
  email: string;
  name?: string;
  lastName?: string;
}

export interface Session {
  user: SessionUser;
  token: string;
}

export async function createSession(userCode: string, cookies: Cookies): Promise<Session | null> {
  try {
    // Get user data
    const user = await db
      .selectFrom('users')
      .select(['code', 'email', 'name', 'lastName'])
      .where('code', '=', userCode)
      .executeTakeFirst();

    if (!user) return null;

    // Generate JWT token
    const token = generateToken(user.code, user.email, user.name || undefined);

    // Set secure cookie
    cookies.set('app_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/'
    });

    // Update last login
    await db
      .updateTable('users')
      .set({ lastLogin: new Date() })
      .where('code', '=', userCode)
      .execute();

    return {
      user: {
        code: user.code,
        email: user.email,
        name: user.name || undefined,
        lastName: user.lastName || undefined
      },
      token
    };
  } catch (error) {
    console.error('Session creation failed:', error);
    return null;
  }
}

export async function getSession(cookies: Cookies): Promise<Session | null> {
  try {
    const token = cookies.get('app_session');
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    // Verify user still exists
    const user = await db
      .selectFrom('users')
      .select(['code', 'email', 'name', 'lastName'])
      .where('code', '=', payload.code)
      .executeTakeFirst();

    if (!user) return null;

    return {
      user: {
        code: user.code,
        email: user.email,
        name: user.name || undefined,
        lastName: user.lastName || undefined
      },
      token
    };
  } catch (error) {
    console.error('Session retrieval failed:', error);
    return null;
  }
}

export function destroySession(cookies: Cookies): void {
  cookies.delete('app_session', { path: '/' });
}
```

### **Permission System**
```typescript
// src/lib/auth/index.ts
export async function hasPermission(
  userCode: string,
  entity: string,
  action: string
): Promise<boolean> {
  try {
    const permission = await db
      .selectFrom('permissions')
      .select('code')
      .where('userCode', '=', userCode)
      .where('entity', '=', entity)
      .where('action', '=', action)
      .executeTakeFirst();

    return !!permission;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

export async function grantPermission(
  userCode: string,
  entity: string,
  action: string
): Promise<boolean> {
  try {
    await db
      .insertInto('permissions')
      .values({
        userCode,
        entity,
        action
      })
      .onConflict((oc) => oc.columns(['userCode', 'entity', 'action']).doNothing())
      .execute();

    return true;
  } catch (error) {
    console.error('Grant permission error:', error);
    return false;
  }
}
```

---

## 🛠️ **MIGRATION PATTERNS**

### **1. Supabase to Kysely Query Conversion**

#### **Basic Queries**
```typescript
// BEFORE (Supabase)
const { data, error } = await supabase
  .from('courses')
  .select('*')
  .eq('user_code', userId);

// AFTER (Kysely)
const courses = await db
  .selectFrom('courses')
  .selectAll()
  .where('userCode', '=', userId)
  .execute();
```

#### **Joins**
```typescript
// BEFORE (Supabase)
const { data, error } = await supabase
  .from('students')
  .select('*, registers:registers(*, levels:levels(name))')
  .eq('user_code', userId);

// AFTER (Kysely)
const students = await db
  .selectFrom('students')
  .innerJoin('registers', 'registers.studentCode', 'students.code')
  .innerJoin('levels', 'levels.code', 'registers.levelCode')
  .select([
    'students.code',
    'students.name',
    'students.lastName',
    'students.email',
    'registers.groupName',
    'registers.rollCode',
    'levels.name as levelName'
  ])
  .where('students.userCode', '=', userId)
  .execute();
```

#### **RPC Functions**
```typescript
// BEFORE (Supabase)
const { data, error } = await supabase.rpc('get_student_eval_report', {
  p_student_code: studentCode
});

// AFTER (Kysely)
const data = await sql`
  SELECT * FROM get_student_eval_report(${studentCode})
`.execute(db);
```

### **2. Function Signature Updates**

#### **Data Module Functions**
```typescript
// BEFORE
export async function getCourses(supabase: SupabaseClient, userCode: string) {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_code', userCode);
  return data;
}

// AFTER
export async function getCourses(userCode: string) {
  try {
    return await db
      .selectFrom('courses')
      .selectAll()
      .where('userCode', '=', userCode)
      .orderBy('order', 'asc')
      .execute();
  } catch (error) {
    console.error('Error fetching courses:', error);
    return [];
  }
}
```

#### **API Route Handlers**
```typescript
// BEFORE
export const GET: RequestHandler = async ({ locals, params }) => {
  const data = await someFunction(locals.supabase, params.id);
  return json(data);
};

// AFTER
export const GET: RequestHandler = async ({ locals, params }) => {
  try {
    const data = await someFunction(params.id);
    return json(data);
  } catch (error) {
    console.error('API error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
```

### **3. Error Handling Patterns**

#### **Supabase Error Handling**
```typescript
// BEFORE
const { data, error } = await supabase.from('table').select('*');
if (error) {
  console.error('Error:', error);
  return [];
}
return data;
```

#### **Kysely Error Handling**
```typescript
// AFTER
try {
  const data = await db.selectFrom('table').selectAll().execute();
  return data;
} catch (error) {
  console.error('Database error:', error);
  return [];
}
```

---

## 🚨 **CRITICAL FIXES NEEDED**

### **1. Remove Remaining Supabase References**

#### **Files to Fix:**
1. `src/lib/csvProcessor/studentExport.ts` - Lines 15, 150
2. `src/routes/(home)/eval/check/+page.server.ts` - Line 4
3. `src/routes/(home)/eval/+page.server.ts` - Line 8
4. `src/routes/(home)/users/+page.server.ts` - Line 3
5. `src/routes/api/users/[id]/permissions/+server.ts` - Line 3

#### **Fix Pattern:**
```typescript
// Remove these imports
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '$lib/supabaseAdmin';

// Replace function signatures
// BEFORE
export async function fetchStudentEvalReports(
  supabase: SupabaseClient,
  studentCode: string
): Promise<StudentEvalReport[] | null>

// AFTER
export async function fetchStudentEvalReports(
  studentCode: string
): Promise<StudentEvalReport[] | null>
```

### **2. Fix Query Patterns**

#### **Replace .from() with Kysely syntax:**
```typescript
// BEFORE
const { data, error } = await locals.db
  .from('courses')
  .select('*')
  .eq('user_code', userId);

// AFTER
const courses = await locals.db
  .selectFrom('courses')
  .selectAll()
  .where('userCode', '=', userId)
  .execute();
```

### **3. Fix Function Signatures**

#### **Data Module Calls:**
```typescript
// BEFORE
const levels = await getLevels(locals.db, userId);

// AFTER
const levels = await getLevels(userId);
```

---

## 📝 **IMPLEMENTATION CHECKLIST**

### **Phase 1: Critical Fixes (Priority 1)**
- [ ] Remove all Supabase imports and types
- [ ] Fix function signatures in data modules
- [ ] Update API route query patterns
- [ ] Fix RPC function calls
- [ ] Update error handling patterns

### **Phase 2: Type Safety (Priority 2)**
- [ ] Add explicit types for implicit variables
- [ ] Fix function parameter types
- [ ] Update interface definitions
- [ ] Resolve type mismatches

### **Phase 3: Testing & Validation (Priority 3)**
- [ ] Run type checking: `npm run check`
- [ ] Test authentication flow
- [ ] Verify database operations
- [ ] Test API endpoints
- [ ] Validate permissions system

### **Phase 4: Optimization (Priority 4)**
- [ ] Optimize database queries
- [ ] Add query result caching
- [ ] Implement connection pooling
- [ ] Add performance monitoring

---

## 🐳 **DOCKER DEVELOPMENT SETUP**

### **Environment Configuration**
```yaml
# docker-compose.yml
services:
  app:
    container_name: nextya_app
    build:
      context: .
      dockerfile: docker/app.dockerfile
      target: development
    ports:
      - "5173:5173"
    environment:
      - DB_HOST=postgres
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=nextya
      - DB_PORT=5432
      - JWT_SECRET=your-super-secret-jwt-key-change-in-production-2024
      - JWT_EXPIRES_IN=8h
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    container_name: nextya_postgres
    image: postgres:14-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=nextya
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### **Development Commands**
```bash
# Start development environment
docker-compose up -d

# Run type checking
docker-compose exec app npm run check

# Generate database types
docker-compose exec app npm run db:generate

# Run migrations
docker-compose exec app npm run migrate:up

# Access database
docker-compose exec postgres psql -U postgres -d nextya

# View logs
docker-compose logs -f app
```

---

## 🔄 **MIGRATION EXECUTION PLAN**

### **Step 1: Backup Current State**
```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres nextya > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup codebase
git add -A && git commit -m "Pre-migration backup"
```

### **Step 2: Execute Critical Fixes**
```bash
# Fix Supabase references
find src -name "*.ts" -exec sed -i 's/import.*@supabase\/supabase-js.*;//g' {} \;
find src -name "*.ts" -exec sed -i 's/SupabaseClient[^,]*,\s*//g' {} \;

# Fix query patterns
find src -name "*.ts" -exec sed -i 's/\.from(/\.selectFrom(/g' {} \;
find src -name "*.ts" -exec sed -i 's/\.eq(/\.where(/g' {} \;
```

### **Step 3: Manual Code Updates**
1. Update function signatures in data modules
2. Fix API route handlers
3. Update component prop types
4. Fix permission checks

### **Step 4: Testing & Validation**
```bash
# Type checking
docker-compose exec app npm run check

# Build test
docker-compose exec app npm run build

# Runtime testing
docker-compose exec app npm run dev
```

---

## 🎯 **SUCCESS CRITERIA**

### **Technical Metrics**
- ✅ **Zero TypeScript errors**
- ✅ **Zero Supabase references**
- ✅ **All API endpoints functional**
- ✅ **Authentication working**
- ✅ **Database queries optimized**
- ✅ **Docker environment stable**

### **Functional Validation**
- ✅ **User login/logout**
- ✅ **Student management**
- ✅ **Course creation**
- ✅ **Evaluation processing**
- ✅ **Results generation**
- ✅ **CSV import/export**
- ✅ **Permission system**

---

## 🚀 **POST-MIGRATION ENHANCEMENTS**

### **Performance Optimizations**
1. **Query Optimization**: Add database indexes
2. **Connection Pooling**: Optimize pool settings
3. **Caching**: Implement Redis for session storage
4. **Monitoring**: Add query performance tracking

### **Security Enhancements**
1. **Rate Limiting**: Implement API rate limits
2. **Input Validation**: Enhanced Zod schemas
3. **CSRF Protection**: Add CSRF tokens
4. **Audit Logging**: Track user actions

### **Feature Additions**
1. **Real-time Updates**: WebSocket integration
2. **File Storage**: Implement file upload system
3. **Email Notifications**: SMTP integration
4. **Backup Automation**: Scheduled database backups

---

## 📚 **RESOURCES & REFERENCES**

### **Documentation**
- [Kysely Documentation](https://kysely.dev/)
- [SvelteKit Documentation](https://kit.svelte.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)

### **Migration Tools**
- `kysely-codegen`: Type generation
- `kysely-ctl`: Migration management
- `pg`: PostgreSQL client
- `bcryptjs`: Password hashing
- `jsonwebtoken`: JWT handling

### **Development Tools**
- TypeScript: Type safety
- ESLint: Code linting
- Prettier: Code formatting
- Docker: Development environment

---

## 🔧 **SPECIFIC FIXES FOR REMAINING ERRORS**

### **1. Fix studentExport.ts**
```typescript
// BEFORE
export async function fetchStudentEvalReports(
  supabase: SupabaseClient,
  studentCode: string
): Promise<StudentEvalReport[] | null> {
  const { data, error } = await supabase.rpc('get_student_eval_report', {
    p_student_code: studentCode
  });

// AFTER
export async function fetchStudentEvalReports(
  studentCode: string
): Promise<StudentEvalReport[] | null> {
  try {
    const data = await sql`
      SELECT * FROM get_student_eval_report(${studentCode})
    `.execute(db);

    return data.rows.map(item => ({
      ...item,
      eval_code: String(item.eval_code),
      register_code: String(item.register_code),
      result_code: String(item.result_code),
      course_scores: typeof item.course_scores === 'string'
        ? JSON.parse(item.course_scores)
        : item.course_scores
    }));
  } catch (error) {
    console.error('Error fetching student evaluation reports:', error);
    return null;
  }
}
```

### **2. Fix API Routes with .from() patterns**
```typescript
// BEFORE
const { data, error } = await locals.db
  .from('courses')
  .select('*')
  .eq('user_code', userId);

// AFTER
const courses = await locals.db
  .selectFrom('courses')
  .selectAll()
  .where('userCode', '=', userId)
  .execute();
```

### **3. Fix Function Parameter Issues**
```typescript
// BEFORE
const levels = await getLevels(locals.db, userId);

// AFTER
const levels = await getLevels(userId);
```

---

**🎉 MIGRATION GUIDE COMPLETE**

This comprehensive guide provides everything needed to complete the Supabase to Kysely migration for the NextYa educational management system. The project is 85% complete with only critical fixes remaining to achieve full functionality.

#!/usr/bin/env tsx

/**
 * Script to clean up remaining Supabase references and complete the migration to Kysely
 * This script will systematically replace Supabase patterns with Kysely equivalents
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

interface ReplacementRule {
  pattern: RegExp;
  replacement: string;
  description: string;
}

// Common replacement patterns for Supabase to Kysely migration
const replacementRules: ReplacementRule[] = [
  // Import statements
  {
    pattern: /import.*from\s+['"]@supabase\/supabase-js['"];?\s*\n?/g,
    replacement: '',
    description: 'Remove Supabase imports'
  },
  {
    pattern: /import\s+type\s*{\s*SupabaseClient\s*}\s+from\s+['"]@supabase\/supabase-js['"];?\s*\n?/g,
    replacement: '',
    description: 'Remove SupabaseClient type imports'
  },
  
  // Function parameters
  {
    pattern: /,\s*supabase:\s*SupabaseClient/g,
    replacement: '',
    description: 'Remove supabase parameter from function signatures'
  },
  {
    pattern: /supabase:\s*SupabaseClient,?\s*/g,
    replacement: '',
    description: 'Remove supabase parameter (first position)'
  },
  
  // Function calls - need to be more specific
  {
    pattern: /await\s+supabase\s*\.\s*from\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\.\s*select\s*\(\s*['"]([^'"]*)['"]\s*\)/g,
    replacement: 'await db.selectFrom(\'$1\').selectAll()',
    description: 'Replace basic supabase select queries'
  },
  
  // Add db import if not present
  {
    pattern: /^(?!.*import.*db.*from.*database)(.*)$/gm,
    replacement: '$1',
    description: 'Placeholder for adding db import'
  }
];

// Files to skip (already migrated or don't need migration)
const skipFiles = [
  'src/lib/database/index.ts',
  'src/lib/database/types.ts',
  'src/lib/database/migrations',
  'src/lib/auth',
  'src/lib/data/courses.ts',
  'src/lib/data/dashboard.ts',
  'src/lib/data/levels.ts',
  'src/hooks.server.ts',
  'src/app.d.ts'
];

function shouldSkipFile(filePath: string): boolean {
  return skipFiles.some(skip => filePath.includes(skip));
}

function findFilesWithSupabase(dir: string, extensions = ['.ts', '.js', '.svelte']): string[] {
  const files: string[] = [];
  
  function traverse(currentDir: string) {
    const items = readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and other irrelevant directories
        if (!['node_modules', '.git', 'build', 'dist'].includes(item)) {
          traverse(fullPath);
        }
      } else if (extensions.includes(extname(item))) {
        if (!shouldSkipFile(fullPath)) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            if (content.toLowerCase().includes('supabase')) {
              files.push(fullPath);
            }
          } catch (error) {
            console.warn(`Could not read file ${fullPath}:`, error);
          }
        }
      }
    }
  }
  
  traverse(dir);
  return files;
}

function analyzeSupabaseUsage(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const issues: string[] = [];
  
  // Check for different types of Supabase usage
  if (content.includes('@supabase/supabase-js')) {
    issues.push('Contains Supabase imports');
  }
  if (content.includes('SupabaseClient')) {
    issues.push('Uses SupabaseClient type');
  }
  if (content.includes('supabase.from(')) {
    issues.push('Uses supabase.from() queries');
  }
  if (content.includes('supabase.auth')) {
    issues.push('Uses Supabase auth');
  }
  if (content.includes('locals.supabase')) {
    issues.push('Uses locals.supabase');
  }
  
  return issues;
}

function createMigrationPlan(): void {
  console.log('🔍 Scanning for files with Supabase references...\n');
  
  const srcFiles = findFilesWithSupabase('src');
  
  if (srcFiles.length === 0) {
    console.log('✅ No Supabase references found!');
    return;
  }
  
  console.log(`📋 Found ${srcFiles.length} files with Supabase references:\n`);
  
  const migrationPlan: Array<{file: string, issues: string[]}> = [];
  
  for (const file of srcFiles) {
    const issues = analyzeSupabaseUsage(file);
    migrationPlan.push({ file, issues });
    
    console.log(`📄 ${file}`);
    issues.forEach(issue => console.log(`   ❌ ${issue}`));
    console.log();
  }
  
  // Write migration plan to file
  const planContent = `# Supabase to Kysely Migration Plan

Generated on: ${new Date().toISOString()}

## Files requiring migration (${migrationPlan.length} total):

${migrationPlan.map(({ file, issues }) => `
### ${file}
${issues.map(issue => `- [ ] ${issue}`).join('\n')}
`).join('\n')}

## Migration Steps:

1. **Phase 1: Remove Supabase imports and types**
   - Remove @supabase/supabase-js imports
   - Remove SupabaseClient type references
   - Add db import from $lib/database

2. **Phase 2: Replace query patterns**
   - Replace supabase.from().select() with db.selectFrom().select()
   - Replace supabase.from().insert() with db.insertInto()
   - Replace supabase.from().update() with db.updateTable()
   - Replace supabase.from().delete() with db.deleteFrom()

3. **Phase 3: Update function signatures**
   - Remove supabase parameters from functions
   - Update function calls to not pass supabase client

4. **Phase 4: Replace auth patterns**
   - Replace supabase.auth with custom auth functions
   - Update locals.supabase to locals.db

5. **Phase 5: Test and validate**
   - Run type checking
   - Test all affected functionality
   - Update tests if needed
`;
  
  writeFileSync('MIGRATION_PLAN.md', planContent);
  console.log('📝 Migration plan written to MIGRATION_PLAN.md');
}

// Run the analysis
if (require.main === module) {
  createMigrationPlan();
}

export { findFilesWithSupabase, analyzeSupabaseUsage };

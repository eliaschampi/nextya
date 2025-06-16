#!/usr/bin/env tsx

/**
 * Complete Supabase to Kysely Migration Script
 * This script systematically fixes all remaining Supabase references
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

interface MigrationRule {
  pattern: RegExp;
  replacement: string | ((match: string, ...args: any[]) => string);
  description: string;
}

// Comprehensive migration rules
const migrationRules: MigrationRule[] = [
  // 1. Remove Supabase imports
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

  // 2. Add Kysely imports (only if not present)
  {
    pattern: /^(?!.*import.*db.*from.*database)(import.*\n)/m,
    replacement: (match) => {
      if (match.includes('$lib/database')) return match;
      return `import { db } from '$lib/database';\n${match}`;
    },
    description: 'Add db import'
  },

  // 3. Function parameter cleanup
  {
    pattern: /(\w+)\s*:\s*SupabaseClient,?\s*/g,
    replacement: '',
    description: 'Remove SupabaseClient parameters'
  },
  {
    pattern: /,\s*supabase:\s*SupabaseClient/g,
    replacement: '',
    description: 'Remove supabase parameter (trailing)'
  },
  {
    pattern: /supabase:\s*SupabaseClient,\s*/g,
    replacement: '',
    description: 'Remove supabase parameter (leading)'
  },

  // 4. Function call updates
  {
    pattern: /(\w+)\(locals\.supabase,\s*/g,
    replacement: '$1(',
    description: 'Remove locals.supabase from function calls'
  },
  {
    pattern: /(\w+)\(supabase,\s*/g,
    replacement: '$1(',
    description: 'Remove supabase from function calls'
  },

  // 5. Basic query patterns
  {
    pattern: /locals\.supabase\s*\.\s*from\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\.\s*select\s*\(\s*['"]([^'"]*)['"]\s*\)/g,
    replacement: 'locals.db.selectFrom(\'$1\').selectAll()',
    description: 'Replace basic select queries'
  },
  {
    pattern: /supabase\s*\.\s*from\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\.\s*select\s*\(\s*['"]([^'"]*)['"]\s*\)/g,
    replacement: 'db.selectFrom(\'$1\').selectAll()',
    description: 'Replace basic select queries (without locals)'
  },

  // 6. Error handling patterns
  {
    pattern: /const\s*{\s*data(?:\s*:\s*\w+)?,\s*error(?:\s*:\s*\w+)?\s*}\s*=\s*await\s+/g,
    replacement: 'const data = await ',
    description: 'Simplify destructuring for Kysely'
  },
  {
    pattern: /if\s*\(\s*error\s*\)\s*{[^}]*}/g,
    replacement: '',
    description: 'Remove Supabase error checks'
  },

  // 7. RPC calls
  {
    pattern: /\.rpc\s*\(\s*['"]([^'"]+)['"]\s*,\s*{([^}]*)}\s*\)/g,
    replacement: (match, funcName, params) => {
      // Extract parameter values
      const paramMatches = params.match(/p_\w+:\s*\w+/g) || [];
      const values = paramMatches.map(p => p.split(':')[1].trim()).join(', ');
      return `sql\`SELECT * FROM ${funcName}(${values})\`.execute(db)`;
    },
    description: 'Convert RPC calls to SQL function calls'
  }
];

// Files to process (exclude already migrated ones)
const includePatterns = [
  'src/routes/api/**/*.ts',
  'src/routes/(home)/**/*.ts',
  'src/lib/csvProcessor/**/*.ts',
  'src/lib/components/**/*.svelte'
];

const excludePatterns = [
  'src/lib/database/',
  'src/lib/auth/',
  'src/lib/data/courses.ts',
  'src/lib/data/dashboard.ts',
  'src/lib/data/levels.ts',
  'src/lib/data/eval.ts',
  'src/lib/data/register.ts',
  'src/lib/data/question.ts',
  'src/lib/data/courseDashboard.ts',
  'src/lib/data/evalDashboard.ts',
  'src/lib/data/studentDashboard.ts',
  'src/hooks.server.ts',
  'src/app.d.ts'
];

function shouldProcessFile(filePath: string): boolean {
  // Check if file should be excluded
  if (excludePatterns.some(pattern => filePath.includes(pattern))) {
    return false;
  }
  
  // Check if file contains supabase references
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.toLowerCase().includes('supabase');
  } catch {
    return false;
  }
}

function findFilesToMigrate(dir: string): string[] {
  const files: string[] = [];
  
  function traverse(currentDir: string) {
    try {
      const items = readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = join(currentDir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!['node_modules', '.git', 'build', 'dist'].includes(item)) {
            traverse(fullPath);
          }
        } else if (['.ts', '.js', '.svelte'].includes(extname(item))) {
          if (shouldProcessFile(fullPath)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Could not read directory ${currentDir}:`, error);
    }
  }
  
  traverse(dir);
  return files;
}

function migrateFile(filePath: string): boolean {
  try {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // Apply migration rules
    for (const rule of migrationRules) {
      const originalContent = content;
      
      if (typeof rule.replacement === 'function') {
        content = content.replace(rule.pattern, rule.replacement);
      } else {
        content = content.replace(rule.pattern, rule.replacement);
      }
      
      if (content !== originalContent) {
        modified = true;
        console.log(`  ✓ Applied: ${rule.description}`);
      }
    }
    
    // Write back if modified
    if (modified) {
      writeFileSync(filePath, content, 'utf-8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error migrating ${filePath}:`, error);
    return false;
  }
}

function runMigration(): void {
  console.log('🚀 Starting comprehensive Supabase to Kysely migration...\n');
  
  const filesToMigrate = findFilesToMigrate('src');
  
  if (filesToMigrate.length === 0) {
    console.log('✅ No files need migration!');
    return;
  }
  
  console.log(`📋 Found ${filesToMigrate.length} files to migrate:\n`);
  
  let migratedCount = 0;
  
  for (const file of filesToMigrate) {
    console.log(`📄 Processing: ${file}`);
    
    if (migrateFile(file)) {
      migratedCount++;
      console.log(`  ✅ Migrated successfully\n`);
    } else {
      console.log(`  ⚠️  No changes needed\n`);
    }
  }
  
  console.log(`🎉 Migration complete!`);
  console.log(`📊 Summary: ${migratedCount}/${filesToMigrate.length} files migrated`);
  
  if (migratedCount > 0) {
    console.log('\n📝 Next steps:');
    console.log('1. Run type check: npm run check');
    console.log('2. Test the application');
    console.log('3. Fix any remaining type errors manually');
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

export { runMigration, migrateFile, findFilesToMigrate };

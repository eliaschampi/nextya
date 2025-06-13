import type { Session, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import type { Database as SupabaseDatabase } from './database.types';
import type { Database as KyselyDatabase } from './lib/database/types';
import type { Kysely } from 'kysely';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<SupabaseDatabase>;
			db: Kysely<KyselyDatabase>; // For migration to Kysely
			getSession: () => Promise<{
				session: Session | null;
			}>;
			getUser: () => Promise<{
				user: SupabaseUser | null;
			}>;
			safeGetSession: () => Promise<{ session: Session | null; user: SupabaseUser | null }>;
			session: Session | null;
			user: SupabaseUser | null;
			cookies: { name: string; value: string }[];
			title?: string;
		}
		interface PageData {
			session: Session | null;
			user: SupabaseUser | null;
			title?: string;
		}
	}
}

export {};

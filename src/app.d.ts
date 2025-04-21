import type { Session, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import type { Database } from './database.types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			getSession: () => Promise<{
				session: Session | null;
			}>;
			getUser: () => Promise<{
				user: SupabaseUser | null;
			}>;
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

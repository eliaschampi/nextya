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
		}
		interface PageData {
			session: Session | null;
			user: SupabaseUser | null;
		}
	}
}

export type User = Database['public']['Tables']['users']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Permission = Database['public']['Tables']['permissions']['Row'];

export {};

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from './database.types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			safeGetSession: () => Promise<{
				session: { user: User | null } | null;
				user: User | null;
			}>;
			session: { user: User | null } | null;
			user: User | null;
			cookies: { name: string; value: string }[];
		}

		interface PageData {
			session: { user: User | null } | null; // Permitir que `user` sea `null`
		}
	}
}

export type User = Database['public']['Tables']['users']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Permission = Database['public']['Tables']['permissions']['Row'];

export {};

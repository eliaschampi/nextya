import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			safeGetSession: () => Promise<{
				session: Session | null;
			}>;
			session: Session | null;
			cookies: { name: string; value: string }[];
		}
		interface PageData {
			session: Session | null;
		}
	}
}

export type User = Database['public']['Tables']['users']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Permission = Database['public']['Tables']['permissions']['Row'];

export {};

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

export interface User {
	user_id: string;
	role: string;
	email: string;
	phone: string | null;
	created_at: string;
	last_sign_in_at: string;
	name: string;
	last_name: string;
	photo_url: string | null;
	is_active: boolean;
}

export {};

import type { Database } from '$lib/database';
import type { Session, User } from '$lib/auth/session';

declare global {
	namespace App {
		interface Locals {
			db: Database;
			user: User | null;
			session: Session | null;
			can: {
				check: (entity: string, action: string) => Promise<boolean>;
				read: (entity: string) => Promise<boolean>;
				create: (entity: string) => Promise<boolean>;
				update: (entity: string) => Promise<boolean>;
				delete: (entity: string) => Promise<boolean>;
			};
		}
		interface PageData {
			user: User | null;
			session: Session | null;
		}
	}
}

export {};

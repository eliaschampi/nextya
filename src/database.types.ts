export type Database = {
	public: {
		Tables: {
			activity_log: {
				Row: {
					action: string;
					action_time: string | null;
					code: string;
					user_code: string;
				};
				Insert: {
					action: string;
					action_time?: string | null;
					code: string;
					user_code: string;
				};
				Update: {
					action?: string;
					action_time?: string | null;
					code?: string;
					user_code?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_user_activity';
						columns: ['user_code'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['code'];
					}
				];
			};
			permissions: {
				Row: {
					can_create: boolean;
					can_delete: boolean;
					can_read: boolean;
					can_update: boolean;
					code: string;
					created_at: string | null;
					entity: string;
					updated_at: string | null;
					user_code: string;
				};
				Insert: {
					can_create?: boolean;
					can_delete?: boolean;
					can_read?: boolean;
					can_update?: boolean;
					code: string;
					created_at?: string | null;
					entity: string;
					updated_at?: string | null;
					user_code: string;
				};
				Update: {
					can_create?: boolean;
					can_delete?: boolean;
					can_read?: boolean;
					can_update?: boolean;
					code?: string;
					created_at?: string | null;
					entity?: string;
					updated_at?: string | null;
					user_code?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_user_permissions';
						columns: ['user_code'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['code'];
					}
				];
			};
			profiles: {
				Row: {
					code: string;
					description: string | null;
					icon_path: string | null;
					is_active: boolean;
				};
				Insert: {
					code: string;
					description?: string | null;
					icon_path?: string | null;
					is_active?: boolean;
				};
				Update: {
					code?: string;
					description?: string | null;
					icon_path?: string | null;
					is_active?: boolean;
				};
				Relationships: [];
			};
			signin_history: {
				Row: {
					code: string;
					ip_address: string;
					sign_in_time: string | null;
					user_code: string;
				};
				Insert: {
					code: string;
					ip_address: string;
					sign_in_time?: string | null;
					user_code: string;
				};
				Update: {
					code?: string;
					ip_address?: string;
					sign_in_time?: string | null;
					user_code?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_user_signin';
						columns: ['user_code'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['code'];
					}
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type PublicSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
	PublicTableNameOrOptions extends
		| keyof (PublicSchema['Tables'] & PublicSchema['Views'])
		| { schema: keyof Database },
	TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
		? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
				Database[PublicTableNameOrOptions['schema']]['Views'])
		: never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
	? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
			Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
		? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
	TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
		? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
		: never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
	? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: PublicTableNameOrOptions extends keyof PublicSchema['Tables']
		? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
	TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
		? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
		: never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
	? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: PublicTableNameOrOptions extends keyof PublicSchema['Tables']
		? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
	EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
		? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
		: never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
	? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
	: PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
		? PublicSchema['Enums'][PublicEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof PublicSchema['CompositeTypes']
		| { schema: keyof Database },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
	? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes']
		? PublicSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

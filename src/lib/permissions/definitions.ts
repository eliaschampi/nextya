/**
 * PERMISSION DEFINITIONS
 * Clean, organized permission definitions for the application
 * Used by PermissionsModal and other admin components
 */

export interface PermissionDefinition {
	key: string;
	label: string;
	category: string;
	description: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
	// Usuarios
	{
		key: 'users:read',
		label: 'Ver usuarios',
		category: 'Usuarios',
		description: 'Ver lista de usuarios'
	},
	{
		key: 'users:create',
		label: 'Crear usuarios',
		category: 'Usuarios',
		description: 'Crear nuevos usuarios'
	},
	{
		key: 'users:update',
		label: 'Editar usuarios',
		category: 'Usuarios',
		description: 'Modificar usuarios existentes'
	},
	{
		key: 'users:delete',
		label: 'Eliminar usuarios',
		category: 'Usuarios',
		description: 'Eliminar usuarios'
	},
	{
		key: 'users:manage_permissions',
		label: 'Gestionar permisos',
		category: 'Usuarios',
		description: 'Asignar permisos a usuarios'
	},

	// Estudiantes
	{
		key: 'students:read',
		label: 'Ver estudiantes',
		category: 'Estudiantes',
		description: 'Ver lista de estudiantes'
	},
	{
		key: 'students:create',
		label: 'Crear estudiantes',
		category: 'Estudiantes',
		description: 'Registrar nuevos estudiantes'
	},
	{
		key: 'students:update',
		label: 'Editar estudiantes',
		category: 'Estudiantes',
		description: 'Modificar datos de estudiantes'
	},
	{
		key: 'students:delete',
		label: 'Eliminar estudiantes',
		category: 'Estudiantes',
		description: 'Eliminar estudiantes'
	},
	{
		key: 'students:import',
		label: 'Importar estudiantes',
		category: 'Estudiantes',
		description: 'Importar estudiantes desde CSV'
	},

	// Niveles
	{
		key: 'levels:read',
		label: 'Ver niveles',
		category: 'Académico',
		description: 'Ver niveles académicos'
	},
	{
		key: 'levels:create',
		label: 'Crear niveles',
		category: 'Académico',
		description: 'Crear nuevos niveles'
	},
	{
		key: 'levels:update',
		label: 'Editar niveles',
		category: 'Académico',
		description: 'Modificar niveles existentes'
	},
	{
		key: 'levels:delete',
		label: 'Eliminar niveles',
		category: 'Académico',
		description: 'Eliminar niveles'
	},

	// Cursos
	{
		key: 'courses:read',
		label: 'Ver cursos',
		category: 'Académico',
		description: 'Ver lista de cursos'
	},
	{
		key: 'courses:create',
		label: 'Crear cursos',
		category: 'Académico',
		description: 'Crear nuevos cursos'
	},
	{
		key: 'courses:update',
		label: 'Editar cursos',
		category: 'Académico',
		description: 'Modificar cursos existentes'
	},
	{
		key: 'courses:delete',
		label: 'Eliminar cursos',
		category: 'Académico',
		description: 'Eliminar cursos'
	},

	// Evaluaciones
	{
		key: 'evals:read',
		label: 'Ver evaluaciones',
		category: 'Evaluaciones',
		description: 'Ver evaluaciones'
	},
	{
		key: 'evals:create',
		label: 'Crear evaluaciones',
		category: 'Evaluaciones',
		description: 'Crear nuevas evaluaciones'
	},
	{
		key: 'evals:update',
		label: 'Editar evaluaciones',
		category: 'Evaluaciones',
		description: 'Modificar evaluaciones'
	},
	{
		key: 'evals:delete',
		label: 'Eliminar evaluaciones',
		category: 'Evaluaciones',
		description: 'Eliminar evaluaciones'
	},
	{
		key: 'keys:read',
		label: 'Ver claves',
		category: 'Evaluaciones',
		description: 'Visualizar claves'
	},
	{
		key: 'keys:upsert',
		label: 'Actualizar claves',
		category: 'Evaluaciones',
		description: 'Actualizar claves'
	},
	{
		key: 'evals:process',
		label: 'Procesar evaluaciones',
		category: 'Evaluaciones',
		description: 'Procesar respuestas de evaluaciones'
	},

	// Resultados
	{
		key: 'results:read',
		label: 'Ver resultados',
		category: 'Resultados',
		description: 'Ver resultados de evaluaciones'
	},
	{
		key: 'results:delete',
		label: 'Eliminar resultados',
		category: 'Resultados',
		description: 'Eliminar resultados'
	},
	{
		key: 'results:export',
		label: 'Exportar resultados',
		category: 'Resultados',
		description: 'Exportar resultados a archivos'
	},

	// Dashboards
	{
		key: 'dashboard:general',
		label: 'Dashboard general',
		category: 'Dashboards',
		description: 'Acceso al dashboard principal'
	},
	{
		key: 'dashboard:courses',
		label: 'Dashboard cursos',
		category: 'Dashboards',
		description: 'Estadísticas de cursos'
	},
	{
		key: 'dashboard:students',
		label: 'Dashboard estudiantes',
		category: 'Dashboards',
		description: 'Estadísticas de estudiantes'
	},
	{
		key: 'dashboard:evaluations',
		label: 'Dashboard evaluaciones',
		category: 'Dashboards',
		description: 'Estadísticas de evaluaciones'
	},

	// Sistema
	{
		key: 'system:config',
		label: 'Configuración',
		category: 'Sistema',
		description: 'Configurar el sistema'
	}
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get permissions grouped by category
 */
export function getPermissionsByCategory(): Record<string, PermissionDefinition[]> {
	return PERMISSION_DEFINITIONS.reduce(
		(acc, permission) => {
			if (!acc[permission.category]) {
				acc[permission.category] = [];
			}
			acc[permission.category].push(permission);
			return acc;
		},
		{} as Record<string, PermissionDefinition[]>
	);
}

/**
 * Get permission definition by key
 */
export function getPermissionByKey(key: string): PermissionDefinition | undefined {
	return PERMISSION_DEFINITIONS.find((p) => p.key === key);
}

/**
 * Parse permission key into entity and action
 */
export function parsePermissionKey(key: string): { entity: string; action: string } {
	const [entity, action] = key.split(':');
	return { entity, action };
}

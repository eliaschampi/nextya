<!-- src/lib/components/PermissionsModal.svelte -->
<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { entities } from '$lib/data/entities';
	import { Shield } from 'lucide-svelte';
	import type { User } from '@supabase/supabase-js';

	// Define available actions
	const ACTIONS = ['read', 'create', 'update', 'delete'] as const;
	type Action = (typeof ACTIONS)[number];

	// New permission structure
	type EntityPermissions = Record<Action, boolean>;
	type PermissionRecord = Record<string, EntityPermissions>;

	type ApiPermission = {
		code: string;
		user_code: string;
		entity: string;
		user_action: string;
	};

	const {
		user,
		open = false,
		onClose = () => {}
	} = $props<{
		user: User;
		open?: boolean;
		onClose?: () => void;
	}>();

	// State management
	let modal: HTMLDialogElement | null = $state(null);
	let permissions = $state<PermissionRecord>({});
	let loading = $state(false);
	let error = $state('');
	let saving = $state(false);
	let allEntities = $derived(entities);

	// Derived states for all permissions
	let allPermissionsByAction = $state<Record<Action, boolean>>(
		ACTIONS.reduce(
			(acc, action) => {
				acc[action] = false;
				return acc;
			},
			{} as Record<Action, boolean>
		)
	);

	let allPermissionsGloballyEnabled = $state(false);
	let entityStates = $state<Record<string, boolean>>({});

	// Update derived states when permissions change
	$effect(() => {
		if (Object.keys(permissions).length === 0) return;

		// Update action permissions
		ACTIONS.forEach((action) => {
			allPermissionsByAction[action] = Object.values(permissions).every((p) => p[action]);
		});

		// Update global state
		allPermissionsGloballyEnabled = ACTIONS.every((action) => allPermissionsByAction[action]);

		// Update entity states
		entityStates = Object.fromEntries(
			Object.entries(permissions).map(([entity, perms]) => [
				entity,
				ACTIONS.every((action) => perms[action])
			])
		);
	});

	// Modal control
	$effect(() => {
		if (open && modal) {
			modal.showModal();
			loadPermissions();
		} else if (!open && modal) {
			modal.close();
		}
	});

	// Close event handling
	$effect(() => {
		const modalElement = modal;
		if (!modalElement) return;

		const handleClose = () => onClose();
		modalElement.addEventListener('close', handleClose);
		return () => modalElement.removeEventListener('close', handleClose);
	});

	// Load permissions from API
	async function loadPermissions() {
		if (!user?.id) return;

		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/users/${user.id}/permissions`);
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Error fetching permissions');
			}

			const { permissions: permissionsData } = (await response.json()) as {
				permissions: ApiPermission[];
			};

			// Group permissions by entity
			const permissionsByEntity: Record<string, string[]> = {};
			permissionsData.forEach((p) => {
				if (!permissionsByEntity[p.entity]) {
					permissionsByEntity[p.entity] = [];
				}
				permissionsByEntity[p.entity].push(p.user_action);
			});

			// Convert to our permission record format
			const permissionsMap: PermissionRecord = {};
			Object.entries(permissionsByEntity).forEach(([entity, actions]) => {
				permissionsMap[entity] = ACTIONS.reduce((acc, action) => {
					acc[action] = actions.includes(action);
					return acc;
				}, {} as EntityPermissions);
			});

			// Initialize all entities with their permissions
			permissions = allEntities.reduce<PermissionRecord>((acc, entity) => {
				acc[entity.label] =
					permissionsMap[entity.label] ||
					ACTIONS.reduce((perms, action) => {
						perms[action] = false;
						return perms;
					}, {} as EntityPermissions);
				return acc;
			}, {});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Error loading permissions';
			console.error('Permission loading error:', err);
		} finally {
			loading = false;
		}
	}

	// Save permissions
	async function savePermissions() {
		saving = true;
		error = '';

		try {
			// Convert our permission format to the API format
			const permissionsToSave: { entity: string; user_action: string }[] = [];

			Object.entries(permissions).forEach(([entity, entityPermissions]) => {
				ACTIONS.forEach((action) => {
					if (entityPermissions[action]) {
						permissionsToSave.push({
							entity,
							user_action: action
						});
					}
				});
			});

			const response = await fetch(`/api/users/${user.id}/permissions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ permissions: permissionsToSave })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Error guardando permisos');
			}

			const result = await response.json();
			showToast(`Permisos actualizados correctamente (${result.count} permisos)`, 'success');
			await invalidate('users:permissions');
			closeModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Error guardando permisos';
			console.error('Permission saving error:', err);
		} finally {
			saving = false;
		}
	}

	// Utility functions
	function closeModal() {
		modal?.close();
	}

	function getEntityName(label: string): string {
		return allEntities.find((e) => e.label === label)?.name || label;
	}

	// Batch permission operations
	function setAllPermissions(action: Action, value: boolean) {
		// Create a new object to ensure reactivity
		permissions = Object.fromEntries(
			Object.entries(permissions).map(([key, perms]) => [key, { ...perms, [action]: value }])
		);
	}

	function setEntityPermissions(entity: string, value: boolean) {
		if (permissions[entity]) {
			// Create a new object to ensure reactivity
			permissions = {
				...permissions,
				[entity]: ACTIONS.reduce((acc, action) => {
					acc[action] = value;
					return acc;
				}, {} as EntityPermissions)
			};
		}
	}

	// Event handler helpers with proper typing
	function handleToggleChange(callback: (value: boolean) => void): (e: Event) => void {
		return (e: Event) => {
			const target = e.target as HTMLInputElement;
			callback(target.checked);
		};
	}

	// Action name mapping for display
	const actionNames: Record<Action, string> = {
		read: 'Leer',
		create: 'Crear',
		update: 'Editar',
		delete: 'Eliminar'
	};
</script>

<dialog bind:this={modal} class="modal">
	<div class="modal-box max-w-3xl">
		<div class="flex justify-between items-center mb-4">
			<h3 class="text-lg font-bold flex items-center gap-2">
				<Shield class="w-5 h-5 text-primary" />
				Permisos de Usuario: {user.user_metadata?.name}
				{user.user_metadata?.last_name}
			</h3>
		</div>

		{#if loading}
			<div class="flex justify-center my-8">
				<span class="loading loading-spinner loading-md text-primary"></span>
			</div>
		{:else if error}
			<div class="my-4">
				<Message description={error} type="error" />
				<div class="flex justify-center mt-4">
					<button class="btn btn-sm btn-primary" onclick={loadPermissions}> Reintentar </button>
				</div>
			</div>
		{:else}
			<div class="overflow-x-auto my-4">
				<table class="table table-zebra">
					<thead>
						<tr>
							<th>Entidad</th>
							{#each ACTIONS as action (action)}
								<th class="text-center">{actionNames[action]}</th>
							{/each}
							<th class="text-center align-bottom pb-3">Todos</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td><b>Todos</b></td>
							{#each ACTIONS as action (action)}
								<td class="text-center">
									<input
										type="checkbox"
										class="toggle toggle-primary toggle-sm"
										title="Activar/Desactivar {actionNames[action]} para todos"
										disabled={loading}
										checked={allPermissionsByAction[action]}
										onchange={handleToggleChange((value) => setAllPermissions(action, value))}
									/>
								</td>
							{/each}
							<td class="text-center">
								<input
									type="checkbox"
									class="toggle toggle-secondary toggle-sm"
									title="Activar/Desactivar todos los permisos"
									disabled={loading}
									checked={allPermissionsGloballyEnabled}
									onchange={handleToggleChange((value) => {
										ACTIONS.forEach((action) => setAllPermissions(action, value));
									})}
								/>
							</td>
						</tr>
						{#each Object.entries(permissions) as [entity, permission] (entity)}
							<tr>
								<td>{getEntityName(entity)}</td>
								{#each ACTIONS as action (action)}
									<td class="text-center">
										<input
											type="checkbox"
											class="toggle toggle-primary toggle-sm"
											bind:checked={permission[action]}
											disabled={loading}
										/>
									</td>
								{/each}
								<td class="text-center">
									<input
										type="checkbox"
										class="toggle toggle-secondary toggle-sm"
										title="Activar/Desactivar todos los permisos para esta entidad"
										disabled={loading}
										checked={entityStates[entity]}
										onchange={handleToggleChange((value) => setEntityPermissions(entity, value))}
									/>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<div class="modal-action flex justify-center gap-2">
			<button class="btn" onclick={closeModal} disabled={saving}>Cancelar</button>
			<button
				class="btn btn-primary"
				onclick={savePermissions}
				disabled={loading || saving || !!error}
			>
				{#if saving}
					<span class="loading loading-spinner loading-xs"></span>
				{/if}
				Guardar
			</button>
		</div>
	</div>
</dialog>

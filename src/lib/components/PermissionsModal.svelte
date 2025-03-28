<!-- src/lib/components/PermissionsModal.svelte -->
<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { entities } from '$lib/data/entities';
	import { Shield } from 'lucide-svelte';
	import type { User } from '@supabase/supabase-js';

	type PermissionValue = {
		can_create: boolean;
		can_update: boolean;
		can_delete: boolean;
	};

	type PermissionRecord = Record<string, PermissionValue>;

	type ApiPermission = {
		entity: string;
		can_create: boolean;
		can_update: boolean;
		can_delete: boolean;
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

	let allCanCreate = $derived(
		Object.keys(permissions).length > 0 && Object.values(permissions).every((p) => p.can_create)
	);
	let allCanUpdate = $derived(
		Object.keys(permissions).length > 0 && Object.values(permissions).every((p) => p.can_update)
	);
	let allCanDelete = $derived(
		Object.keys(permissions).length > 0 && Object.values(permissions).every((p) => p.can_delete)
	);

	let allPermissionsGloballyEnabled = $derived(allCanCreate && allCanUpdate && allCanDelete);

	let entityStates = $derived(
		Object.fromEntries(
			Object.entries(permissions).map(([entity, p]) => [
				entity,
				p.can_create && p.can_update && p.can_delete
			])
		)
	);

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

			// Convert array to record for faster lookups
			const permissionsMap: PermissionRecord = {};
			permissionsData.forEach((p: ApiPermission) => {
				permissionsMap[p.entity] = {
					can_create: p.can_create,
					can_update: p.can_update,
					can_delete: p.can_delete
				};
			});

			// Initialize all entities with their permissions
			permissions = allEntities.reduce<PermissionRecord>((acc, entity) => {
				acc[entity.label] = permissionsMap[entity.label] || {
					can_create: false,
					can_update: false,
					can_delete: false
				};
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
			// Convert record back to array for API
			const permissionsArray = Object.entries(permissions).map(([entity, perms]) => ({
				entity,
				...perms
			}));

			const response = await fetch(`/api/users/${user.id}/permissions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ permissions: permissionsArray })
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
	function setAllPermissions(type: 'can_create' | 'can_update' | 'can_delete', value: boolean) {
		// Create a new object to ensure reactivity
		permissions = Object.fromEntries(
			Object.entries(permissions).map(([key, perms]) => [key, { ...perms, [type]: value }])
		);
	}

	function setEntityPermissions(entity: string, value: boolean) {
		if (permissions[entity]) {
			// Create a new object to ensure reactivity
			permissions = {
				...permissions,
				[entity]: {
					can_create: value,
					can_update: value,
					can_delete: value
				}
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
							<th class="text-center"> Crear </th>
							<th class="text-center"> Editar </th>
							<th class="text-center"> Eliminar </th>
							<th class="text-center align-bottom pb-3">Todos</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td> <b>Todos</b> </td>
							<td class="text-center">
								<input
									type="checkbox"
									class="toggle toggle-primary toggle-sm"
									title="Activar/Desactivar Crear para todos"
									disabled={loading}
									checked={allCanCreate}
									onchange={handleToggleChange((value) => setAllPermissions('can_create', value))}
								/>
							</td>
							<td class="text-center">
								<input
									type="checkbox"
									class="toggle toggle-primary toggle-sm"
									title="Activar/Desactivar Modificar para todos"
									disabled={loading}
									checked={allCanUpdate}
									onchange={handleToggleChange((value) => setAllPermissions('can_update', value))}
								/>
							</td>
							<td class="text-center">
								<input
									type="checkbox"
									class="toggle toggle-primary toggle-sm"
									title="Activar/Desactivar Eliminar para todos"
									disabled={loading}
									checked={allCanDelete}
									onchange={handleToggleChange((value) => setAllPermissions('can_delete', value))}
								/>
							</td>
							<td class="text-center">
								<input
									type="checkbox"
									class="toggle toggle-secondary toggle-sm"
									title="Activar/Desactivar todos los permisos"
									disabled={loading}
									checked={allPermissionsGloballyEnabled}
									onchange={handleToggleChange((value) => {
										setAllPermissions('can_create', value);
										setAllPermissions('can_update', value);
										setAllPermissions('can_delete', value);
									})}
								/>
							</td>
						</tr>
						{#each Object.entries(permissions) as [entity, permission] (entity)}
							<tr>
								<td>{getEntityName(entity)}</td>
								<td class="text-center">
									<input
										type="checkbox"
										class="toggle toggle-primary toggle-sm"
										bind:checked={permission.can_create}
										disabled={loading}
									/>
								</td>
								<td class="text-center">
									<input
										type="checkbox"
										class="toggle toggle-primary toggle-sm"
										bind:checked={permission.can_update}
										disabled={loading}
									/>
								</td>
								<td class="text-center">
									<input
										type="checkbox"
										class="toggle toggle-primary toggle-sm"
										bind:checked={permission.can_delete}
										disabled={loading}
									/>
								</td>
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

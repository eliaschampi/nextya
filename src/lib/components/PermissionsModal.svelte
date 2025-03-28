<!-- src/lib/components/PermissionsModal.svelte -->
<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { entities } from '$lib/data/entities';
	import { Shield, CheckCircle2, XCircle } from 'lucide-svelte';
	import type { User } from '@supabase/supabase-js';

	// Define permission types
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

	// Props definition with defaults
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
		permissions = Object.fromEntries(
			Object.entries(permissions).map(([key, perms]) => [key, { ...perms, [type]: value }])
		);
	}

	function setEntityPermissions(entity: string, value: boolean) {
		if (permissions[entity]) {
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
</script>

<dialog bind:this={modal} class="modal">
	<div class="modal-box max-w-3xl">
		<div class="flex justify-between items-center mb-4">
			<h3 class="text-lg font-bold flex items-center gap-2">
				<Shield class="w-5 h-5 text-primary" />
				Permisos de Usuario: {user.user_metadata?.name}
				{user.user_metadata?.last_name}
			</h3>
			<!-- Quick actions for bulk operations -->
			{#if !loading}
				<div class="flex gap-2">
					<div class="dropdown dropdown-end">
						<div tabindex="0" role="button" class="btn btn-sm">Acciones rápidas</div>
						<ul class="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52">
							<li>
								<button onclick={() => setAllPermissions('can_create', true)}>
									Activar Creación
								</button>
							</li>
							<li>
								<button onclick={() => setAllPermissions('can_update', true)}>
									Activar Edición
								</button>
							</li>
							<li>
								<button onclick={() => setAllPermissions('can_delete', true)}>
									Activar Eliminación
								</button>
							</li>
							<li>
								<button onclick={() => setAllPermissions('can_create', false)}>
									Desact. Creación
								</button>
							</li>
							<li>
								<button onclick={() => setAllPermissions('can_update', false)}>
									Desact. Edición
								</button>
							</li>
							<li>
								<button onclick={() => setAllPermissions('can_delete', false)}>
									Desact. Eliminación
								</button>
							</li>
						</ul>
					</div>
				</div>
			{/if}
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
							<th class="text-center">Crear</th>
							<th class="text-center">Modificar</th>
							<th class="text-center">Eliminar</th>
							<th class="text-center w-24">Acciones</th>
						</tr>
					</thead>
					<tbody>
						{#each Object.entries(permissions) as [entity, permission] (entity)}
							<tr>
								<td>{getEntityName(entity)}</td>
								<td class="text-center">
									<input
										type="checkbox"
										class="toggle toggle-primary toggle-sm"
										bind:checked={permission.can_create}
									/>
								</td>
								<td class="text-center">
									<input
										type="checkbox"
										class="toggle toggle-primary toggle-sm"
										bind:checked={permission.can_update}
									/>
								</td>
								<td class="text-center">
									<input
										type="checkbox"
										class="toggle toggle-primary toggle-sm"
										bind:checked={permission.can_delete}
									/>
								</td>
								<td class="text-center">
									<div class="flex gap-1 justify-center">
										<button
											class="btn btn-xs btn-outline btn-success"
											onclick={() => setEntityPermissions(entity, true)}
											title="Habilitar todos"
										>
											<CheckCircle2 class="w-3 h-3" />
										</button>
										<button
											class="btn btn-xs btn-outline btn-error"
											onclick={() => setEntityPermissions(entity, false)}
											title="Deshabilitar todos"
										>
											<XCircle class="w-3 h-3" />
										</button>
									</div>
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

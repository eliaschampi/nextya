<script lang="ts">
	import LogoHead from '$lib/components/LogoHead.svelte';
	import {
		Bird,
		ChartArea,
		ChevronDown,
		FileText,
		FolderPen,
		House,
		LogOut,
		Menu,
		Moon,
		Settings,
		Sun,
		UserCog,
		UserRound
	} from 'lucide-svelte';

	import { page } from '$app/state';
	import { getInitials } from '$lib/utils/initialName';
	import { theme } from '$lib/stores/theme';
	import Background from '$lib/components/background.svelte';
	// Helper function para verificar permisos
	function hasPermission(permissionKey: string): boolean {
		return page.data.userPermissions?.includes(permissionKey) || false;
	}

	function hasAnyPermission(...permissionKeys: string[]): boolean {
		return permissionKeys.some((key) => hasPermission(key));
	}

	let { children } = $props();

	let isDarkTheme = $derived($theme === 'dark');

	interface userData {
		name?: string;
		last_name?: string;
		photo_url?: string;
	}

	let userData = $state<userData>({
		name: page.data.user?.name || '',
		last_name: page.data.user?.last_name || ''
	});

	function toggleTheme() {
		theme.toggle();
	}

	// Los permisos se cargan automáticamente desde page.data.userPermissions
	// No necesitamos fetchPermissions ni clearPermissions
</script>

<svelte:head>
	<title>
		{page.data?.title ? `${page.data.title} | Nextya` : 'Nextya'}
	</title>
</svelte:head>

<div class="drawer lg:drawer-open h-screen overflow-hidden">
	<input id="drawer-toggle" type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex flex-col h-screen overflow-y-auto">
		<nav class="navbar bg-base-200 shadow-sm px-4 h-16 sticky top-0 z-30">
			<label for="drawer-toggle" class="drawer-button lg:hidden">
				<Menu class="w-5 h-5" />
			</label>
			<div class="flex-1 flex items-center">
				<a href="/" class="btn btn-ghost btn-sm" aria-label="home">
					<House class="w-5 h-5" />
				</a>
				<div class="text-base font-medium">{page.data.title ?? 'Inicio'}</div>
			</div>
			<!-- Navbar Actions -->
			<div class="flex items-center gap-2">
				<!-- Theme Toggle -->
				<button
					class="btn btn-ghost btn-sm btn-circle"
					onclick={toggleTheme}
					aria-label="toggle theme"
				>
					{#if isDarkTheme}
						<Sun class="w-5 h-5" />
					{:else}
						<Moon class="w-5 h-5" />
					{/if}
				</button>

				<!-- User Menu Dropdown -->
				{#if page.data.user}
					<div class="dropdown dropdown-end">
						<div
							tabindex="0"
							role="button"
							class="flex items-center gap-1.5 btn btn-ghost btn-sm px-2"
						>
							<div class="avatar">
								<div class="w-6 rounded-full ring ring-primary ring-offset-base-100 ring-offset-1">
									{#if userData.photo_url}
										<img
											src={`/${userData.photo_url}`}
											alt={`Avatar de ${userData.name} ${userData.last_name}`}
											class="mask mask-squircle"
										/>
									{:else}
										<div
											class="flex items-center justify-center h-full bg-primary text-primary-content mask mask-squircle"
										>
											<span class="text-xs font-semibold">
												{getInitials(userData.name || '', userData.last_name || '')}
											</span>
										</div>
									{/if}
								</div>
							</div>
							<ChevronDown class="h-3.5 w-3.5 opacity-70" />
						</div>
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<ul
							tabindex="0"
							class="dropdown-content menu bg-base-200 rounded-box shadow w-52 mt-2 p-2 z-50"
						>
							<li class="menu-title pt-0 pb-2">
								<span class="font-medium">{userData.name} {userData.last_name}</span>
							</li>
							<li>
								<a href="/profile" class="flex gap-2"><UserCog class="h-4 w-4" />Mi perfil</a>
							</li>
							<li><a href="/config" class="flex gap-2"><Bird class="h-4 w-4" />Sistema</a></li>
							<li class="mt-1 pt-1 border-t border-base-300">
								<form action="/api/logout" method="POST">
									<button type="submit" class="w-full flex gap-2 text-error">
										<LogOut class="h-4 w-4" />Cerrar sesión
									</button>
								</form>
							</li>
						</ul>
					</div>
				{/if}
			</div>
		</nav>
		<main class="flex-1 p-6">
			<Background zIndex="z-[-2]" />
			{@render children()}
		</main>
	</div>

	<div class="drawer-side shadow z-40">
		<!-- Clicking this label closes the sidebar on mobile -->
		<label for="drawer-toggle" aria-label="Close sidebar" class="drawer-overlay"></label>
		<aside class="bg-base-200 text-base-content h-screen w-72 flex flex-col overflow-y-auto">
			<LogoHead />
			<div class="p-3 flex-1 overflow-y-auto">
				<ul class="menu rounded-box w-full space-y-1.5">
					<li>
						<a href="/" class="flex gap-2.5 py-2.5">
							<House class="h-4 w-4" />
							<span>Inicio</span>
						</a>
					</li>

					<!-- Dashboards - Solo si tiene permisos -->
					{#if hasAnyPermission('dashboard:general', 'dashboard:courses', 'dashboard:students', 'dashboard:evaluations')}
						<li class="menu-title pt-2">
							<span>Dashboards</span>
						</li>

						<li>
							<details>
								<summary class="flex gap-2.5 py-2">
									<ChartArea class="h-4 w-4" />
									<span>Reportes</span>
								</summary>
								<ul class="pl-4">
									{#if hasPermission('dashboard:general')}
										<li><a href="/dashboard">General</a></li>
									{/if}
									{#if hasPermission('dashboard:courses')}
										<li><a href="/dashboard/course">Cursos</a></li>
									{/if}
									{#if hasPermission('dashboard:students')}
										<li><a href="/dashboard/student">Estudiantes</a></li>
									{/if}
									{#if hasPermission('dashboard:evaluations')}
										<li><a href="/dashboard/eval">Evaluaciones</a></li>
									{/if}
								</ul>
							</details>
						</li>
					{/if}
					<!-- Sección Académica -->
					{#if hasPermission('levels:read') || hasPermission('courses:read') || hasPermission('students:read') || hasPermission('evals:read')}
						<li class="menu-title pt-2">
							<span>Académico</span>
						</li>

						<!-- Estructura -->
						{#if hasPermission('levels:read') || hasPermission('courses:read')}
							<li>
								<details>
									<summary class="flex gap-2.5 py-2">
										<Settings class="h-4 w-4" />
										<span>Estructura</span>
									</summary>
									<ul class="pl-4">
										{#if hasPermission('levels:read')}
											<li><a href="/levels">Niveles</a></li>
										{/if}
										{#if hasPermission('courses:read')}
											<li><a href="/courses">Cursos</a></li>
										{/if}
									</ul>
								</details>
							</li>
						{/if}

						<!-- Estudiantes -->
						{#if hasPermission('students:read') || hasPermission('students:import')}
							<li>
								<details>
									<summary class="flex gap-2.5 py-2">
										<UserRound class="h-4 w-4" />
										<span>Estudiantes</span>
									</summary>
									<ul class="pl-4">
										{#if hasPermission('students:read')}
											<li><a href="/student">Gestionar</a></li>
										{/if}
										{#if hasPermission('students:import')}
											<li><a href="/impcsv">Importar</a></li>
										{/if}
										{#if hasPermission('results:read')}
											<li><a href="/eval/student">Resultados</a></li>
										{/if}
									</ul>
								</details>
							</li>
						{/if}

						<!-- Evaluaciones -->
						{#if hasPermission('evals:read') || hasPermission('evals:process')}
							<li>
								<details>
									<summary class="flex gap-2.5 py-2">
										<FolderPen class="h-4 w-4" />
										<span>Evaluaciones</span>
									</summary>
									<ul class="pl-4">
										{#if hasPermission('evals:read')}
											<li><a href="/eval">Registrar</a></li>
										{/if}
										{#if hasPermission('evals:process')}
											<li><a href="/eval/check">Procesar</a></li>
										{/if}
									</ul>
								</details>
							</li>
						{/if}

						<!-- Resultados -->
						{#if hasPermission('results:read')}
							<li>
								<a href="/result" class="flex gap-2.5 py-2.5">
									<FileText class="h-4 w-4" />
									<span>Resultados</span>
								</a>
							</li>
						{/if}
					{/if}

					<!-- Administración -->
					{#if hasPermission('users:read') || hasPermission('system:config')}
						<li class="menu-title pt-2">
							<span>Administración</span>
						</li>

						{#if hasPermission('users:read')}
							<li>
								<a href="/users" class="flex gap-2.5 py-2.5">
									<UserCog class="h-4 w-4" />
									<span>Usuarios</span>
								</a>
							</li>
						{/if}

						{#if hasPermission('system:config')}
							<li>
								<a href="/config" class="flex gap-2.5 py-2.5">
									<Bird class="h-4 w-4" />
									<span>Configuración</span>
								</a>
							</li>
						{/if}
					{/if}
				</ul>
			</div>

			<!-- Mobile user profile section -->
			{#if page.data.user}
				<div class="border-t border-base-300 p-3">
					<div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-base-100">
						<div class="avatar">
							<div class="w-9 rounded-full ring ring-primary ring-offset-base-100 ring-offset-1">
								{#if userData.photo_url}
									<img
										src={`/${userData.photo_url}`}
										alt={`Avatar de ${userData.name} ${userData.last_name}`}
										class="mask mask-squircle"
									/>
								{:else}
									<div
										class="flex items-center justify-center h-full bg-primary text-primary-content mask mask-squircle"
									>
										<span class="font-semibold">
											{getInitials(userData.name || '', userData.last_name || '')}
										</span>
									</div>
								{/if}
							</div>
						</div>
						<div class="flex-1 min-w-0">
							<a href="/profile">
								<p class="text-sm font-medium truncate">
									{userData.name}
									{userData.last_name}
								</p>
								<p class="text-xs flex items-center">
									<span class="w-1.5 h-1.5 bg-success rounded-full mr-1"></span>
									<span>En línea</span>
								</p>
							</a>
						</div>
						<form action="/api/logout" method="POST" class="ml-auto">
							<button type="submit" class="btn btn-ghost btn-xs" aria-label="logout">
								<LogOut class="h-4 w-4" />
							</button>
						</form>
					</div>
				</div>
			{/if}
		</aside>
	</div>
</div>

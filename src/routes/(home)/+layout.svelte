<script lang="ts">
	import LogoHead from '$lib/components/LogoHead.svelte';
	import {
		Bird,
		ChartArea,
		ChevronDown,
		FolderPen,
		House,
		LogOut,
		Menu,
		Moon,
		Search,
		Settings,
		Sun,
		Table,
		UserCog,
		UserRound
	} from 'lucide-svelte';

	import { page } from '$app/state';
	import { getInitials } from '$lib/utils/initialName';
	import { theme } from '$lib/stores/theme';
	import Background from '$lib/components/background.svelte';
	let { children } = $props();
	let modal: HTMLDialogElement | null = null;
	let isDarkTheme = $derived($theme === 'dark');

	// Define interface for user metadata
	interface UserMetadata {
		name?: string;
		last_name?: string;
		photo_url?: string;
	}

	// Access user_metadata which contains name, last_name, and photo_url
	let userMetadata = $state<UserMetadata>((page.data.user?.user_metadata as UserMetadata) || {});

	function openModal() {
		modal?.showModal();
	}

	// Theme toggle function
	function toggleTheme() {
		theme.toggle();
	}
</script>

<svelte:head>
	<title>
		{page.data?.title ? `${page.data.title} | Nextya` : 'Nextya'}
	</title>
</svelte:head>

<div class="drawer lg:drawer-open">
	<input id="drawer-toggle" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content flex flex-col min-h-screen">
		<nav class="navbar bg-base-200 shadow-sm px-4 h-16">
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
				<!-- Search Button -->
				<button class="btn btn-ghost btn-sm btn-circle" aria-label="search" onclick={openModal}>
					<Search class="w-4 h-4" />
				</button>

				<!-- Theme Toggle -->
				<button
					class="btn btn-ghost btn-sm btn-circle"
					onclick={toggleTheme}
					aria-label="toggle theme"
				>
					{#if isDarkTheme}
						<Sun class="w-4 h-4" />
					{:else}
						<Moon class="w-4 h-4" />
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
									{#if userMetadata.photo_url}
										<img
											src={userMetadata.photo_url}
											alt={`Avatar de ${userMetadata.name} ${userMetadata.last_name}`}
											class="mask mask-squircle"
										/>
									{:else}
										<div
											class="flex items-center justify-center h-full bg-primary text-primary-content mask mask-squircle"
										>
											<span class="text-xs font-semibold">
												{getInitials(userMetadata.name || '', userMetadata.last_name || '')}
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
							class="dropdown-content menu bg-base-100 rounded-box shadow-lg w-52 mt-2 p-2 z-50"
						>
							<li class="menu-title pt-0 pb-2">
								<span class="font-medium">{userMetadata.name} {userMetadata.last_name}</span>
								<span class="text-xs flex items-center"
									><span class="w-1.5 h-1.5 bg-success rounded-full mr-1"></span>En línea</span
								>
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

				<dialog bind:this={modal} class="modal modal-bottom sm:modal-middle">
					<div class="modal-box">
						<h3 class="text-lg font-bold">Búsqueda</h3>
						<div class="relative my-4">
							<div class="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
								<Search class="w-4 h-4 text-gray-500" />
							</div>
							<input
								type="search"
								class="input input-bordered w-full ps-10"
								placeholder="Buscar..."
							/>
						</div>
						<div class="modal-action">
							<form method="dialog">
								<button class="btn">Cerrar</button>
							</form>
						</div>
					</div>
					<form method="dialog" class="modal-backdrop">
						<button>cerrar</button>
					</form>
				</dialog>
			</div>
		</nav>
		<main class="flex-1 p-6">
			<Background />
			{@render children()}
		</main>
	</div>

	<div class="drawer-side shadow-md z-20">
		<!-- Clicking this label closes the sidebar on mobile -->
		<label for="drawer-toggle" aria-label="Close sidebar" class="drawer-overlay"></label>
		<aside class="bg-base-200 text-base-content min-h-full w-72 flex flex-col">
			<LogoHead />
			<div class="p-3 flex-1 overflow-y-auto">
				<ul class="menu rounded-box w-full space-y-1.5">
					<li>
						<a href="/" class="flex gap-2.5 py-2.5">
							<House class="h-4 w-4" />
							<span>Inicio</span>
						</a>
					</li>

					<li class="menu-title pt-2">
						<span>Administración</span>
					</li>

					<li>
						<details>
							<summary class="flex gap-2.5 py-2">
								<ChartArea class="h-4 w-4" />
								<span>Reportes</span>
							</summary>
							<ul class="pl-4">
								<li><a href="/dashboard">General</a></li>
							</ul>
						</details>
					</li>

					<li>
						<details>
							<summary class="flex gap-2.5 py-2">
								<Settings class="h-4 w-4" />
								<span>Configuración</span>
							</summary>
							<ul class="pl-4">
								<li><a href="/levels">Niveles</a></li>
								<li><a href="/courses">Cursos</a></li>
								<li><a href="/student">Estudiantes</a></li>
							</ul>
						</details>
					</li>

					<li>
						<details>
							<summary class="flex gap-2.5 py-2">
								<FolderPen class="h-4 w-4" />
								<span>Evaluaciones</span>
							</summary>
							<ul class="pl-4">
								<li><a href="/eval">Registrar</a></li>
								<li><a href="/">Escanear</a></li>
								<li><a href="/">Cargar Datos</a></li>
							</ul>
						</details>
					</li>

					<li>
						<details>
							<summary class="flex gap-2.5 py-2">
								<Table class="h-4 w-4" />
								<span>Resultados</span>
							</summary>
							<ul class="pl-4">
								<li><a href="/result">Listado</a></li>
								<li><a href="/">Estudiante</a></li>
							</ul>
						</details>
					</li>

					<li class="menu-title pt-2">
						<span>Sistema</span>
					</li>

					<li>
						<a href="/users" class="flex gap-2.5 py-2.5">
							<UserRound class="h-4 w-4" />
							<span>Usuarios</span>
						</a>
					</li>

					<li>
						<a href="/config" class="flex gap-2.5 py-2.5">
							<Bird class="h-4 w-4" />
							<span>Sistema</span>
						</a>
					</li>
				</ul>
			</div>

			<!-- Mobile user profile section -->
			{#if page.data.user}
				<div class="border-t border-base-300 p-3">
					<div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-base-100">
						<div class="avatar">
							<div class="w-9 rounded-full ring ring-primary ring-offset-base-100 ring-offset-1">
								{#if userMetadata.photo_url}
									<img
										src={userMetadata.photo_url}
										alt={`Avatar de ${userMetadata.name} ${userMetadata.last_name}`}
										class="mask mask-squircle"
									/>
								{:else}
									<div
										class="flex items-center justify-center h-full bg-primary text-primary-content mask mask-squircle"
									>
										<span class="font-semibold">
											{getInitials(userMetadata.name || '', userMetadata.last_name || '')}
										</span>
									</div>
								{/if}
							</div>
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium truncate">
								{userMetadata.name}
								{userMetadata.last_name}
							</p>
							<p class="text-xs flex items-center">
								<span class="w-1.5 h-1.5 bg-success rounded-full mr-1"></span>
								<span>En línea</span>
							</p>
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

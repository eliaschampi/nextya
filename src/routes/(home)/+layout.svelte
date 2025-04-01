<script lang="ts">
	import LogoHead from '$lib/components/LogoHead.svelte';
	import {
		Bell,
		Bird,
		ChartArea,
		ChevronsUpDown,
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
		<nav class="navbar bg-base-200 shadow px-4">
			<label for="drawer-toggle" class="drawer-button lg:hidden">
				<Menu class="w-5 h-5" />
			</label>
			<div class="flex-1 flex items-center">
				<a href="/" class="btn btn-ghost" aria-label="home aria">
					<House class="w-5 h-5" />
				</a>
				<div class="text-lg">{page.data.title ?? 'Inicio'}</div>
			</div>
			<!-- Navbar Icons -->
			<div class="flex items-center gap-1">
				<!-- Search Icon a is not clickable -->
				<button class="btn btn-ghost btn-circle" aria-label="search aria" onclick={openModal}>
					<Search class="w-5 h-5" />
				</button>
				<!-- Notification Icon -->
				<a href="/" class="btn btn-ghost btn-circle" aria-label="notification aria">
					<Bell class="w-5 h-5" />
				</a>
				<!-- Theme Toggle -->
				<label class="swap swap-rotate ml-1">
					<input
						type="checkbox"
						class="theme-controller"
						checked={isDarkTheme}
						onchange={toggleTheme}
					/>
					<Sun class="swap-off h-5 w-5" />
					<Moon class="swap-on h-5 w-5" />
				</label>

				<dialog bind:this={modal} class="modal">
					<div class="modal-box">
						<h3 class="text-lg font-bold">Hello!</h3>
						<p class="py-4">Este es mi dialog</p>
					</div>
					<form method="dialog" class="modal-backdrop">
						<button>close</button>
					</form>
				</dialog>
			</div>
		</nav>
		<main class="flex-1 p-6">
			{@render children()}
		</main>
	</div>

	<div class="drawer-side shadow">
		<!-- Clicking this label closes the sidebar on mobile -->
		<label for="drawer-toggle" aria-label="Close sidebar" class="drawer-overlay"></label>
		<aside class="bg-base-200 text-base-content min-h-full w-80 flex flex-col">
			<LogoHead />
			<div class="p-4 flex-1 overflow-y-auto">
				<ul class="menu rounded-box w-full space-y-2">
					<li><a href="/"><House class="h-4 w-4" /> Inicio</a></li>
					<li class="menu-title">Administración</li>
					<li>
						<details>
							<summary><ChartArea class="h-4 w-4" /> Reportes</summary>
							<ul>
								<li><a href="/dashboard">General</a></li>
							</ul>
						</details>
					</li>
					<li>
						<details>
							<summary><Settings class="h-4 w-4" /> Configuracion</summary>
							<ul>
								<li><a href="/levels">Niveles</a></li>
								<li><a href="/courses">Cursos</a></li>
								<li><a href="/student">Estudiantes</a></li>
							</ul>
						</details>
					</li>
					<li>
						<details>
							<summary><FolderPen class="h-4 w-4" /> Evaluaciones</summary>
							<ul>
								<li><a href="/eval">Registrar</a></li>
								<li><a href="/">Escanear</a></li>
								<li><a href="/">Cargar Datos</a></li>
							</ul>
						</details>
					</li>
					<li>
						<details>
							<summary><Table class="h-4 w-4" /> Resultados</summary>
							<ul>
								<li><a href="/result">Listado</a></li>
								<li><a href="/">Estudiante</a></li>
							</ul>
						</details>
					</li>
					<li class="menu-title">Sistema</li>
					<li><a href="/users"><UserRound class="h-4 w-4" /> Usuarios</a></li>
					<li><a href="/"><Bird class="h-4 w-4" /> Sistema</a></li>
				</ul>
			</div>
			<div class="dropdown dropdown-top dropdown-end w-full p-4">
				<div
					tabindex="0"
					role="button"
					class="bg-base-100 hover:bg-base-300 rounded-box mx-2 mt-0 flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-all"
				>
					{#if page.data.user}
						<div class="avatar">
							<div
								class="w-8 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 bg-base-200"
							>
								{#if userMetadata.photo_url}
									<div class="bg-base-200 mask mask-squircle w-8">
										<img
											src={userMetadata.photo_url}
											alt={`Avatar de ${userMetadata.name} ${userMetadata.last_name}`}
										/>
									</div>
								{:else}
									<div
										class="flex items-center justify-center h-full bg-primary text-primary-content"
									>
										<span class="font-semibold">
											{getInitials(userMetadata.name || '', userMetadata.last_name || '')}
										</span>
									</div>
								{/if}
							</div>
						</div>
						<div class="grow -space-y-0.5">
							<p class="text-sm font-medium">{userMetadata.name} {userMetadata.last_name}</p>
							<p class="text-sm">🟢 En linea</p>
						</div>
						<ChevronsUpDown class="h-4 w-4" />
					{/if}
				</div>
				<ul
					role="menu"
					tabindex="0"
					class="dropdown-content menu bg-base-100 rounded-box shadow-base-content/4 mb-1 w-48 p-1 shadow-[0px_-10px_40px_0px]"
				>
					<li>
						<div><UserCog class="h-4 w-4" /><span>Mi perfil</span></div>
					</li>
					<li>
						<div><Bird class="h-4 w-4" /><span>Sistema</span></div>
					</li>
					<li>
						<form action="/api/logout" method="POST">
							<LogOut class="h-4 w-4" />
							<button type="submit" class="text-left">Cerrar sesión</button>
						</form>
					</li>
				</ul>
			</div>
		</aside>
	</div>
</div>

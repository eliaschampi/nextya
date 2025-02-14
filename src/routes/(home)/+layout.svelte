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
		MessageCircleQuestion,
		Moon,
		Search,
		Settings,
		Sun,
		UserCog,
		UserRound
	} from 'lucide-svelte';
	let { children } = $props();
	let modal: HTMLDialogElement | null = null;

	function openModal() {
		modal?.showModal();
	}
</script>

<div class="drawer lg:drawer-open">
	<input id="drawer-toggle" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content flex flex-col min-h-screen">
		<nav class="navbar bg-base-200 shadow-md px-4">
			<label for="drawer-toggle" class="drawer-button lg:hidden">
				<Menu class="swap-off w-6 h-6" />
			</label>
			<div class="flex-1">
				<a href="/" class="btn btn-ghost normal-case text-xl">Dashboard</a>
			</div>
			<!-- Navbar Icons -->
			<div class="flex items-center gap-1">
				<!-- Search Icon a is not clickable -->
				<button class="btn btn-ghost btn-circle" aria-label="search aria" onclick={openModal}>
					<Search class="w-6 h-6" />
				</button>
				<!-- Notification Icon -->
				<a href="/" class="btn btn-ghost btn-circle" aria-label="notification aria">
					<Bell class="w-6 h-6" />
				</a>
				<!-- Theme Toggle -->
				<label class="swap swap-rotate ml-1">
					<!-- this hidden checkbox controls the state -->
					<input type="checkbox" class="theme-controller" value="light" />

					<!-- sun icon -->
					<Sun class="swap-off h-6 w-6" />

					<!-- moon icon -->
					<Moon class="swap-on h-6 w-6" />
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

	<div class="drawer-side">
		<!-- Clicking this label closes the sidebar on mobile -->
		<label for="drawer-toggle" aria-label="Close sidebar" class="drawer-overlay"></label>
		<aside class="bg-base-200 text-base-content min-h-full w-80 flex flex-col">
			<LogoHead />
			<div class="p-4 flex-1 overflow-y-auto">
				<ul class="menu rounded-box w-full space-y-2">
					<li><a href="/"><House size="16" /> Inicio</a></li>
					<li class="menu-title">Administración</li>
					<li>
						<details>
							<summary><ChartArea size="16" /> Reportes</summary>
							<ul>
								<li><a href="/dashboard">Cursos</a></li>
								<li><a href="/student">Estudiantes</a></li>
							</ul>
						</details>
					</li>
					<li>
						<details>
							<summary><Bird size="16" /> Registros</summary>
							<ul>
								<li><a href="/">Escuelas</a></li>
								<li><a href="/">Grupos</a></li>
								<li><a href="/">Estudiantes</a></li>
							</ul>
						</details>
					</li>
					<li>
						<details>
							<summary><FolderPen size="16" /> Evaluaciones</summary>
							<ul>
								<li><a href="/">Reporte</a></li>
								<li><a href="/">Ajustes</a></li>
							</ul>
						</details>
					</li>
					<li class="menu-title">Sistema</li>
					<li><a href="/"><UserRound size="16" /> Usuarios</a></li>
					<li><a href="/"><Settings size="16" /> Configuración</a></li>
				</ul>
			</div>
			<div class="dropdown dropdown-top dropdown-end w-full p-4">
				<div
					tabindex="0"
					role="button"
					class="bg-base-100 hover:bg-base-300 rounded-box mx-2 mt-0 flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-all"
				>
					<div class="avatar">
						<div class="bg-base-200 mask mask-squircle w-8">
							<img alt="Avatar" src="/avatar.svg" />
						</div>
					</div>
					<div class="grow -space-y-0.5">
						<p class="text-sm font-medium">Elias Champi Hancco</p>
						<p class="text-base-content/60 text-xs">Administrador</p>
					</div>
					<ChevronsUpDown size="16" />
				</div>
				<ul
					role="menu"
					tabindex="0"
					class="dropdown-content menu bg-base-100 rounded-box shadow-base-content/4 mb-1 w-48 p-1 shadow-[0px_-10px_40px_0px]"
				>
					<li>
						<div><UserCog size="16" /><span>Mi perfil</span></div>
					</li>
					<li>
						<div><Settings size="16" /><span>Configuración</span></div>
					</li>
					<li>
						<div><MessageCircleQuestion size="16" /><span>Ayuda</span></div>
					</li>
					<li>
						<form action="/logout" method="POST">
							<LogOut size="16" />
							<button type="submit" class="text-left">Cerrar sesión</button>
						</form>
					</li>
				</ul>
			</div>
		</aside>
	</div>
</div>

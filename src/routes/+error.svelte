<script>
	import { page } from '$app/state';
	import Background from '$lib/components/background.svelte';
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4">
	<Background zIndex="z-[-2]" />
	<div class="card w-full max-w-md bg-base-200 shadow">
		<div class="card-body">
			<h1 class="text-5xl font-bold text-center">
				{page.status === 404 ? '404' : '500'}
			</h1>
			<h2 class="text-2xl text-center mt-2">
				{page.status === 404 ? 'Página no encontrada' : 'Error del servidor'}
			</h2>
			<p class="text-center my-4">
				{page.status === 404
					? 'Lo sentimos, la página que buscas no existe. Serás redirigido a la página principal en 5 segundos.'
					: 'Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo más tarde.'}
			</p>
			<div class="card-actions justify-center">
				<a class="btn btn-primary" href="/"> Volver al inicio </a>
			</div>
		</div>
	</div>
</div>

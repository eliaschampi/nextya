<script>
	import PageTitle from '$lib/components/PageTitle.svelte';
</script>

<PageTitle
	title="Categorias"
	description="Aquí encontrarás todas las categorias disponibles en la aplicación."
>
	<!-- button to add -->
	<button class="btn btn-primary">Añadir</button>
</PageTitle>
<div class="space-y-4 p-4">
	<!-- Productivity Card -->
	<a
		href="/category/productivity"
		class="block rounded-box bg-base-200 p-3 hover:scale-[1.01] transition-transform focus:outline-none focus:ring-2 focus:ring-primary"
	>
		<div class="flex items-center justify-between">
			<div>
				<div class="font-medium text-base-content">Productivity</div>
				<div class="text-sm text-base-content/70">Tools to boost your efficiency</div>
			</div>
			<span class="badge badge-dash badge-secondary">12</span>
		</div>
	</a>

	<!-- Entertainment Card -->
	<a
		href="/category/entertainment"
		class="block rounded-box bg-base-200 p-3 hover:scale-[1.01] transition-transform focus:outline-none focus:ring-2 focus:ring-primary"
	>
		<div class="flex items-center justify-between">
			<div>
				<div class="font-medium text-base-content">Entertainment</div>
				<div class="text-sm text-base-content/70">Games and media apps</div>
			</div>
			<span class="badge badge-dash badge-secondary">8</span>
		</div>
	</a>

	<!-- Education Card -->
	<a
		href="/category/education"
		class="block rounded-box bg-base-200 p-3 hover:scale-[1.01] transition-transform focus:outline-none focus:ring-2 focus:ring-primary"
	>
		<div class="flex items-center justify-between">
			<div>
				<div class="font-medium text-base-content">Education</div>
				<div class="text-sm text-base-content/70">Learning resources and courses</div>
			</div>
			<span class="badge badge-dash badge-secondary">15</span>
		</div>
	</a>
</div>

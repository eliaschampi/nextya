<script lang="ts">
	import {
		Upload,
		Check,
		X,
		AlertCircle,
		Loader2,
		RotateCcw,
		RotateCw,
		ZoomIn,
		ZoomOut,
		Maximize
	} from 'lucide-svelte';

	const {
		imageUrl = '',
		status = 'pending',
		fileIndex = -1,
		totalFiles = 0
	} = $props<{
		imageUrl: string;
		status?: 'pending' | 'processing' | 'success' | 'error' | undefined;
		fileIndex?: number;
		totalFiles?: number;
	}>();

	// Estado para la rotación y zoom
	let rotation = $state(0);
	let zoom = $state(1);
	let imageRef = $state<HTMLImageElement | undefined>(undefined);
	let fullscreen = $state(false);

	// Funciones para rotar la imagen
	function rotateClockwise() {
		rotation = (rotation + 90) % 360;
	}

	function rotateCounterClockwise() {
		rotation = (rotation - 90 + 360) % 360;
	}

	// Funciones para zoom
	function zoomIn() {
		zoom = Math.min(zoom + 0.25, 3);
	}

	function zoomOut() {
		zoom = Math.max(zoom - 0.25, 0.5);
	}

	function resetView() {
		rotation = 0;
		zoom = 1;
	}

	// Función para alternar pantalla completa
	function toggleFullscreen() {
		fullscreen = !fullscreen;
	}

	// Calcular clases y estilos para la imagen
	let imageTransform = $derived(`rotate(${rotation}deg) scale(${zoom})`);
	let imageContainerClass = $derived(
		`relative max-w-full ${fullscreen ? 'max-h-[85vh]' : 'max-h-[65vh]'}`
	);
</script>

<div class="card-body p-4">
	<header class="flex items-center justify-between mb-4 overflow-x-auto">
		<h3 class="card-title">Previsualización</h3>
		{#if imageUrl}
			<div class="flex gap-2">
				<span class="badge badge-success gap-2">
					<Check size={14} />
					{fileIndex + 1}/{totalFiles}
				</span>
				{#if status === 'processing'}
					<span class="badge badge-info gap-1"
						><Loader2 size={12} class="animate-spin" /> Procesando</span
					>
				{:else if status === 'success'}
					<span class="badge badge-success gap-1"><Check size={12} /> Procesado</span>
				{:else if status === 'error'}
					<span class="badge badge-error gap-1"><X size={12} /> Error</span>
				{:else}
					<span class="badge badge-warning gap-1"><AlertCircle size={12} /> Pendiente</span>
				{/if}
			</div>
		{/if}
	</header>

	<!-- Controles de imagen -->
	{#if imageUrl}
		<div class="flex flex-wrap justify-center gap-2 mb-4">
			<div class="join">
				<button
					class="btn btn-sm join-item"
					onclick={rotateCounterClockwise}
					aria-label="Rotar a la izquierda"
				>
					<RotateCcw size={16} />
				</button>
				<button
					class="btn btn-sm join-item"
					onclick={rotateClockwise}
					aria-label="Rotar a la derecha"
				>
					<RotateCw size={16} />
				</button>
			</div>
			<div class="join">
				<button class="btn btn-sm join-item" onclick={zoomOut} aria-label="Reducir zoom">
					<ZoomOut size={16} />
				</button>
				<button class="btn btn-sm join-item" onclick={zoomIn} aria-label="Aumentar zoom">
					<ZoomIn size={16} />
				</button>
			</div>
			<button class="btn btn-sm" onclick={resetView} aria-label="Restablecer vista">
				Restablecer
			</button>
			<button class="btn btn-sm" onclick={toggleFullscreen} aria-label="Pantalla completa">
				<Maximize size={16} />
				{fullscreen ? 'Reducir' : 'Ampliar'}
			</button>
		</div>
	{/if}

	<!-- Contenedor de imagen -->
	<div
		class="relative flex-1 flex items-center justify-center bg-base-100 rounded-lg p-4 min-h-[400px] overflow-hidden"
		class:min-h-[600px]={fullscreen}
	>
		<div class={imageContainerClass}>
			{#if imageUrl}
				<img
					src={imageUrl}
					alt="Previsualización"
					class="max-w-full h-auto object-contain rounded-lg shadow-md transition-transform duration-300"
					style="transform: {imageTransform}"
					bind:this={imageRef}
				/>
			{:else}
				<div class="text-center opacity-50 space-y-4">
					<Upload size={48} class="mx-auto" />
					<p>Selecciona un archivo</p>
				</div>
			{/if}
		</div>
	</div>

	{#if imageUrl}
		<div class="flex justify-center mt-4">
			<div class="badge badge-sm">
				Rotación: {rotation}° | Zoom: {(zoom * 100).toFixed(0)}%
			</div>
		</div>
	{/if}
</div>

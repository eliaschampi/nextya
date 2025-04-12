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
		Save,
		Crop,
		Info
	} from 'lucide-svelte';
	import {
		PAPER_FORMATS,
		checkImageFormat as checkFormat,
		processImageWithCanvas
	} from '$lib/utils/imageUtils';

	const {
		imageUrl = '',
		status = 'pending',
		fileIndex = -1,
		totalFiles = 0,
		onImageSave = undefined
	} = $props<{
		imageUrl: string;
		status?: 'pending' | 'processing' | 'success' | 'error' | undefined;
		fileIndex?: number;
		totalFiles?: number;
		onImageSave?: (processedImageData: string) => void;
	}>();

	// Estado para la rotación y zoom
	let rotation = $state(0);
	let zoom = $state(1);
	let imageRef = $state<HTMLImageElement | undefined>(undefined);
	let isSaving = $state(false);
	let isCropping = $state(false);
	let showFormatInfo = $state(false);

	// Estado para verificación de formato
	let isA5Format = $state(true);
	let imageRatio = $state(0);
	let formatName = $state('');

	// Verificar formato cuando la imagen carga
	function checkImageFormat() {
		if (!imageRef) return;

		// Calcular relación de aspecto actual
		const width = imageRef.naturalWidth;
		const height = imageRef.naturalHeight;
		imageRatio = width / height;

		// Verificar si está en formato A5 vertical
		isA5Format = checkFormat(width, height, PAPER_FORMATS.A5_VERTICAL);

		// Determinar el formato más cercano
		if (isA5Format) {
			formatName = PAPER_FORMATS.A5_VERTICAL.name;
		} else if (checkFormat(width, height, PAPER_FORMATS.A5_HORIZONTAL)) {
			formatName = PAPER_FORMATS.A5_HORIZONTAL.name;
		} else if (checkFormat(width, height, PAPER_FORMATS.A4_VERTICAL)) {
			formatName = PAPER_FORMATS.A4_VERTICAL.name;
		} else if (checkFormat(width, height, PAPER_FORMATS.A4_HORIZONTAL)) {
			formatName = PAPER_FORMATS.A4_HORIZONTAL.name;
		} else {
			formatName = 'Formato personalizado';
		}
	}

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

	// Función para alternar la información de formato
	function toggleFormatInfo() {
		showFormatInfo = !showFormatInfo;
	}

	// Función para recortar a formato A5 vertical
	async function cropToA5() {
		if (!imageRef || !imageUrl) return;

		try {
			isCropping = true;

			// Usar la utilidad para procesar la imagen
			const croppedImageData = processImageWithCanvas(imageRef, {
				crop: {
					targetRatio: PAPER_FORMATS.A5_VERTICAL.ratio
				},
				quality: 0.95
			});

			// Llamar al callback si existe
			if (onImageSave) {
				onImageSave(croppedImageData);
			}

			// Actualizar estado
			isA5Format = true;
			formatName = PAPER_FORMATS.A5_VERTICAL.name;

			return croppedImageData;
		} catch (error) {
			console.error('Error al recortar la imagen:', error);
		} finally {
			isCropping = false;
		}
	}

	// Función para guardar la imagen rotada
	async function saveRotatedImage() {
		if (!imageRef || !imageUrl || rotation === 0) return;

		try {
			isSaving = true;

			// Usar la utilidad para procesar la imagen
			const rotatedImageData = processImageWithCanvas(imageRef, {
				rotation,
				quality: 0.95
			});

			// Llamar al callback si existe
			if (onImageSave) {
				onImageSave(rotatedImageData);
			}

			// Resetear la rotación ya que ahora la imagen está rotada
			rotation = 0;

			return rotatedImageData;
		} catch (error) {
			console.error('Error al guardar la imagen rotada:', error);
		} finally {
			isSaving = false;
		}
	}

	// Calcular clases y estilos para la imagen
	let imageTransform = $derived(`rotate(${rotation}deg) scale(${zoom})`);
	let imageContainerClass = $derived(`relative w-full max-h-[65vh]`);
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

			{#if rotation !== 0}
				<button
					class="btn btn-sm btn-success gap-2"
					onclick={saveRotatedImage}
					aria-label="Guardar cambios"
					disabled={isSaving}
				>
					{#if isSaving}
						<Loader2 size={16} class="animate-spin" />
						Guardando...
					{:else}
						<Save size={16} />
						Guardar cambios
					{/if}
				</button>
			{/if}

			{#if !isA5Format}
				<button
					class="btn btn-sm btn-warning gap-2"
					onclick={cropToA5}
					aria-label="Recortar a A5"
					disabled={isCropping}
				>
					{#if isCropping}
						<Loader2 size={16} class="animate-spin" />
						Recortando...
					{:else}
						<Crop size={16} />
						Recortar a A5
					{/if}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Contenedor de imagen -->
	<div
		class="relative flex-1 flex items-center justify-center bg-base-100 rounded-lg p-4 min-h-[400px] overflow-auto"
	>
		<div class={imageContainerClass}>
			{#if imageUrl}
				<img
					src={imageUrl}
					alt="Previsualización"
					class="w-full h-auto object-contain rounded-lg shadow-md transition-transform duration-300 mx-auto"
					style="transform: {imageTransform}"
					bind:this={imageRef}
					onload={checkImageFormat}
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
		<div class="flex justify-center mt-4 gap-2">
			<div class="badge badge-sm">
				Rotación: {rotation}° | Zoom: {(zoom * 100).toFixed(0)}%
			</div>
			{#if !isA5Format}
				<button
					class="badge badge-sm badge-warning gap-1 cursor-pointer"
					onclick={toggleFormatInfo}
					onkeydown={(e) => e.key === 'Enter' && toggleFormatInfo()}
					tabindex="0"
					aria-label="Mostrar información de formato"
				>
					<Info size={12} />
					Formato no A5 ({formatName})
				</button>
			{/if}

			{#if showFormatInfo}
				<div
					class="tooltip tooltip-open tooltip-warning"
					data-tip="Se requiere formato A5 vertical para procesamiento OMR"
				>
					<span class="badge badge-sm badge-outline">
						Relación: {(imageRatio * 100).toFixed(0)}%
					</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

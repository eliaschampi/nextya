<script lang="ts">
	import {
		Upload,
		Check,
		X,
		AlertCircle,
		Loader2,
		RotateCcw,
		RotateCw,
		Save,
		Crop,
		Info,
		FlipHorizontal,
		FlipVertical,
		Move,
		ZoomIn,
		ZoomOut
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

	// Estado para transformaciones
	let rotation = $state(0);
	let flipX = $state(false);
	let flipY = $state(false);
	let cropData = $state<{ x: number; y: number; width: number; height: number } | null>(null);
	let imageRef = $state<HTMLImageElement | undefined>(undefined);
	let displayedImageUrl = $state(imageUrl);
	let isProcessing = $state(false);
	let cropMode = $state(false);
	let zoomLevel = $state(1);
	let isDraggingCrop = $state(false);
	let dragStart = $state<{ x: number; y: number } | null>(null);
	const MIN_ZOOM = 0.5;
	const MAX_ZOOM = 1.5;
	const ZOOM_STEP = 0.02;

	// Estado para verificación de formato
	let isA5Format = $state(true);
	let formatName = $state('');

	$effect(() => {
		displayedImageUrl = imageUrl;
		// Reiniciar transformaciones cuando cambia la imagen
		if (imageUrl) {
			resetView();
		}
	});

	function checkImageFormat() {
		if (!imageRef) return;
		const width = imageRef.naturalWidth;
		const height = imageRef.naturalHeight;
		isA5Format = checkFormat(width, height, PAPER_FORMATS.A5_VERTICAL);
		formatName = isA5Format ? PAPER_FORMATS.A5_VERTICAL.name : 'Formato no A5';
	}

	// Funciones de transformación
	function rotateClockwise() {
		rotation = (rotation + 90) % 360;
		exitCropMode();
	}
	function rotateCounterClockwise() {
		rotation = (rotation - 90 + 360) % 360;
		exitCropMode();
	}
	function flipHorizontal() {
		flipX = !flipX;
		exitCropMode();
	}
	function flipVertical() {
		flipY = !flipY;
		exitCropMode();
	}
	function resetView() {
		rotation = 0;
		flipX = false;
		flipY = false;
		cropData = null;
		exitCropMode();
		zoomLevel = 1;
		// No resetear displayedImageUrl, solo mantener la imagen actual sin transformaciones
	}

	// Modo recorte
	function toggleCropMode() {
		cropMode = !cropMode;
		if (cropMode) {
			zoomLevel = 1;
			resetCropPreview();
		}
	}
	function exitCropMode() {
		cropMode = false;
		zoomLevel = 1;
		// No eliminamos cropData para mantener el último recorte
	}

	// Zoom
	function zoomIn() {
		if (zoomLevel < MAX_ZOOM) zoomLevel = Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP);
	}
	function zoomOut() {
		if (zoomLevel > MIN_ZOOM) zoomLevel = Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP);
	}

	// Guardar transformaciones
	async function saveProcessedImage() {
		if (!imageRef || !displayedImageUrl) return;
		try {
			isProcessing = true;
			const transformations = {
				rotation,
				flip: { horizontal: flipX, vertical: flipY },
				zoom: cropMode ? zoomLevel : 1,
				crop: cropData ? { ...cropData, targetRatio: PAPER_FORMATS.A5_VERTICAL.ratio } : undefined,
				quality: 0.95
			};
			const processedImageData = processImageWithCanvas(imageRef, transformations);
			// Actualizar la imagen mostrada con la versión procesada
			displayedImageUrl = processedImageData;

			// Reiniciar todas las transformaciones ya que ahora están aplicadas a la imagen
			rotation = 0;
			flipX = false;
			flipY = false;
			cropData = null;
			exitCropMode();

			// Enviar la imagen procesada si hay un callback
			if (onImageSave) onImageSave(processedImageData);
		} catch (error) {
			console.error('Error al procesar la imagen:', error);
		} finally {
			isProcessing = false;
		}
	}

	// Vista previa de recorte
	function resetCropPreview() {
		if (!imageRef) return;
		const imgRect = imageRef.getBoundingClientRect();
		const targetRatio = PAPER_FORMATS.A5_VERTICAL.ratio;
		let width, height;
		if (imgRect.width / imgRect.height > targetRatio) {
			height = imgRect.height * 0.9;
			width = height * targetRatio;
		} else {
			width = imgRect.width * 0.9;
			height = width / targetRatio;
		}
		cropData = {
			x: Math.floor((imgRect.width - width) / 2),
			y: Math.floor((imgRect.height - height) / 2),
			width: Math.floor(width),
			height: Math.floor(height)
		};
	}

	// Manejo de arrastre del marco de recorte
	function startDragCrop(clientX: number, clientY: number) {
		if (!imageRef || !cropMode || !cropData) return;
		isDraggingCrop = true;
		const rect = imageRef.getBoundingClientRect();
		dragStart = {
			x: clientX - rect.left - cropData.x,
			y: clientY - rect.top - cropData.y
		};
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
		document.addEventListener('touchmove', handleTouchMove, { passive: false });
		document.addEventListener('touchend', handleTouchEnd);
	}

	function handleMouseMove(e: MouseEvent) {
		moveDragCrop(e.clientX, e.clientY);
	}
	function handleTouchMove(e: TouchEvent) {
		e.preventDefault();
		if (e.touches[0]) moveDragCrop(e.touches[0].clientX, e.touches[0].clientY);
	}
	function handleMouseUp() {
		endDragCrop();
	}
	function handleTouchEnd() {
		endDragCrop();
	}

	function moveDragCrop(clientX: number, clientY: number) {
		if (!isDraggingCrop || !dragStart || !imageRef || !cropData) return;
		const rect = imageRef.getBoundingClientRect();
		let newX = Math.floor(clientX - rect.left - dragStart.x);
		let newY = Math.floor(clientY - rect.top - dragStart.y);

		// Asegurar que el recorte no salga de los límites de la imagen
		newX = Math.max(0, Math.min(rect.width - cropData.width, newX));
		newY = Math.max(0, Math.min(rect.height - cropData.height, newY));

		cropData = { ...cropData, x: newX, y: newY };
	}

	function endDragCrop() {
		isDraggingCrop = false;
		dragStart = null;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
		document.removeEventListener('touchmove', handleTouchMove);
		document.removeEventListener('touchend', handleTouchEnd);
	}

	// Transformaciones calculadas
	let imageTransform = $derived(
		`rotate(${rotation}deg) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`
	);
	let imageTransformWithZoom = $derived(`${imageTransform} scale(${zoomLevel})`);
	let hasTransformations = $derived(rotation !== 0 || flipX || flipY || cropData !== null);
</script>

<div class="card-body p-4">
	<header class="flex items-center justify-between mb-4 overflow-x-auto">
		<h3 class="card-title">Previsualización</h3>
		{#if displayedImageUrl}
			<div class="flex gap-2">
				<span class="badge badge-success gap-2"
					><Check size={14} /> {fileIndex + 1}/{totalFiles}</span
				>
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

	{#if displayedImageUrl}
		<div class="flex flex-wrap justify-center gap-2 mb-4">
			{#if !cropMode}
				<div class="join">
					<button class="btn btn-sm join-item" onclick={rotateCounterClockwise}>
						<RotateCcw size={16} />
					</button>
					<button class="btn btn-sm join-item" onclick={rotateClockwise}>
						<RotateCw size={16} />
					</button>
				</div>
				<div class="join">
					<button class="btn btn-sm join-item" class:btn-accent={flipX} onclick={flipHorizontal}>
						<FlipHorizontal size={16} />
					</button>
					<button class="btn btn-sm join-item" class:btn-accent={flipY} onclick={flipVertical}>
						<FlipVertical size={16} />
					</button>
				</div>
				<button class="btn btn-sm" onclick={resetView}>Restablecer</button>
			{/if}
			<button
				class="btn btn-sm btn-primary gap-2 {cropMode && 'btn-error'}"
				onclick={toggleCropMode}
			>
				<Crop size={16} />
				{cropMode ? 'Cancelar' : 'Recortar'}
			</button>
			{#if cropMode}
				<div class="join">
					<button class="btn btn-sm join-item" onclick={zoomOut} disabled={zoomLevel <= MIN_ZOOM}>
						<ZoomOut size={16} />
					</button>
					<span class="btn btn-sm join-item no-animation cursor-default">
						{Math.round(zoomLevel * 100)}%
					</span>
					<button class="btn btn-sm join-item" onclick={zoomIn} disabled={zoomLevel >= MAX_ZOOM}>
						<ZoomIn size={16} />
					</button>
				</div>
				<button
					class="btn btn-sm btn-success gap-2"
					onclick={saveProcessedImage}
					disabled={isProcessing}
				>
					{#if isProcessing}
						<Loader2 size={16} class="animate-spin" /> Procesando...
					{:else}
						<Save size={16} /> Aplicar
					{/if}
				</button>
			{/if}
			{#if hasTransformations && !cropMode}
				<button
					class="btn btn-sm btn-success gap-2"
					onclick={saveProcessedImage}
					disabled={isProcessing}
				>
					{#if isProcessing}
						<Loader2 size={16} class="animate-spin" /> Guardando...
					{:else}
						<Save size={16} /> Guardar
					{/if}
				</button>
			{/if}
		</div>
	{/if}
	<div
		class="relative flex-1 flex items-center justify-center bg-base-100 rounded-lg p-4 min-h-[400px] overflow-auto"
	>
		{#if displayedImageUrl}
			<div class="relative inline-block">
				<img
					src={displayedImageUrl}
					alt="Previsualización"
					class="w-auto h-auto max-w-full max-h-[65vh] object-contain rounded-lg shadow-md transition-transform duration-200 select-none"
					style="transform: {cropMode
						? imageTransformWithZoom
						: imageTransform}; transform-origin: center center;"
					bind:this={imageRef}
					onload={checkImageFormat}
				/>
				{#if cropMode && cropData}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="absolute pointer-events-auto"
						style="left: {cropData.x}px; top: {cropData.y}px; width: {cropData.width}px; height: {cropData.height}px; border: 2px dashed #3b82f6; background-color: rgba(255, 255, 255, 0.2); cursor: move; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5); z-index: 10;"
						onmousedown={(e) => startDragCrop(e.clientX, e.clientY)}
						ontouchstart={(e) => {
							e.preventDefault();
							if (e.touches[0]) startDragCrop(e.touches[0].clientX, e.touches[0].clientY);
						}}
					>
						<div
							class="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white"
						>
							<Move size={16} />
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="text-center opacity-50 space-y-4">
				<Upload size={48} class="mx-auto" />
				<p>Selecciona un archivo</p>
			</div>
		{/if}
	</div>

	{#if displayedImageUrl}
		<div class="flex justify-center mt-4 gap-2 flex-wrap">
			{#if cropMode}
				<div class="badge badge-sm badge-info">Formato objetivo: A5 vertical</div>
				{#if zoomLevel !== 1}
					<div class="badge badge-sm badge-outline">Zoom: {Math.round(zoomLevel * 100)}%</div>
				{/if}
			{:else}
				<div class="badge badge-sm">
					Rotación: {rotation}°
					{#if flipX || flipY}
						| Volteo: {flipX ? 'Horizontal' : ''}{flipX && flipY ? ' y ' : ''}{flipY
							? 'Vertical'
							: ''}
					{/if}
				</div>
				{#if !isA5Format}
					<div class="badge badge-sm badge-warning gap-1">
						<Info size={12} /> Formato no A5 ({formatName})
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

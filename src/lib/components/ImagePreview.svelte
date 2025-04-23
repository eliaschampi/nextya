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
	import { PAPER_FORMATS, processImageWithCanvas } from '$lib/utils/imageUtils';
	import type { ApiOmrErrorData } from '$lib/types/api';

	// Props
	const {
		imageUrl = '',
		status = 'pending',
		fileIndex = -1,
		totalFiles = 0,
		isA5Format = true,
		error = undefined,
		onImageSave = undefined
	} = $props<{
		imageUrl: string;
		status?: 'pending' | 'processing' | 'success' | 'error' | undefined;
		fileIndex?: number;
		error: ApiOmrErrorData | undefined | null;
		totalFiles?: number;
		isA5Format?: boolean;
		formatName?: string;
		onImageSave?: (processedImageData: string) => void;
	}>();

	// State
	let rotation = $state(0);
	let flipX = $state(false);
	let flipY = $state(false);
	let cropData = $state<{
		x: number;
		y: number;
		width: number;
		height: number;
		targetRatio?: number;
	} | null>(null);
	let imageRef = $state<HTMLImageElement>();
	let displayedImageUrl = $state(imageUrl);
	let isProcessing = $state(false);
	let cropMode = $state(false);
	let zoomLevel = $state(1);
	let isDraggingCrop = $state(false);
	let dragStart = $state<{ x: number; y: number } | null>(null);

	const MIN_ZOOM = 0.5;
	const MAX_ZOOM = 1.5;
	const ZOOM_STEP = 0.1;

	// Reset transformations when imageUrl changes
	$effect(() => {
		displayedImageUrl = imageUrl;
		if (imageUrl) resetView();
	});

	// Transformation functions
	function rotateClockwise() {
		rotation = (rotation + 90) % 360;
		if (cropMode) exitCropMode();
	}

	function rotateCounterClockwise() {
		rotation = (rotation - 90 + 360) % 360;
		if (cropMode) exitCropMode();
	}

	function flipHorizontal() {
		flipX = !flipX;
		if (cropMode) exitCropMode();
	}

	function flipVertical() {
		flipY = !flipY;
		if (cropMode) exitCropMode();
	}

	function resetView() {
		rotation = 0;
		flipX = false;
		flipY = false;
		cropData = null;
		cropMode = false;
		zoomLevel = 1;
	}

	// Crop mode functions
	function toggleCropMode() {
		cropMode = !cropMode;
		if (cropMode) resetCropPreview();
		else zoomLevel = 1;
	}

	function exitCropMode() {
		cropMode = false;
		zoomLevel = 1;
	}

	// Zoom functions (only in crop mode)
	function zoomIn() {
		if (cropMode && zoomLevel < MAX_ZOOM && cropData && imageRef) {
			const oldZoom = zoomLevel;
			const newZoom = Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP);

			// Actualizar el nivel de zoom
			zoomLevel = newZoom;

			// Ajustar el área de recorte para mantenerla centrada
			adjustCropAreaForZoom(oldZoom, newZoom);
		}
	}

	function zoomOut() {
		if (cropMode && zoomLevel > MIN_ZOOM && cropData && imageRef) {
			const oldZoom = zoomLevel;
			const newZoom = Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP);

			// Actualizar el nivel de zoom
			zoomLevel = newZoom;

			// Ajustar el área de recorte para mantenerla centrada
			adjustCropAreaForZoom(oldZoom, newZoom);
		}
	}

	// Ajusta el área de recorte cuando cambia el zoom
	function adjustCropAreaForZoom(oldZoom: number, newZoom: number) {
		if (!cropData || !imageRef) return;

		const rect = imageRef.getBoundingClientRect();
		const imgCenterX = rect.width / 2;
		const imgCenterY = rect.height / 2;

		// Calcular el centro del área de recorte
		const cropCenterX = cropData.x + cropData.width / 2;
		const cropCenterY = cropData.y + cropData.height / 2;

		// Calcular la distancia desde el centro de la imagen al centro del recorte
		const deltaX = cropCenterX - imgCenterX;
		const deltaY = cropCenterY - imgCenterY;

		// Ajustar la distancia según el cambio de zoom
		const zoomRatio = newZoom / oldZoom;
		const newDeltaX = deltaX * zoomRatio;
		const newDeltaY = deltaY * zoomRatio;

		// Calcular el nuevo tamaño del área de recorte
		const newWidth = cropData.width * zoomRatio;
		const newHeight = cropData.height * zoomRatio;

		// Calcular la nueva posición del área de recorte
		const newX = imgCenterX + newDeltaX - newWidth / 2;
		const newY = imgCenterY + newDeltaY - newHeight / 2;

		// Actualizar el área de recorte
		cropData = {
			...cropData,
			x: Math.floor(newX),
			y: Math.floor(newY),
			width: Math.floor(newWidth),
			height: Math.floor(newHeight)
		};

		console.log('Zoom adjusted crop:', {
			oldZoom,
			newZoom,
			zoomRatio,
			imgCenter: { x: imgCenterX, y: imgCenterY },
			cropCenter: { x: cropCenterX, y: cropCenterY },
			delta: { x: deltaX, y: deltaY },
			newDelta: { x: newDeltaX, y: newDeltaY },
			newCrop: { x: newX, y: newY, width: newWidth, height: newHeight }
		});
	}

	// Save processed image
	async function saveProcessedImage() {
		if (!imageRef || !displayedImageUrl) return;

		isProcessing = true;
		try {
			// Obtener el contenedor para acceder al desplazamiento
			const container = imageRef.parentElement;
			if (!container) throw new Error('No se encontró el contenedor de la imagen');

			// Dimensiones naturales de la imagen
			const naturalWidth = imageRef.naturalWidth;
			const naturalHeight = imageRef.naturalHeight;

			// Ya no necesitamos el desplazamiento del contenedor
			// porque usamos posiciones relativas al centro de la imagen

			const options: {
				rotation?: number;
				flip?: { horizontal?: boolean; vertical?: boolean };
				crop?: { x?: number; y?: number; width?: number; height?: number; targetRatio: number };
				quality?: number;
			} = { quality: 0.95 };

			if (rotation !== 0) options.rotation = rotation;
			if (flipX || flipY) options.flip = { horizontal: flipX, vertical: flipY };

			if (cropMode && cropData) {
				// Obtener las dimensiones del contenedor y la imagen
				const rect = imageRef.getBoundingClientRect();

				// Calcular el centro de la imagen y del área de recorte
				const imgCenterX = rect.width / 2;
				const imgCenterY = rect.height / 2;
				const cropCenterX = cropData.x + cropData.width / 2;
				const cropCenterY = cropData.y + cropData.height / 2;

				// Calcular la posición relativa del centro del recorte respecto al centro de la imagen
				// Esto nos da la posición normalizada (de -1 a 1) desde el centro
				const relativeX = (cropCenterX - imgCenterX) / (rect.width / 2);
				const relativeY = (cropCenterY - imgCenterY) / (rect.height / 2);

				// Calcular el tamaño relativo del recorte respecto al tamaño de la imagen
				// Esto nos da el tamaño normalizado (de 0 a 1) respecto al tamaño total
				const relativeWidth = cropData.width / rect.width;
				const relativeHeight = cropData.height / rect.height;

				// Convertir estas posiciones relativas a coordenadas en la imagen original
				const naturalCenterX = naturalWidth / 2 + (naturalWidth / 2) * relativeX;
				const naturalCenterY = naturalHeight / 2 + (naturalHeight / 2) * relativeY;
				const naturalCropWidth = naturalWidth * relativeWidth;
				const naturalCropHeight = naturalHeight * relativeHeight;

				// Calcular las coordenadas de la esquina superior izquierda
				let cropX = Math.floor(naturalCenterX - naturalCropWidth / 2);
				let cropY = Math.floor(naturalCenterY - naturalCropHeight / 2);
				let cropWidth = Math.floor(naturalCropWidth);
				let cropHeight = Math.floor(naturalCropHeight);

				// Asegurarse de que las coordenadas estén dentro de los límites de la imagen
				cropX = Math.max(0, Math.min(naturalWidth - 1, cropX));
				cropY = Math.max(0, Math.min(naturalHeight - 1, cropY));

				// Limitar el ancho y alto al tamaño disponible de la imagen
				cropWidth = Math.max(1, Math.min(naturalWidth - cropX, cropWidth));
				cropHeight = Math.max(1, Math.min(naturalHeight - cropY, cropHeight));

				// Asegurar que se mantiene la proporción A5 correcta
				const targetRatio = PAPER_FORMATS.A5_VERTICAL.ratio;
				const currentRatio = cropWidth / cropHeight;

				// Ajustar dimensiones para mantener la proporción si es necesario
				if (Math.abs(currentRatio - targetRatio) > 0.01) {
					if (currentRatio > targetRatio) {
						// Demasiado ancho, ajustar el ancho
						cropWidth = Math.floor(cropHeight * targetRatio);
					} else {
						// Demasiado alto, ajustar el alto
						cropHeight = Math.floor(cropWidth / targetRatio);
					}
				}

				console.log('Crop dimensions:', {
					original: {
						x: cropData.x,
						y: cropData.y,
						width: cropData.width,
						height: cropData.height,
						ratio: cropData.width / cropData.height
					},
					relative: {
						centerX: relativeX,
						centerY: relativeY,
						width: relativeWidth,
						height: relativeHeight
					},
					natural: {
						centerX: naturalCenterX,
						centerY: naturalCenterY,
						x: cropX,
						y: cropY,
						width: cropWidth,
						height: cropHeight,
						ratio: cropWidth / cropHeight
					},
					targetRatio,
					zoom: zoomLevel
				});

				options.crop = {
					x: cropX,
					y: cropY,
					width: cropWidth,
					height: cropHeight,
					targetRatio: PAPER_FORMATS.A5_VERTICAL.ratio
				};
			} else {
				// Sin recorte manual, aplicar proporción A5
				options.crop = { targetRatio: PAPER_FORMATS.A5_VERTICAL.ratio };
			}

			const processedImageData = processImageWithCanvas(imageRef, options);
			displayedImageUrl = processedImageData;
			resetView();
			if (onImageSave) onImageSave(processedImageData);
		} catch (error) {
			console.error('Error al procesar la imagen:', error);
		} finally {
			isProcessing = false;
		}
	}

	// Crop preview initialization
	function resetCropPreview() {
		if (!imageRef) return;
		const imgRect = imageRef.getBoundingClientRect();
		const targetRatio = PAPER_FORMATS.A5_VERTICAL.ratio;
		let width: number, height: number;

		// Calcular dimensiones para mantener la proporción A5
		if (imgRect.width / imgRect.height > targetRatio) {
			// La imagen es más ancha que la proporción A5, ajustar por altura
			height = imgRect.height * 0.9;
			width = height * targetRatio;
		} else {
			// La imagen es más alta que la proporción A5, ajustar por ancho
			width = imgRect.width * 0.9;
			height = width / targetRatio;
		}

		// Asegurarse de que las dimensiones sean enteras
		width = Math.floor(width);
		height = Math.floor(height);

		// Centrar el recorte en la imagen
		const x = Math.floor((imgRect.width - width) / 2);
		const y = Math.floor((imgRect.height - height) / 2);

		console.log('Initial crop setup:', {
			imgDimensions: {
				width: imgRect.width,
				height: imgRect.height,
				ratio: imgRect.width / imgRect.height
			},
			cropDimensions: { width, height, ratio: width / height },
			targetRatio,
			position: { x, y }
		});

		cropData = {
			x,
			y,
			width,
			height,
			targetRatio
		};
	}

	// Crop dragging handlers
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

	function moveDragCrop(clientX: number, clientY: number) {
		if (!isDraggingCrop || !dragStart || !imageRef || !cropData) return;
		const rect = imageRef.getBoundingClientRect();
		let newX = Math.floor(clientX - rect.left - dragStart.x);
		let newY = Math.floor(clientY - rect.top - dragStart.y);

		newX = Math.max(0, Math.min(rect.width - cropData.width, newX));
		newY = Math.max(0, Math.min(rect.height - cropData.height, newY));

		cropData = {
			...cropData,
			x: newX,
			y: newY
		};
	}

	function handleMouseUp() {
		endDragCrop();
	}

	function handleTouchEnd() {
		endDragCrop();
	}

	function endDragCrop() {
		isDraggingCrop = false;
		dragStart = null;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
		document.removeEventListener('touchmove', handleTouchMove);
		document.removeEventListener('touchend', handleTouchEnd);
	}

	// Derived transformations
	const imageTransform = $derived(
		`rotate(${rotation}deg) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`
	);
	const imageTransformWithZoom = $derived(`${imageTransform} scale(${zoomLevel})`);
	const hasTransformations = $derived(rotation !== 0 || flipX || flipY || cropMode);
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
					<button class="btn btn-sm join-item" onclick={rotateCounterClockwise}
						><RotateCcw size={16} /></button
					>
					<button class="btn btn-sm join-item" onclick={rotateClockwise}
						><RotateCw size={16} /></button
					>
				</div>
				<div class="join">
					<button class="btn btn-sm join-item" class:btn-accent={flipX} onclick={flipHorizontal}
						><FlipHorizontal size={16} /></button
					>
					<button class="btn btn-sm join-item" class:btn-accent={flipY} onclick={flipVertical}
						><FlipVertical size={16} /></button
					>
				</div>
				<button class="btn btn-sm" onclick={resetView}>Restablecer</button>
			{/if}
			<button
				class="btn btn-sm btn-primary gap-2 {cropMode ? 'btn-error' : ''}"
				onclick={toggleCropMode}
			>
				<Crop size={16} />
				{cropMode ? 'Cancelar' : 'Recortar'}
			</button>
			{#if cropMode}
				<div class="join">
					<button class="btn btn-sm join-item" onclick={zoomOut} disabled={zoomLevel <= MIN_ZOOM}
						><ZoomOut size={16} /></button
					>
					<span class="btn btn-sm join-item no-animation cursor-default"
						>{Math.round(zoomLevel * 100)}%</span
					>
					<button class="btn btn-sm join-item" onclick={zoomIn} disabled={zoomLevel >= MAX_ZOOM}
						><ZoomIn size={16} /></button
					>
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
			{:else if hasTransformations}
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
						: imageTransform}; transform-origin: center;"
					bind:this={imageRef}
				/>
				{#if cropMode && cropData}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="absolute pointer-events-auto"
						style="left: {cropData.x}px; top: {cropData.y}px; width: {cropData.width}px; height: {cropData.height}px; border: 2px dashed #3b82f6; background: rgba(255, 255, 255, 0.2); cursor: move; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5); z-index: 10;"
						onmousedown={(e) => startDragCrop(e.clientX, e.clientY)}
						ontouchstart={(e) =>
							e.touches[0] && startDragCrop(e.touches[0].clientX, e.touches[0].clientY)}
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
				{#if !isA5Format || error}
					<div class="badge badge-sm badge-warning gap-1">
						<Info size={12} />
						{error?.message || 'Formato no reconocido'}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

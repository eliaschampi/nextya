<script lang="ts">
	import {
		RotateCcw,
		RotateCw,
		FlipHorizontal,
		FlipVertical,
		ZoomIn,
		ZoomOut,
		RefreshCcw,
		X,
		AlertCircle,
		Crop,
		Loader2,
		Save
	} from 'lucide-svelte';
	import { processImageWithCanvas } from '$lib/utils/imageUtils';
	import type { ApiOmrErrorData } from '$lib/types/api';

	// Props
	const {
		imageUrl = '',
		status = 'pending',
		fileIndex = -1,
		totalFiles = 0,
		error,
		onImageSave
	} = $props<{
		imageUrl: string;
		status?: 'pending' | 'processing' | 'success' | 'error';
		fileIndex?: number;
		totalFiles?: number;
		error?: ApiOmrErrorData | null | undefined;
		onImageSave: (processedImageData: string) => void;
	}>();

	// Constants
	const A5_RATIO = 1 / 1.414; // A5 vertical ratio
	const ZOOM_MIN = 1;
	const ZOOM_MAX = 3;
	const ZOOM_STEP = 0.05;

	// State
	let containerRef = $state<HTMLDivElement>();
	let baseImageUrl = $state(imageUrl); // Base for processing
	let displayedImageUrl = $state(imageUrl); // Displayed image
	let naturalWidth = $state(0);
	let naturalHeight = $state(0);
	let pendingOperation = $state<'rotate' | 'flip' | 'crop' | null>(null);
	let rotation = $state<0 | 90 | 180 | 270>(0);
	let flipX = $state(false);
	let flipY = $state(false);
	let cropMode = $state(false);
	let zoomLevel = $state(1);
	let cropFrame = $state<{ x: number; y: number; w: number; h: number } | null>(null);
	let dragging = $state(false);
	let dragOffset = $state<{ x: number; y: number } | null>(null);
	let processing = $state(false);
	let localError = $state<string | null>(null);

	// Effects
	$effect(() => {
		if (imageUrl !== baseImageUrl) {
			baseImageUrl = imageUrl;
			displayedImageUrl = imageUrl;
			resetState();
			loadDimensions(imageUrl);
		}
	});

	$effect(() => {
		if (baseImageUrl) loadDimensions(baseImageUrl);
	});

	$effect(() => {
		if (cropMode && containerRef && naturalWidth && naturalHeight) {
			initCropFrame();
		} else if (!cropMode) {
			cropFrame = null;
			zoomLevel = 1;
		}
	});

	// Helpers
	async function loadDimensions(src: string) {
		if (!src) return (naturalWidth = naturalHeight = 0);
		const img = new Image();
		img.src = src;
		await new Promise((resolve, reject) => {
			img.onload = () => {
				naturalWidth = img.naturalWidth;
				naturalHeight = img.naturalHeight;
				resolve(true);
			};
			img.onerror = () => {
				naturalWidth = naturalHeight = 0;
				localError = 'Error al cargar dimensiones';
				reject();
			};
		});
	}

	function resetState() {
		pendingOperation = null;
		rotation = 0;
		flipX = flipY = false;
		cropMode = false;
		zoomLevel = 1;
		cropFrame = null;
		dragging = false;
		dragOffset = null;
		localError = null;
	}

	function revert() {
		if (processing) return;
		baseImageUrl = displayedImageUrl = imageUrl;
		resetState();
	}

	// Operations
	function rotate(clockwise: boolean) {
		if (cropMode || processing) return;
		localError = null;
		rotation = ((rotation + (clockwise ? 90 : -90) + 360) % 360) as 0 | 90 | 180 | 270;
		pendingOperation = rotation === 0 ? null : 'rotate';
		flipX = flipY = false;
		displayedImageUrl = baseImageUrl;
	}

	function flip(horizontal: boolean) {
		if (cropMode || processing) return;
		localError = null;
		if (horizontal) {
			flipX = !flipX;
			flipY = false;
		} else {
			flipY = !flipY;
			flipX = false;
		}
		pendingOperation = flipX || flipY ? 'flip' : null;
		rotation = 0;
		displayedImageUrl = baseImageUrl;
	}

	function toggleCrop() {
		if (processing) return;
		localError = null;
		cropMode = !cropMode;
		if (cropMode) {
			pendingOperation = 'crop';
			rotation = 0;
			flipX = flipY = false;
		} else {
			pendingOperation = null;
		}
	}

	// Crop Functions
	function initCropFrame() {
		if (!containerRef) return;
		const rect = containerRef.getBoundingClientRect();
		const padding = 32;
		const maxW = rect.width - padding;
		const maxH = rect.height - padding;
		let w = maxW * 0.9;
		let h = w / A5_RATIO;
		if (h > maxH * 0.9) {
			h = maxH * 0.9;
			w = h * A5_RATIO;
		}
		const x = (rect.width - w) / 2;
		const y = (rect.height - h) / 2;
		cropFrame = { x, y, w, h };
	}

	function zoom(direction: 'in' | 'out') {
		if (!cropMode || processing) return;
		localError = null;
		zoomLevel = Math.min(
			ZOOM_MAX,
			Math.max(ZOOM_MIN, zoomLevel + (direction === 'in' ? ZOOM_STEP : -ZOOM_STEP))
		);
	}

	function startDrag(event: MouseEvent) {
		if (!cropMode || !cropFrame || processing || !containerRef) return;
		event.preventDefault();
		dragging = true;
		const rect = containerRef.getBoundingClientRect();
		dragOffset = {
			x: event.clientX - rect.left - cropFrame.x,
			y: event.clientY - rect.top - cropFrame.y
		};
	}

	function moveDrag(event: MouseEvent) {
		if (!dragging || !dragOffset || !cropFrame || !containerRef) return;
		const rect = containerRef.getBoundingClientRect();
		let x = event.clientX - rect.left - dragOffset.x;
		let y = event.clientY - rect.top - dragOffset.y;
		x = Math.max(0, Math.min(rect.width - cropFrame.w, x));
		y = Math.max(0, Math.min(rect.height - cropFrame.h, y));
		cropFrame = { ...cropFrame, x, y };
	}

	function endDrag() {
		dragging = false;
		dragOffset = null;
	}

	function calculateCrop() {
		if (!cropFrame || !containerRef || !naturalWidth || !naturalHeight) return null;
		const rect = containerRef.getBoundingClientRect();
		const imgRatio = naturalWidth / naturalHeight;
		const containerRatio = rect.width / rect.height;
		const [imgW, imgH] =
			imgRatio > containerRatio
				? [rect.width, rect.width / imgRatio]
				: [rect.height * imgRatio, rect.height];
		const imgX = (rect.width - imgW) / 2;
		const imgY = (rect.height - imgH) / 2;
		const scale = naturalWidth / imgW;

		const originX = imgX + imgW / 2;
		const originY = imgY + imgH / 2;
		const frameX1 = (cropFrame.x - originX) / zoomLevel + imgW / 2;
		const frameY1 = (cropFrame.y - originY) / zoomLevel + imgH / 2;
		const frameW = cropFrame.w / zoomLevel;
		const frameH = cropFrame.h / zoomLevel;

		return {
			x: frameX1 * scale,
			y: frameY1 * scale,
			width: frameW * scale,
			height: frameH * scale
		};
	}

	// Save
	async function save() {
		if (!pendingOperation || processing || !naturalWidth || !naturalHeight) return;
		processing = true;
		localError = null;
		const img = new Image();
		img.src = baseImageUrl;
		await new Promise((resolve) => (img.onload = resolve));
		try {
			let options: Parameters<typeof processImageWithCanvas>[1] = {};
			if (pendingOperation === 'rotate') options.rotation = rotation;
			else if (pendingOperation === 'flip') options.flip = { horizontal: flipX, vertical: flipY };
			else if (pendingOperation === 'crop') options.crop = calculateCrop() ?? undefined;

			const result = processImageWithCanvas(img, options);
			baseImageUrl = displayedImageUrl = result;
			pendingOperation = null;
			if (cropMode) {
				cropMode = false;
				zoomLevel = 1;
				cropFrame = null;
			}
			onImageSave(result);
		} catch {
			localError = 'Error al procesar la imagen';
		} finally {
			processing = false;
		}
	}

	// Derived
	const imageStyle = $derived(
		`transform: ${cropMode ? `scale(${zoomLevel})` : `rotate(${rotation}deg) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`}; transform-origin: center; object-fit: contain; width: 100%; height: 100%;`
	);
	const canSave = $derived(pendingOperation && (!cropMode || (cropMode && cropFrame)));
	const canRevert = $derived(baseImageUrl !== imageUrl);
	const displayError = $derived(error?.message || localError);
</script>

<div class="card-body p-4 flex flex-col h-full">
	<header class="flex items-center justify-between mb-4">
		<h3 class="card-title text-base">Previsualización</h3>
		{#if totalFiles > 0}
			<div class="flex gap-2">
				<span class="badge badge-outline">{fileIndex + 1}/{totalFiles}</span>
				<span
					class="badge {status === 'success'
						? 'badge-success'
						: status === 'error'
							? 'badge-error'
							: 'badge-warning'}"
				>
					{status === 'processing'
						? 'Procesando'
						: status === 'success'
							? 'Procesado'
							: status === 'error'
								? 'Error'
								: 'Pendiente'}
				</span>
			</div>
		{/if}
	</header>

	{#if displayedImageUrl}
		<div class="flex flex-wrap justify-center gap-2 mb-4">
			{#if !cropMode}
				<div class="join">
					<button class="btn btn-sm join-item" onclick={() => rotate(false)} disabled={processing}
						><RotateCcw size={16} /></button
					>
					<button class="btn btn-sm join-item" onclick={() => rotate(true)} disabled={processing}
						><RotateCw size={16} /></button
					>
				</div>
				<div class="join">
					<button class="btn btn-sm join-item" onclick={() => flip(true)} disabled={processing}
						><FlipHorizontal size={16} /></button
					>
					<button class="btn btn-sm join-item" onclick={() => flip(false)} disabled={processing}
						><FlipVertical size={16} /></button
					>
				</div>
				<button class="btn btn-sm" onclick={revert} disabled={processing || !canRevert}
					><RefreshCcw size={16} /></button
				>
			{/if}
			<button
				class="btn btn-sm {cropMode ? 'btn-warning' : 'btn-primary'}"
				onclick={toggleCrop}
				disabled={processing}
			>
				{#if cropMode}
					<X size={16} /> Cancelar
				{:else}
					<Crop size={16} /> Recortar A5
				{/if}
			</button>
			{#if cropMode}
				<div class="join">
					<button
						class="btn btn-sm join-item"
						onclick={() => zoom('out')}
						disabled={zoomLevel <= ZOOM_MIN || processing}><ZoomOut size={16} /></button
					>
					<span class="btn btn-sm join-item bg-base-200 w-12 text-center"
						>{Math.round(zoomLevel * 100)}%</span
					>
					<button
						class="btn btn-sm join-item"
						onclick={() => zoom('in')}
						disabled={zoomLevel >= ZOOM_MAX || processing}><ZoomIn size={16} /></button
					>
				</div>
			{/if}
			{#if canSave}
				<button class="btn btn-sm btn-success" onclick={save} disabled={processing}>
					{#if processing}
						<Loader2 size={16} class="animate-spin" /> Guardando...
					{:else}
						<Save size={16} /> Guardar
					{/if}
				</button>
			{/if}
		</div>
	{/if}

	{#if displayError}
		<div class="alert alert-error p-2 mb-4">
			<AlertCircle size={16} />
			<span class="text-xs">{displayError}</span>
			{#if localError}
				<button class="btn btn-xs btn-ghost" onclick={() => (localError = null)}>
					<X size={14} />
				</button>
			{/if}
		</div>
	{/if}

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={containerRef}
		class="relative flex-1 bg-base-200/50 rounded-lg min-h-[300px] border border-base-300 overflow-hidden"
		style={cropMode ? (dragging ? 'cursor: grabbing;' : 'cursor: grab;') : ''}
		onmousemove={moveDrag}
		onmouseup={endDrag}
	>
		<div class="relative w-full h-full flex items-center justify-center">
			{#if displayedImageUrl}
				<img
					src={displayedImageUrl}
					alt="Previsualización"
					class="block select-none transition-transform duration-150"
					style={imageStyle}
					draggable="false"
				/>
			{/if}
		</div>
		{#if cropMode && cropFrame}
			<div
				class="absolute border-2 border-dashed border-primary"
				style="left: {cropFrame.x}px; top: {cropFrame.y}px; width: {cropFrame.w}px; height: {cropFrame.h}px;"
				onmousedown={startDrag}
			></div>
			<!-- Áreas oscurecidas para el backdrop -->
			<div
				class="absolute top-0 left-0 right-0"
				style="height: {cropFrame.y}px; background: rgba(0,0,0,0.65);"
			></div>
			<div
				class="absolute bottom-0 left-0 right-0"
				style="height: {containerRef?.clientHeight -
					cropFrame.y -
					cropFrame.h}px; background: rgba(0,0,0,0.65);"
			></div>
			<div
				class="absolute left-0"
				style="top: {cropFrame.y}px; width: {cropFrame.x}px; height: {cropFrame.h}px; background: rgba(0,0,0,0.65);"
			></div>
			<div
				class="absolute right-0"
				style="top: {cropFrame.y}px; width: {containerRef?.clientWidth -
					cropFrame.x -
					cropFrame.w}px; height: {cropFrame.h}px; background: rgba(0,0,0,0.65);"
			></div>
		{/if}
	</div>

	{#if displayedImageUrl}
		<div class="flex justify-center mt-4 gap-2 text-xs">
			<span class="badge badge-ghost">
				{cropMode
					? 'Recorte A5'
					: pendingOperation
						? `${pendingOperation === 'rotate' ? `Rotación ${rotation}°` : `Volteo ${flipX ? 'H' : 'V'}`}`
						: 'Sin cambios'}
			</span>
			{#if cropMode}
				<span class="badge badge-outline">{Math.round(zoomLevel * 100)}%</span>
			{/if}
		</div>
	{/if}
</div>

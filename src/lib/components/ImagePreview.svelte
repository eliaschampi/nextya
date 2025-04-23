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
		ZoomOut,
		RefreshCcw
	} from 'lucide-svelte';
	import { PAPER_FORMATS, processImageWithCanvas } from '$lib/utils/imageUtils';
	import type { ApiOmrErrorData } from '$lib/types/api'; // Assuming this type exists

	// --- Props ---
	const {
		imageUrl = '', // Initial URL
		status = 'pending',
		fileIndex = -1,
		totalFiles = 0,
		isA5Format: initialIsA5Format = true,
		formatName: initialFormatName = 'A5 Vertical',
		error = undefined, // Receive the error object
		onImageSave // Mandatory callback
	} = $props<{
		imageUrl: string;
		status?: 'pending' | 'processing' | 'success' | 'error';
		fileIndex?: number;
		isA5Format?: boolean;
		formatName?: string; // Added formatName to props type based on usage
		error?: ApiOmrErrorData | null | undefined;
		totalFiles?: number;
		onImageSave: (processedImageData: string) => void;
	}>();

	// --- Constantes ---
	const A5_VERTICAL_RATIO = PAPER_FORMATS.A5_VERTICAL.ratio;
	const MIN_ZOOM = 1.0;
	const MAX_ZOOM = 3.0;
	const ZOOM_STEP = 0.1;

	// --- Internal State ---
	let imageRef = $state<HTMLImageElement | undefined>(undefined);
	let imageContainerRef = $state<HTMLDivElement | undefined>(undefined);

	// Images
	let baseImageUrl = $state(imageUrl); // Base image for the *next* save operation
	let displayedImageUrl = $state(imageUrl); // Currently displayed image
	let naturalWidth = $state(0);
	let naturalHeight = $state(0);

	// Pending Operation State
	let pendingOperation: 'rotate' | 'flip' | 'crop' | null = $state(null);
	let rotation = $state<0 | 90 | 180 | 270>(0);
	let flipX = $state(false);
	let flipY = $state(false);

	// Crop State
	let cropMode = $state(false);
	let zoomLevel = $state(1);
	let cropData = $state<{ x: number; y: number; width: number; height: number } | null>(null);
	let isDraggingCrop = $state(false);
	let dragStartOffset = $state<{ x: number; y: number } | null>(null);

	// UI State
	let isProcessing = $state(false); // Saving in progress...
	let localError = $state<string | null>(null); // For errors generated within the component

	// --- Effects ---

	// 1. Reset everything if the initial `imageUrl` prop changes
	$effect(() => {
		console.log('Effect: imageUrl prop changed', imageUrl);
		baseImageUrl = imageUrl;
		displayedImageUrl = imageUrl;
		resetAllPendingStates();
		loadNaturalDimensions(imageUrl); // Load dimensions of the new initial image
		localError = null; // Clear local errors on new image
	});

	// 2. Load dimensions when the base image (after a save) changes
	//    We need dimensions of the *base* image for accurate processing.
	$effect(() => {
		console.log('Effect: baseImageUrl changed', baseImageUrl);
		loadNaturalDimensions(baseImageUrl);
	});

	// 3. Initialize/clear crop frame when entering/exiting cropMode or if container resizes (implicitly via loadNaturalDimensions)
	$effect(() => {
		console.log('Effect: cropMode or dimensions changed', cropMode, naturalWidth);
		if (cropMode && imageRef && imageContainerRef && naturalWidth > 0 && naturalHeight > 0) {
			initializeCropFrame();
		} else if (!cropMode) {
			cropData = null; // Clear data when not in crop mode
		}
	});

	// --- Helper Functions ---
	async function loadNaturalDimensions(src: string) {
		console.log('Loading dimensions for:', src);
		if (!src) {
			console.log('No src, resetting dimensions');
			naturalWidth = 0;
			naturalHeight = 0;
			return;
		}
		try {
			const img = new Image();
			img.onload = () => {
				console.log('Dimensions loaded:', img.naturalWidth, img.naturalHeight);
				naturalWidth = img.naturalWidth;
				naturalHeight = img.naturalHeight;
				// If we are in crop mode when dimensions load, re-initialize the frame
				if (cropMode) {
					console.log('Re-initializing crop frame due to dimension load');
					initializeCropFrame();
				}
			};
			img.onerror = (err) => {
				console.error('Error loading image to get dimensions:', src, err);
				naturalWidth = 0;
				naturalHeight = 0;
				localError = 'Error al cargar la imagen para obtener dimensiones.';
			};
			img.src = src;
		} catch (err) {
			console.error('Exception loading image dimensions:', err);
			naturalWidth = 0;
			naturalHeight = 0;
			localError = 'Error al cargar dimensiones de la imagen.';
		}
	}

	// Resets only pending visual changes to be saved
	function resetPendingVisualChanges() {
		pendingOperation = null;
		rotation = 0;
		flipX = false;
		flipY = false;
		// Does not reset cropMode or zoom here, only the pending operation state
	}

	// Resets everything, including crop mode and zoom
	function resetAllPendingStates() {
		resetPendingVisualChanges();
		cropMode = false;
		zoomLevel = 1;
		cropData = null;
		isDraggingCrop = false;
		dragStartOffset = null;
		localError = null; // Clear local errors on full reset
	}

	// Reverts to the original image provided by the prop
	function revertToOriginal() {
		if (isProcessing) return;
		baseImageUrl = imageUrl; // Revert base to original prop
		displayedImageUrl = imageUrl; // Display original prop
		resetAllPendingStates(); // Reset all modes and pending ops
		localError = null; // Clear local errors
	}

	// --- Operation Handlers (Update PENDING state) ---

	function handleRotate(clockwise: boolean) {
		if (cropMode || isProcessing) return;
		localError = null;
		const currentRotation = pendingOperation === 'rotate' ? rotation : 0; // Use existing pending rotation if any
		const newRotation = ((currentRotation + (clockwise ? 90 : -90) + 360) % 360) as
			| 0
			| 90
			| 180
			| 270;

		// If we rotate back to 0 degrees from a pending rotation state, clear the pending op
		if (pendingOperation === 'rotate' && newRotation === 0) {
			resetPendingVisualChanges();
			displayedImageUrl = baseImageUrl; // Show the base image without visual rotation
		} else {
			rotation = newRotation;
			pendingOperation = 'rotate';
			flipX = false; // Rotation cancels pending flip
			flipY = false;
			// Apply visual rotation immediately for feedback (using derived style)
			displayedImageUrl = baseImageUrl; // Ensure display uses the base for visual transforms
		}
	}

	function handleFlip(horizontal: boolean) {
		if (cropMode || isProcessing) return;
		localError = null;
		let newFlipX = pendingOperation === 'flip' ? flipX : false;
		let newFlipY = pendingOperation === 'flip' ? flipY : false;

		if (horizontal) {
			newFlipX = !newFlipX;
			// newFlipY = false; // Allow combining flips? Let's keep them exclusive for simplicity.
		} else {
			newFlipY = !newFlipY;
			// newFlipX = false; // Allow combining flips? Let's keep them exclusive for simplicity.
		}

		// If only one flip is allowed at a time:
		if (horizontal) newFlipY = false;
		else newFlipX = false;

		flipX = newFlipX;
		flipY = newFlipY;

		if (flipX || flipY) {
			pendingOperation = 'flip';
			rotation = 0; // Flip cancels pending rotation
		} else {
			// If both flips are false, cancel the pending flip operation
			if (pendingOperation === 'flip') {
				pendingOperation = null;
			}
		}
		displayedImageUrl = baseImageUrl; // Ensure display uses the base for visual transforms
	}

	function toggleCropMode() {
		if (isProcessing) return;
		localError = null;
		cropMode = !cropMode;
		if (cropMode) {
			// Entering crop mode
			resetPendingVisualChanges(); // Cancel pending rotate/flip
			pendingOperation = 'crop';
			zoomLevel = 1; // Reset zoom when entering crop mode
			displayedImageUrl = baseImageUrl; // Ensure we crop the base image
			// initializeCropFrame() is called by the $effect
		} else {
			// Exiting crop mode (Cancel)
			if (pendingOperation === 'crop') pendingOperation = null;
			zoomLevel = 1; // Reset visual zoom
			// cropData is cleared by the $effect
		}
	}

	// --- Crop Functions ---

	function initializeCropFrame() {
		if (!imageRef || !imageContainerRef || !naturalWidth || !naturalHeight) return;
		const containerRect = imageContainerRef.getBoundingClientRect();

		// Calculate available space within the container (with padding)
		const padding = 32; // p-4 = 1rem * 2 = 32px approx
		const availableWidth = containerRect.width - padding;
		const availableHeight = containerRect.height - padding;

		if (availableWidth <= 0 || availableHeight <= 0) return; // Avoid division by zero or negative dimensions

		// Target A5 aspect ratio
		const targetRatio = A5_VERTICAL_RATIO;

		// Calculate initial frame size based on 90% of available space, respecting A5 ratio
		let frameWidth = availableWidth * 0.9;
		let frameHeight = frameWidth / targetRatio;

		// If calculated height exceeds available height, base calculation on height instead
		if (frameHeight > availableHeight * 0.9) {
			frameHeight = availableHeight * 0.9;
			frameWidth = frameHeight * targetRatio;
		}

		// Ensure minimum size and integer values
		frameWidth = Math.max(50, Math.floor(frameWidth)); // Minimum width 50px
		frameHeight = Math.max(50, Math.floor(frameHeight)); // Minimum height 50px

		// Center the frame within the container
		const frameX = Math.floor((containerRect.width - frameWidth) / 2);
		const frameY = Math.floor((containerRect.height - frameHeight) / 2);

		console.log('Initializing crop frame:', { frameX, frameY, frameWidth, frameHeight });
		cropData = { x: frameX, y: frameY, width: frameWidth, height: frameHeight };
	}

	function handleZoom(direction: 'in' | 'out') {
		if (!cropMode || isProcessing) return;
		localError = null;
		const newZoom = zoomLevel + (direction === 'in' ? ZOOM_STEP : -ZOOM_STEP);
		zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
	}

	// --- Crop Frame Dragging (Mouse Only) ---
	function startDragCrop(event: MouseEvent) {
		if (!cropMode || !cropData || isProcessing || !imageContainerRef) return;
		event.preventDefault();
		event.stopPropagation(); // Prevent potential parent drags
		isDraggingCrop = true;
		imageContainerRef.style.cursor = 'grabbing'; // Change cursor immediately

		const containerRect = imageContainerRef.getBoundingClientRect();
		dragStartOffset = {
			x: event.clientX - containerRect.left - cropData.x,
			y: event.clientY - containerRect.top - cropData.y
		};
		document.addEventListener('mousemove', handleMouseMoveCrop);
		document.addEventListener('mouseup', handleMouseUpCrop, { once: true }); // Use { once: true } for cleanup
	}

	function handleMouseMoveCrop(event: MouseEvent) {
		if (!isDraggingCrop || !dragStartOffset || !cropData || !imageContainerRef) return;
		const containerRect = imageContainerRef.getBoundingClientRect();
		let newX = event.clientX - containerRect.left - dragStartOffset.x;
		let newY = event.clientY - containerRect.top - dragStartOffset.y;

		// Constrain frame movement within the container bounds
		const maxX = containerRect.width - cropData.width;
		const maxY = containerRect.height - cropData.height;
		newX = Math.max(0, Math.min(maxX, newX));
		newY = Math.max(0, Math.min(maxY, newY));

		cropData = { ...cropData, x: Math.floor(newX), y: Math.floor(newY) };
	}

	function handleMouseUpCrop() {
		if (!isDraggingCrop) return;
		isDraggingCrop = false;
		if (imageContainerRef) imageContainerRef.style.cursor = 'grab'; // Restore grab cursor
		dragStartOffset = null;
		document.removeEventListener('mousemove', handleMouseMoveCrop);
		// No need to remove mouseup listener due to { once: true } in startDragCrop
	}

	// --- Saving ---
	async function saveChanges() {
		if (pendingOperation === null || isProcessing || !imageRef || !naturalWidth || !naturalHeight) {
			console.warn('Save aborted:', {
				pendingOperation,
				isProcessing,
				imageRef,
				naturalWidth,
				naturalHeight
			});
			return;
		}
		// Ensure we have an image reference to the *base* image for processing
		const imageToProcess = new Image();
		imageToProcess.src = baseImageUrl;

		// Wait for the base image to load if it hasn't already (e.g., if baseImageUrl just changed)
		await new Promise((resolve, reject) => {
			if (imageToProcess.complete && imageToProcess.naturalWidth > 0) {
				resolve(true);
			} else {
				imageToProcess.onload = resolve;
				imageToProcess.onerror = reject;
			}
		});

		isProcessing = true;
		localError = null; // Clear previous local errors
		const currentOperation = pendingOperation; // Capture the operation

		try {
			let processedImageData: string | null = null;
			let options: Parameters<typeof processImageWithCanvas>[1] = {};

			// --- Calculate Processing Options ---

			if (currentOperation === 'rotate') {
				options.rotation = rotation;
			} else if (currentOperation === 'flip') {
				options.flip = { horizontal: flipX, vertical: flipY };
			} else if (currentOperation === 'crop' && cropData && imageContainerRef) {

				const containerRect = imageContainerRef.getBoundingClientRect();

				let imgDisplayWidth: number;
				let imgDisplayHeight: number;
				const imgRatio = naturalWidth / naturalHeight;
				const containerRatio = containerRect.width / containerRect.height;

				// Calculate the 'object-contain' dimensions
				if (imgRatio > containerRatio) {
					// Image wider than container aspect ratio
					imgDisplayWidth = containerRect.width;
					imgDisplayHeight = imgDisplayWidth / imgRatio;
				} else {
					// Image taller than container aspect ratio
					imgDisplayHeight = containerRect.height;
					imgDisplayWidth = imgDisplayHeight * imgRatio;
				}

				// Calculate the visual offset of the 'contained' image within the container
				const imgOffsetX = (containerRect.width - imgDisplayWidth) / 2;
				const imgOffsetY = (containerRect.height - imgDisplayHeight) / 2;

				// 1. Frame coordinates relative to the container (visual, zoomed)
				const frameVisualX1 = cropData.x;
				const frameVisualY1 = cropData.y;
				const frameVisualX2 = cropData.x + cropData.width;
				const frameVisualY2 = cropData.y + cropData.height;

				// 2. Image visual coordinates (contained, centered) relative to container
				const imgVisualX = imgOffsetX;
				const imgVisualY = imgOffsetY;
				const imgVisualW = imgDisplayWidth;
				const imgVisualH = imgDisplayHeight;

				// 3. Map frame coordinates to coordinates relative to the *zoomed* image's visual top-left
				// Center of zoom is the center of the *displayed* image (imgVisualX + imgVisualW/2, imgVisualY + imgVisualH/2)
				const zoomOriginX = imgVisualX + imgVisualW / 2;
				const zoomOriginY = imgVisualY + imgVisualH / 2;

				// Frame coords relative to zoom origin
				const frameRelOriginX1 = frameVisualX1 - zoomOriginX;
				const frameRelOriginY1 = frameVisualY1 - zoomOriginY;
				const frameRelOriginX2 = frameVisualX2 - zoomOriginX;
				const frameRelOriginY2 = frameVisualY2 - zoomOriginY;

				// Frame coords relative to zoom origin, *before* zoom
				const frameRelOriginX1_noZoom = frameRelOriginX1 / zoomLevel;
				const frameRelOriginY1_noZoom = frameRelOriginY1 / zoomLevel;
				const frameRelOriginX2_noZoom = frameRelOriginX2 / zoomLevel;
				const frameRelOriginY2_noZoom = frameRelOriginY2 / zoomLevel;

				// Frame coords relative to image visual top-left, *before* zoom
				const frameImgX1_noZoom = zoomOriginX - imgVisualX + frameRelOriginX1_noZoom;
				const frameImgY1_noZoom = zoomOriginY - imgVisualY + frameRelOriginY1_noZoom;
				const frameImgX2_noZoom = zoomOriginX - imgVisualX + frameRelOriginX2_noZoom;
				const frameImgY2_noZoom = zoomOriginY - imgVisualY + frameRelOriginY2_noZoom;

				// Frame width/height in image visual coords, *before* zoom
				const frameImgW_noZoom = frameImgX2_noZoom - frameImgX1_noZoom; // cropData.width / zoomLevel;
				const frameImgH_noZoom = frameImgY2_noZoom - frameImgY1_noZoom; // cropData.height / zoomLevel;

				// 4. Convert image visual coordinates (no zoom) to natural image coordinates
				// The ratio is naturalDim / visualDim
				const naturalScale = naturalWidth / imgVisualW; // Should be same as naturalHeight / imgVisualH

				const naturalX = frameImgX1_noZoom * naturalScale;
				const naturalY = frameImgY1_noZoom * naturalScale;
				const naturalW = frameImgW_noZoom * naturalScale;
				const naturalH = frameImgH_noZoom * naturalScale;

				// 5. Set crop options for the utility function
				options.crop = {
					x: naturalX,
					y: naturalY,
					width: naturalW,
					height: naturalH
				};
				console.log('Calculated Natural Crop:', options.crop);
			} else {
				// No valid operation or data to process
				console.warn('Save Changes called but no valid pending operation or data.');
				isProcessing = false;
				return;
			}

			// Call the processing function with the *base* image element and options
			processedImageData = processImageWithCanvas(imageToProcess, options);

			// --- Update state after successful processing ---
			if (processedImageData) {
				baseImageUrl = processedImageData; 
				displayedImageUrl = processedImageData; 
				resetPendingVisualChanges(); 

				// If the operation was 'crop', exit crop mode
				if (currentOperation === 'crop') {
					cropMode = false;
					zoomLevel = 1; // Reset zoom
					cropData = null; // Clear crop data
				}

				// Notify the parent component
				onImageSave(processedImageData);
			} else {
				throw new Error('Image processing returned null data.');
			}
		} catch (err) {
			console.error('Error saving changes:', err);
			localError = `Error al procesar la image`;
			resetPendingVisualChanges();
		} finally {
			isProcessing = false;
		}
	}

	// --- Derived State ---
	const imageStyle = $derived(() => {
		const transforms: string[] = [];
		// Apply zoom visual ONLY in crop mode
		if (cropMode) {
			transforms.push(`scale(${zoomLevel})`);
		}
		else {
			if (pendingOperation === 'rotate' && rotation !== 0) {
				transforms.push(`rotate(${rotation}deg)`);
			}
			if (pendingOperation === 'flip' && (flipX || flipY)) {
				transforms.push(`scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`);
			}
		}
		// Always apply transform-origin center for consistency
		return `transform: ${transforms.join(' ')}; transform-origin: center; width: 100%; height: 100%; object-fit: contain;`; // Added width/height/object-fit
	});

	// Enable "Save Changes" button (Rotate/Flip)
	const canSaveChanges = $derived(pendingOperation === 'rotate' || pendingOperation === 'flip');
	// Enable "Apply Crop" button
	const canApplyCrop = $derived(pendingOperation === 'crop' && cropMode && cropData !== null);
	// Enable "Revert to Original" button
	const canRevert = $derived(baseImageUrl !== imageUrl); // If the current base differs from the initial prop

	const displayError = $derived(error?.message || localError); // Prioritize prop error message
</script>

<div class="card-body p-4 flex flex-col h-full">
	<!-- Header -->
	<header class="flex items-center justify-between mb-4 overflow-x-auto flex-shrink-0">
		<h3 class="card-title text-base font-medium">Previsualización</h3>
		{#if displayedImageUrl && totalFiles > 0}
			<div class="flex gap-2 items-center flex-shrink-0">
				<span class="badge badge-outline gap-1">{fileIndex + 1}/{totalFiles}</span>
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

	<!-- Toolbar -->
	{#if displayedImageUrl}
		<div class="flex flex-wrap justify-center gap-2 mb-4 flex-shrink-0">
			{#if !cropMode}
				<!-- Rotate Buttons -->
				<div class="join">
					<button
						class="btn btn-sm join-item"
						title="Rotar anti-horario (-90°)"
						onclick={() => handleRotate(false)}
						disabled={isProcessing || cropMode}
					>
						<RotateCcw size={16} />
					</button>
					<button
						class="btn btn-sm join-item"
						title="Rotar horario (+90°)"
						onclick={() => handleRotate(true)}
						disabled={isProcessing || cropMode}
					>
						<RotateCw size={16} />
					</button>
				</div>
				<!-- Flip Buttons -->
				<div class="join">
					<button
						class="btn btn-sm join-item"
						title="Voltear horizontal"
						onclick={() => handleFlip(true)}
						disabled={isProcessing || cropMode}
					>
						<FlipHorizontal size={16} />
					</button>
					<button
						class="btn btn-sm join-item"
						title="Voltear vertical"
						onclick={() => handleFlip(false)}
						disabled={isProcessing || cropMode}
					>
						<FlipVertical size={16} />
					</button>
				</div>
				<!-- Revert Button -->
				<button
					class="btn btn-sm"
					title="Restablecer Original"
					onclick={revertToOriginal}
					disabled={isProcessing || !canRevert || cropMode}
				>
					<RefreshCcw size={16} />
				</button>
			{/if}

			<!-- Crop Toggle Button -->
			<button
				class="btn btn-sm gap-1 {cropMode ? 'btn-warning' : 'btn-primary'}"
				onclick={toggleCropMode}
				disabled={isProcessing}
			>
				{#if cropMode}
					<X size={16} /> Cancelar Recorte
				{:else}
					<Crop size={16} /> Recortar A5
				{/if}
			</button>

			<!-- Crop Controls (Zoom & Apply) -->
			{#if cropMode}
				<div class="join">
					<button
						class="btn btn-sm join-item"
						onclick={() => handleZoom('out')}
						disabled={zoomLevel <= MIN_ZOOM || isProcessing}
						title="Alejar"
					>
						<ZoomOut size={16} />
					</button>
					<span
						class="btn btn-sm join-item no-animation cursor-default bg-base-200 w-16 text-center"
						>{Math.round(zoomLevel * 100)}%</span
					>
					<button
						class="btn btn-sm join-item"
						onclick={() => handleZoom('in')}
						disabled={zoomLevel >= MAX_ZOOM || isProcessing}
						title="Acercar"
					>
						<ZoomIn size={16} />
					</button>
				</div>
				<button
					class="btn btn-sm btn-success gap-1"
					onclick={saveChanges}
					disabled={isProcessing || !canApplyCrop}
					title="Aplicar recorte"
				>
					{#if isProcessing && pendingOperation === 'crop'}
						<Loader2 size={16} class="animate-spin" /> Aplicando...
					{:else}
						<Save size={16} /> Aplicar Recorte
					{/if}
				</button>
			{/if}

			<!-- Save Changes Button (Rotate/Flip) -->
			{#if canSaveChanges && !cropMode}
				<button
					class="btn btn-sm btn-success gap-1"
					onclick={saveChanges}
					disabled={isProcessing}
					title="Guardar cambios pendientes (rotar/voltear)"
				>
					{#if isProcessing && pendingOperation !== 'crop'}
						<Loader2 size={16} class="animate-spin" /> Guardando...
					{:else}
						<Save size={16} /> Guardar Cambios
					{/if}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Error Display Area -->
	{#if displayError}
		<div class="alert alert-error p-2 mb-4 flex-shrink-0">
			<AlertCircle size={16} />
			<span class="text-xs">{displayError}</span>
			{#if localError}
				<!-- Allow dismissing local errors -->
				<button class="btn btn-xs btn-ghost" onclick={() => (localError = null)}
					><X size={14} />
				</button>
			{/if}
		</div>
	{/if}

	<!-- Image Viewer -->
	<div
		bind:this={imageContainerRef}
		class="relative flex-1 flex items-center justify-center bg-base-200/50 dark:bg-base-content/10 rounded-lg p-0 min-h-[300px] overflow-auto border border-base-300"
		style={isDraggingCrop ? 'cursor: grabbing;' : cropMode ? 'cursor: grab;' : 'cursor: default;'}
	>
		{#if displayedImageUrl}
			<!-- Image Wrapper (for centering and scaling context) -->
			<div class="relative w-full h-full flex items-center justify-center">
				<img
					bind:this={imageRef}
					src={displayedImageUrl}
					alt="Previsualización"
					class="block select-none transition-transform duration-150 ease-in-out"
					style={imageStyle()}
					draggable="false"
					onload={() => {
						console.log('Image loaded in DOM, src:', displayedImageUrl);
					}}
				/>
			</div>
			<!-- Crop Overlay -->
			{#if cropMode && cropData}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="absolute border-2 border-dashed border-primary bg-transparent group"
					style="
                        left: {cropData.x}px;
                        top: {cropData.y}px;
                        width: {cropData.width}px;
                        height: {cropData.height}px;
                        cursor: move;
                        z-index: 10; /* Above shadow */
                    "
					onmousedown={startDragCrop}
				>
					<!-- Visual Move Icon (centered, fades slightly on hover) -->
					<div
						class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-content opacity-50 group-hover:opacity-75 transition-opacity pointer-events-none"
					>
						<Move size={24} />
					</div>
				</div>
				<!-- Outer Shadow (non-interactive) -->
				<div
					class="absolute pointer-events-none"
					style="
                        left: {cropData.x}px;
                        top: {cropData.y}px;
                        width: {cropData.width}px;
                        height: {cropData.height}px;
                        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65);
                        z-index: 5; /* Below frame */
                    "
				></div>
			{/if}
		{/if}
	</div>

	<!-- Info Footer -->
	{#if displayedImageUrl}
		<div class="flex justify-center mt-4 gap-2 flex-wrap flex-shrink-0 text-xs">
			{#if cropMode}
				<span class="badge badge-sm badge-info">Modo Recorte: A5 Vertical</span>
				<span class="badge badge-sm badge-outline">Zoom: {Math.round(zoomLevel * 100)}%</span>
				{#if cropData}<span class="badge badge-sm badge-ghost"
						>Tamaño: {cropData.width}x{cropData.height}px</span
					>{/if}
			{:else}
				<span class="badge badge-sm badge-ghost">
					{#if pendingOperation === 'rotate'}Pendiente: Rotación {rotation}°{/if}
					{#if pendingOperation === 'flip'}Pendiente: Volteo {flipX ? 'H' : ''}{flipY
							? 'V'
							: ''}{/if}
					{#if pendingOperation === null && !localError && !error}Sin cambios pendientes{/if}
					{#if localError || error}Esperando acción...{/if}
				</span>
				{#if initialFormatName}
					{#if initialIsA5Format}
						<span class="badge badge-sm badge-success gap-1">
							<Check size={12} /> Formato Original: {initialFormatName}
						</span>
					{:else}
						<span class="badge badge-sm badge-warning gap-1">
							<Info size={12} /> Formato Original: {initialFormatName}
						</span>
					{/if}
				{/if}
			{/if}
		</div>
	{/if}
</div>

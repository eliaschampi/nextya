<script lang="ts">
	import { Upload, Check, X, AlertCircle, Loader2 } from 'lucide-svelte';

	const {
		imageUrl = '',
		selectionRect,
		status = 'pending',
		fileIndex = -1,
		totalFiles = 0,
		onchange = undefined
	} = $props<{
		imageUrl: string;
		selectionRect: { top: number; left: number; width: number; height: number };
		status?: 'pending' | 'processing' | 'success' | 'error' | undefined;
		fileIndex?: number;
		totalFiles?: number;
		onchange?: (data: { top: number; left: number; width: number; height: number }) => void;
	}>();

	// Estado local para el rectángulo
	let localRect = $state({
		top: selectionRect.top,
		left: selectionRect.left,
		width: selectionRect.width,
		height: selectionRect.height
	});

	let imageRef = $state<HTMLImageElement | undefined>(undefined);
	let isDragging = $state(false);
	let dragCorner = $state<string | null>(null);
	let rafId = $state<number>(0);

	// Rectángulo absoluto derivado
	let absoluteRect = $derived(imageRef ? getAbsoluteRect(imageRef.getBoundingClientRect()) : null);

	// Sincronizar con props cuando cambien
	$effect(() => {
		localRect = {
			top: selectionRect.top,
			left: selectionRect.left,
			width: selectionRect.width,
			height: selectionRect.height
		};
	});

	// Funciones para el rectángulo de selección
	function getAbsoluteRect(imageRect: DOMRect) {
		return {
			top: (selectionRect.top / 100) * imageRect.height,
			left: (selectionRect.left / 100) * imageRect.width,
			width: (selectionRect.width / 100) * imageRect.width,
			height: (selectionRect.height / 100) * imageRect.height
		};
	}

	function startDrag(event: MouseEvent, corner: string) {
		isDragging = true;
		dragCorner = corner;
		event.preventDefault();
	}

	function handleDrag(event: MouseEvent) {
		if (!isDragging || !dragCorner || !imageUrl || !imageRef) return;
		cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(() => {
			if (!imageRef) return;
			const rect = imageRef.getBoundingClientRect();
			const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
			const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
			const xPercent = (x / rect.width) * 100;
			const yPercent = (y / rect.height) * 100;

			const newRect = { ...localRect };
			const minSize = 5; // Porcentaje mínimo

			switch (dragCorner) {
				case 'topLeft':
					newRect.left = Math.min(xPercent, localRect.left + localRect.width - minSize);
					newRect.top = Math.min(yPercent, localRect.top + localRect.height - minSize);
					newRect.width = Math.max(minSize, localRect.left + localRect.width - newRect.left);
					newRect.height = Math.max(minSize, localRect.top + localRect.height - newRect.top);
					break;
				case 'topRight':
					newRect.top = Math.min(yPercent, localRect.top + localRect.height - minSize);
					newRect.width = Math.max(minSize, xPercent - localRect.left);
					newRect.height = Math.max(minSize, localRect.top + localRect.height - newRect.top);
					break;
				case 'bottomLeft':
					newRect.left = Math.min(xPercent, localRect.left + localRect.width - minSize);
					newRect.height = Math.max(minSize, yPercent - localRect.top);
					newRect.width = Math.max(minSize, localRect.left + localRect.width - newRect.left);
					break;
				case 'bottomRight':
					newRect.width = Math.max(minSize, xPercent - localRect.left);
					newRect.height = Math.max(minSize, yPercent - localRect.top);
					break;
			}

			// Actualizar el estado local y notificar al componente padre
			localRect = newRect;
			onchange?.(localRect);
		});
	}

	function endDrag() {
		isDragging = false;
		dragCorner = null;
	}

	// Ajustar el rectángulo cuando cambie la imagen o el tamaño de la ventana
	function adjustSelectionRect() {
		if (!imageRef) return;
		const maxWidth = 100;
		const maxHeight = 100;

		const newRect = {
			left: Math.max(0, localRect.left),
			top: Math.max(0, localRect.top),
			width: Math.min(localRect.width, maxWidth - localRect.left),
			height: Math.min(localRect.height, maxHeight - localRect.top)
		};

		// Solo actualizar y notificar si hay cambios
		if (
			newRect.left !== localRect.left ||
			newRect.top !== localRect.top ||
			newRect.width !== localRect.width ||
			newRect.height !== localRect.height
		) {
			localRect = newRect;
			onchange?.(localRect);
		}
	}

	// Efecto para ajustar el rectángulo cuando cambie la imagen
	$effect(() => {
		if (imageUrl && imageRef) {
			adjustSelectionRect();
		}
	});

	// Manejar el redimensionamiento de la ventana
	$effect(() => {
		window.addEventListener('resize', adjustSelectionRect);

		return () => {
			window.removeEventListener('resize', adjustSelectionRect);
			cancelAnimationFrame(rafId);
		};
	});
</script>

<div class="card-body p-6">
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
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative flex-1 flex items-center justify-center bg-base-100 rounded-lg p-6 min-h-[400px]"
		onmousemove={handleDrag}
		onmouseup={endDrag}
		onmouseleave={endDrag}
		aria-roledescription="Área de selección"
	>
		<div class="relative max-w-full max-h-[65vh]">
			{#if imageUrl}
				<img
					src={imageUrl}
					alt="Previsualización"
					class="max-w-full max-h-[65vh] object-contain rounded-lg shadow-md"
					bind:this={imageRef}
				/>
				{#if absoluteRect}
					<div
						class="absolute border-2 border-primary bg-primary/10 transition-all duration-100"
						style="top: {absoluteRect.top}px; left: {absoluteRect.left}px; width: {absoluteRect.width}px; height: {absoluteRect.height}px;"
					>
						<button
							class="absolute -top-2 -left-2 w-4 h-4 bg-primary rounded-full cursor-nw-resize hover:scale-125 transition-transform"
							onmousedown={(e) => startDrag(e, 'topLeft')}
							aria-label="Ajustar esquina superior izquierda"
						></button>
						<button
							class="absolute -top-2 -right-2 w-4 h-4 bg-primary rounded-full cursor-ne-resize hover:scale-125 transition-transform"
							onmousedown={(e) => startDrag(e, 'topRight')}
							aria-label="Ajustar esquina superior derecha"
						></button>
						<button
							class="absolute -bottom-2 -left-2 w-4 h-4 bg-primary rounded-full cursor-sw-resize hover:scale-125 transition-transform"
							onmousedown={(e) => startDrag(e, 'bottomLeft')}
							aria-label="Ajustar esquina inferior izquierda"
						></button>
						<button
							class="absolute -bottom-2 -right-2 w-4 h-4 bg-primary rounded-full cursor-se-resize hover:scale-125 transition-transform"
							onmousedown={(e) => startDrag(e, 'bottomRight')}
							aria-label="Ajustar esquina inferior derecha"
						></button>
					</div>
				{/if}
			{:else}
				<div class="text-center opacity-50 space-y-4">
					<Upload size={48} class="mx-auto" />
					<p>Selecciona un archivo</p>
				</div>
			{/if}
		</div>
	</div>
	<footer class="flex justify-between mt-6">
		<p class="text-sm opacity-70">{imageUrl ? 'Ajusta el área de detección' : ''}</p>
		{#if imageUrl}
			<div class="text-sm text-primary">
				Selección: {localRect.left.toFixed(1)}%, {localRect.top.toFixed(1)}%, {localRect.width.toFixed(
					1
				)}%, {localRect.height.toFixed(1)}%
			</div>
		{/if}
	</footer>
</div>

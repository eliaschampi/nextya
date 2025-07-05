<script lang="ts">
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let width = $state(0);
	let height = $state(0);
	let mouseX = $state(0);
	let mouseY = $state(0);
	let animationId = $state<number | null>(null);

	// opacity and max opacity will use props
	const { opacity = 0.09, maxOpacity = 0.2, zIndex = '' } = $props();

	// Configuraciones personalizables
	const GRID_SPACING = 25;
	const BASE_OPACITY = opacity;
	const MAX_OPACITY = maxOpacity;
	const SIGMA = 40;

	onMount(() => {
		setup();
		window.addEventListener('resize', handleResize);
		window.addEventListener('mousemove', handleMouseMove);

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('mousemove', handleMouseMove);
			if (animationId) cancelAnimationFrame(animationId);
		};
	});

	function setup() {
		if (!canvas) return;
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = width;
		canvas.height = height;
		ctx = canvas.getContext('2d');
		if (animationId) cancelAnimationFrame(animationId);
		animate();
	}

	function handleResize() {
		setup();
	}

	function handleMouseMove(e: MouseEvent) {
		mouseX = e.clientX;
		mouseY = e.clientY;
	}

	// Get CSS variable value
	function getCSSVariable(varName: string, fallback: string = ''): string {
		if (typeof window === 'undefined') return fallback;
		return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
	}

	// Convert OKLCH to RGB for canvas
	function oklchToRgb(oklch: string): { r: number; g: number; b: number } {
		// Default fallback color (teal)
		const defaultColor = { r: 80, g: 200, b: 170 };

		try {
			// Create a temporary element to use the browser's color conversion
			const tempEl = document.createElement('div');
			tempEl.style.color = oklch;
			document.body.appendChild(tempEl);

			// Get computed RGB values
			const computedColor = getComputedStyle(tempEl).color;
			document.body.removeChild(tempEl);

			// Parse RGB values from computed style
			const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
			if (rgbMatch) {
				return {
					r: parseInt(rgbMatch[1], 10),
					g: parseInt(rgbMatch[2], 10),
					b: parseInt(rgbMatch[3], 10)
				};
			}

			return defaultColor;
		} catch {
			return defaultColor;
		}
	}

	function animate() {
		if (!ctx) return;

		// Get primary color from CSS variables
		const primaryColor = getCSSVariable('--color-primary', 'oklch(65% 0.15 180)');
		const rgbColor = oklchToRgb(primaryColor);
		ctx.clearRect(0, 0, width, height);

		// Líneas verticales
		for (let x = 0; x < width; x += GRID_SPACING) {
			const d = Math.abs(x - mouseX);
			const opacity =
				BASE_OPACITY + (MAX_OPACITY - BASE_OPACITY) * Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.strokeStyle = `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, ${opacity})`;
			ctx.lineWidth = 1;
			ctx.stroke();
		}

		// Líneas horizontales
		for (let y = 0; y < height; y += GRID_SPACING) {
			const d = Math.abs(y - mouseY);
			const opacity =
				BASE_OPACITY + (MAX_OPACITY - BASE_OPACITY) * Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.strokeStyle = `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, ${opacity})`;
			ctx.lineWidth = 1;
			ctx.stroke();
		}

		animationId = requestAnimationFrame(animate);
	}
</script>

<canvas bind:this={canvas} class="absolute inset-0 {zIndex} pointer-events-none" aria-hidden="true"
></canvas>

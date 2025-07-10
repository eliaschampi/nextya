<script lang="ts">
	import { onMount } from 'svelte';

	// Props with defaults for customization
	const {
		opacity = 0.15,
		maxOpacity = 0.3,
		zIndex = '',
		gridSpacing = 25,
		dotSize = 2,
		sigma = 80 // Larger for smoother, broader falloff
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let ctx = $state<CanvasRenderingContext2D | null>(null);
	let width = $state(0);
	let height = $state(0);
	let mouseX = $state(0);
	let mouseY = $state(0);
	let rgbColor = $state<{ r: number; g: number; b: number } | null>(null);

	// Debounce function (clever, reusable utility)
	function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
		let timeout: ReturnType<typeof setTimeout> | null = null;
		return (...args: Parameters<T>) => {
			if (timeout) clearTimeout(timeout);
			timeout = setTimeout(() => fn(...args), delay);
		};
	}

	onMount(() => {
		setup();
		computeColor(); // Compute once here

		const debouncedDraw = debounce(drawGrid, 20); // Limit to ~20 redraws/sec max

		const handleResize = () => {
			setup();
			drawGrid();
		};

		const handlePointerMove = (e: MouseEvent | TouchEvent) => {
			if (e instanceof MouseEvent) {
				mouseX = e.clientX;
				mouseY = e.clientY;
			} else if (e.touches?.[0]) {
				mouseX = e.touches[0].clientX;
				mouseY = e.touches[0].clientY;
			}
			debouncedDraw();
		};

		window.addEventListener('resize', handleResize);
		window.addEventListener('mousemove', handlePointerMove);
		window.addEventListener('touchmove', handlePointerMove);

		// Optional: Watch for theme changes (e.g., dark mode toggle)
		// const observer = new MutationObserver(computeColor);
		// observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('mousemove', handlePointerMove);
			window.removeEventListener('touchmove', handlePointerMove);
			// observer?.disconnect();
		};
	});

	function setup() {
		if (!canvas) return;
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = width;
		canvas.height = height;
		ctx = canvas.getContext('2d');
	}

	function computeColor() {
		const primaryColor = getCSSVariable('--color-primary', 'oklch(65% 0.15 180)');
		rgbColor = oklchToRgb(primaryColor);
	}

	// Get CSS variable value
	function getCSSVariable(varName: string, fallback: string = ''): string {
		if (typeof window === 'undefined') return fallback;
		return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
	}

	// Convert OKLCH to RGB for canvas (unchanged, but now called once)
	function oklchToRgb(oklch: string): { r: number; g: number; b: number } {
		const defaultColor = { r: 80, g: 200, b: 170 };
		try {
			const tempEl = document.createElement('div');
			tempEl.style.color = oklch;
			document.body.appendChild(tempEl);
			const computedColor = getComputedStyle(tempEl).color;
			document.body.removeChild(tempEl);
			const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
			return rgbMatch
				? {
						r: parseInt(rgbMatch[1], 10),
						g: parseInt(rgbMatch[2], 10),
						b: parseInt(rgbMatch[3], 10)
					}
				: defaultColor;
		} catch {
			return defaultColor;
		}
	}

	function drawGrid() {
		if (!ctx || !rgbColor) return;
		ctx.clearRect(0, 0, width, height);

		// Draw dots at grid intersections
		for (let x = 0; x < width; x += gridSpacing) {
			for (let y = 0; y < height; y += gridSpacing) {
				const dx = x - mouseX;
				const dy = y - mouseY;
				const d = Math.sqrt(dx * dx + dy * dy); // Distance to mouse
				const falloff = Math.exp(-(d * d) / (2 * sigma * sigma));
				const dotOpacity = opacity + (maxOpacity - opacity) * falloff;
				const dotRadius = dotSize * (0.5 + 0.5 * falloff); // Slight size variation for depth

				ctx.beginPath();
				ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
				// Subtle tint: mix primary with a lighter variant for "glow"
				const tint = Math.min(255, rgbColor.r + 50 * falloff);
				ctx.fillStyle = `rgba(${tint}, ${rgbColor.g}, ${rgbColor.b}, ${dotOpacity})`;
				ctx.fill();
			}
		}
	}
</script>

<canvas bind:this={canvas} class="absolute inset-0 {zIndex} pointer-events-none" aria-hidden="true">
</canvas>

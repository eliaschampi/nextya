// src/lib/utils/imageUtils.ts
// Interfaces y constantes (PAPER_FORMATS, checkImageFormat, validateA5Proportion, base64ToFile)
// se mantienen exactamente como en tu último ejemplo proporcionado.

export interface ImageDimensions {
	width: number;
	height: number;
}

export interface ImageFormat {
	name: string;
	ratio: number;
	tolerance: number;
}

export const PAPER_FORMATS = {
	A5_VERTICAL: { name: 'A5 Vertical', ratio: 1 / 1.414, tolerance: 0.05 },
	A5_HORIZONTAL: { name: 'A5 Horizontal', ratio: 1.414, tolerance: 0.05 }
};

export function checkImageFormat(
	imageWidth: number,
	imageHeight: number,
	format: ImageFormat
): boolean {
	const imageRatio = imageWidth / imageHeight;
	return Math.abs(imageRatio - format.ratio) <= format.tolerance;
}

export function validateA5Proportion(
	width: number,
	height: number
): {
	isValid: boolean;
	format: string;
} {
	const isVertical = checkImageFormat(width, height, PAPER_FORMATS.A5_VERTICAL);
	return {
		isValid: isVertical,
		format: isVertical ? PAPER_FORMATS.A5_VERTICAL.name : 'Formato no A5'
	};
}

// Función calculateCropDimensions (sin cambios)
export function calculateCropDimensions(
	origWidth: number,
	origHeight: number,
	targetRatio: number
): { width: number; height: number; offsetX: number; offsetY: number } {
	let newWidth, newHeight;
	const currentRatio = origWidth / origHeight;

	if (currentRatio > targetRatio) {
		newHeight = origHeight;
		newWidth = Math.round(origHeight * targetRatio);
	} else {
		newWidth = origWidth;
		newHeight = Math.round(origWidth / targetRatio);
	}

	newWidth = Math.min(newWidth, origWidth);
	newHeight = Math.min(newHeight, origHeight);
	const offsetX = Math.max(0, Math.floor((origWidth - newWidth) / 2));
	const offsetY = Math.max(0, Math.floor((origHeight - newHeight) / 2));

	return { width: newWidth, height: newHeight, offsetX, offsetY };
}

export function processImageWithCanvas(
	image: HTMLImageElement,
	options: {
		rotation?: 0 | 90 | 180 | 270;
		flip?: {
			horizontal?: boolean;
			vertical?: boolean;
		};
		crop?: {
			x: number;
			y: number;
			width: number;
			height: number;
		};
		quality?: number;
	}
): string {
	const tempCanvas = document.createElement('canvas');
	const tempCtx = tempCanvas.getContext('2d');
	if (!tempCtx) throw new Error('No se pudo obtener el contexto 2D del canvas');

	const { naturalWidth: imgWidth, naturalHeight: imgHeight } = image;
	let sourceX = 0,
		sourceY = 0,
		sourceWidth = imgWidth,
		sourceHeight = imgHeight;
	let canvasWidth = imgWidth,
		canvasHeight = imgHeight;

	// 1. Determinar el área fuente y tamaño del canvas si hay RECORTE
	if (options.crop && options.crop.width > 0 && options.crop.height > 0) {
		sourceX = Math.max(0, Math.round(options.crop.x));
		sourceY = Math.max(0, Math.round(options.crop.y));
		sourceWidth = Math.max(1, Math.round(options.crop.width));
		sourceHeight = Math.max(1, Math.round(options.crop.height));

		// Asegurar que el recorte no exceda las dimensiones naturales
		if (sourceX + sourceWidth > imgWidth) {
			sourceWidth = imgWidth - sourceX;
		}
		if (sourceY + sourceHeight > imgHeight) {
			sourceHeight = imgHeight - sourceY;
		}
		if (sourceWidth <= 0) sourceWidth = 1;
		if (sourceHeight <= 0) sourceHeight = 1;

		canvasWidth = sourceWidth;
		canvasHeight = sourceHeight;
	}

	// 2. Determinar dimensiones finales si hay ROTACIÓN (aplicada al tamaño del canvas post-recorte)
	let finalWidth = canvasWidth;
	let finalHeight = canvasHeight;
	const applyRotation = options.rotation !== undefined && options.rotation !== 0;

	if (applyRotation && (options.rotation === 90 || options.rotation === 270)) {
		finalWidth = canvasHeight;
		finalHeight = canvasWidth;
	}

	// Configurar el canvas de salida
	const outputCanvas = document.createElement('canvas');
	const outputCtx = outputCanvas.getContext('2d');
	if (!outputCtx) throw new Error('No se pudo obtener el contexto 2D del canvas de salida');
	outputCanvas.width = finalWidth;
	outputCanvas.height = finalHeight;

	// 3. Aplicar transformaciones (rotación/volteo) al contexto de salida
	outputCtx.save();
	outputCtx.translate(finalWidth / 2, finalHeight / 2); // Mover al centro

	if (applyRotation) {
		outputCtx.rotate((options.rotation! * Math.PI) / 180);
	}

	const applyFlip = options.flip && (options.flip.horizontal || options.flip.vertical);
	if (applyFlip) {
		outputCtx.scale(options.flip!.horizontal ? -1 : 1, options.flip!.vertical ? -1 : 1);
	}

	// 4. Dibujar la imagen fuente (recortada o completa) en el contexto transformado
	// Las dimensiones de dibujo (-canvasWidth/2, etc.) son las del canvas ANTES de la rotación
	outputCtx.drawImage(
		image, // Imagen original completa
		sourceX, // Origen X en la imagen original
		sourceY, // Origen Y en la imagen original
		sourceWidth, // Ancho a tomar de la original
		sourceHeight, // Alto a tomar de la original
		-canvasWidth / 2, // Posición X en el canvas (centrado antes de rotar/flipear)
		-canvasHeight / 2, // Posición Y en el canvas (centrado antes de rotar/flipear)
		canvasWidth, // Ancho a dibujar en el canvas
		canvasHeight // Alto a dibujar en el canvas
	);

	outputCtx.restore();

	// Convertir a base64 y retornar
	return outputCanvas.toDataURL('image/jpeg', options.quality ?? 0.95);
}

export function base64ToFile(base64Data: string, fileName: string): File {
	const byteString = atob(base64Data.split(',')[1]);
	const mimeType = base64Data.split(',')[0].split(':')[1].split(';')[0];
	const arrayBuffer = new ArrayBuffer(byteString.length);
	const uint8Array = new Uint8Array(arrayBuffer);

	for (let i = 0; i < byteString.length; i++) {
		uint8Array[i] = byteString.charCodeAt(i);
	}

	const blob = new Blob([arrayBuffer], { type: mimeType });
	return new File([blob], fileName, { type: mimeType });
}
